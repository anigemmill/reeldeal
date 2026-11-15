import { asUser, iso, num, type Ctx } from "../context";
import type { Sql } from "../db/types";
import { notFound } from "../errors";

/*
  Background jobs (media analysis, rendering). A job is only ever reported as
  succeeded by a worker that actually finished it. Submissions are idempotent:
  (org_id, kind, idempotency_key) is unique, so retries of the same request return
  the existing job instead of starting another one.
*/
export type JobKind = "media_analysis" | "render";
export type JobStatus = "queued" | "running" | "succeeded" | "failed" | "cancelled";

export type JobRow = {
  id: string;
  org_id: string;
  kind: JobKind;
  status: JobStatus;
  stage: string | null;
  progress: string | number;
  input: Record<string, unknown>;
  result: Record<string, unknown> | null;
  error: { message: string; retryable?: boolean; code?: string } | null;
  idempotency_key: string;
  attempt: number;
  max_attempts: number;
  retry_of: string | null;
  project_id: string | null;
  media_id: string | null;
  credits_held: number;
  claim_count?: number;
  locked_by?: string | null;
  created_by: string | null;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
};

export function presentJob(j: JobRow) {
  return {
    job_id: j.id,
    kind: j.kind,
    status: j.status,
    stage: j.stage,
    progress_percent: num(j.progress) ?? 0,
    attempt: j.attempt,
    retry_of: j.retry_of,
    project_id: j.project_id,
    media_id: j.media_id,
    credits_held: j.credits_held,
    error: j.error ? { message: j.error.message, retryable: Boolean(j.error.retryable) } : null,
    result: j.status === "succeeded" ? j.result : null,
    created_at: iso(j.created_at),
    started_at: iso(j.started_at),
    finished_at: iso(j.finished_at),
  };
}

export async function submitJob(
  sys: Sql,
  j: { orgId: string; kind: JobKind; idempotencyKey: string; input: Record<string, unknown>; projectId?: string | null; mediaId?: string | null; createdBy: string; creditsHeld?: number; retryOf?: string | null; attempt?: number },
): Promise<{ job: JobRow; duplicate: boolean }> {
  const inserted = await sys.query<JobRow>(
    `insert into public.jobs (org_id, kind, idempotency_key, input, project_id, media_id, created_by, credits_held, retry_of, attempt)
     values ($1, $2, $3, $4::text::jsonb, $5, $6, $7, $8, $9, $10)
     on conflict (org_id, kind, idempotency_key) do nothing returning *`,
    [j.orgId, j.kind, j.idempotencyKey, JSON.stringify(j.input), j.projectId ?? null, j.mediaId ?? null, j.createdBy, j.creditsHeld ?? 0, j.retryOf ?? null, j.attempt ?? 1],
  );
  if (inserted[0]) return { job: inserted[0], duplicate: false };
  const [existing] = await sys.query<JobRow>("select * from public.jobs where org_id = $1 and kind = $2 and idempotency_key = $3", [j.orgId, j.kind, j.idempotencyKey]);
  return { job: existing, duplicate: true };
}

export async function getJob(ctx: Ctx, jobId: string) {
  const [row] = await asUser(ctx, (sql) => sql.query<JobRow>("select * from public.jobs where org_id = $1 and id = $2", [ctx.principal.orgId, jobId]));
  if (!row) throw notFound("Job");
  return row;
}

export async function listJobs(ctx: Ctx, opts: { kind?: JobKind; status?: JobStatus; limit?: number }) {
  const params: unknown[] = [ctx.principal.orgId];
  let where = "org_id = $1";
  if (opts.kind) where += ` and kind = $${params.push(opts.kind)}`;
  if (opts.status) where += ` and status = $${params.push(opts.status)}`;
  return asUser(ctx, (sql) => sql.query<JobRow>(`select * from public.jobs where ${where} order by created_at desc limit ${Math.min(opts.limit ?? 20, 50)}`, params));
}

/* ---- worker side (system context) -------------------------------------- */

export async function claimNextJob(sys: Sql, kinds: JobKind[], workerId: string): Promise<JobRow | null> {
  const [row] = await sys.query<JobRow>(
    `update public.jobs set status = 'running', started_at = now(), heartbeat_at = now(), locked_by = $2, stage = 'starting', claim_count = claim_count + 1
      where id = (select id from public.jobs where status = 'queued' and kind = any($1) order by created_at for update skip locked limit 1)
      returning *`,
    [kinds, workerId],
  );
  return row ?? null;
}

export async function reportProgress(sys: Sql, jobId: string, stage: string, progress: number) {
  await sys.query("update public.jobs set stage = $2, progress = $3, heartbeat_at = now() where id = $1 and status = 'running'", [jobId, stage, Math.max(0, Math.min(100, progress))]);
}

export async function completeJob(sys: Sql, jobId: string, result: Record<string, unknown>) {
  await sys.query("update public.jobs set status = 'succeeded', stage = 'done', progress = 100, result = $2::text::jsonb, finished_at = now() where id = $1", [jobId, JSON.stringify(result)]);
}

export async function failJob(sys: Sql, jobId: string, error: { message: string; retryable: boolean; code?: string }) {
  await sys.query("update public.jobs set status = 'failed', stage = 'failed', error = $2::text::jsonb, finished_at = now() where id = $1", [jobId, JSON.stringify(error)]);
}

/** Keeps the claim alive while a long step runs. False means another worker or the sweeper took the job. */
export async function heartbeat(sys: Sql, jobId: string, workerId: string) {
  const rows = await sys.query("update public.jobs set heartbeat_at = now() where id = $1 and locked_by = $2 and status = 'running' returning id", [jobId, workerId]);
  return rows.length > 0;
}

/**
 * Called inside the finalising transaction, before any billing: locks the job row and
 * checks that this worker still owns it. A worker that lost its claim (it was presumed
 * dead and the job was requeued) must not write results or move credits.
 */
export async function assertStillOwned(sql: Sql, job: JobRow) {
  const [row] = await sql.query<{ status: string; locked_by: string | null }>("select status, locked_by from public.jobs where id = $1 for update", [job.id]);
  if (!row || row.status !== "running" || row.locked_by !== job.locked_by) {
    throw Object.assign(new Error("This worker no longer owns the job; its result was discarded"), { handled: true, lostClaim: true });
  }
}

/** Graceful shutdown: put a job this worker is still running straight back in the queue. */
export async function releaseJob(sys: Sql, jobId: string, workerId: string) {
  const rows = await sys.query(
    "update public.jobs set status = 'queued', locked_by = null, stage = 'requeued: worker shut down' where id = $1 and locked_by = $2 and status = 'running' returning id",
    [jobId, workerId],
  );
  return rows.length > 0;
}

/**
 * Jobs whose worker stopped heartbeating go back to the queue, or fail after
 * max_attempts claims (a job that keeps killing its worker must not loop forever).
 * A failed render releases its credit hold, so it costs nothing.
 */
export async function requeueStaleJobs(sys: Sql, staleAfterSeconds = 120) {
  const stale = await sys.query<{ id: string; kind: JobKind; org_id: string; credits_held: number; project_id: string | null; media_id: string | null; claim_count: number; max_attempts: number }>(
    `select id, kind, org_id, credits_held, project_id, media_id, claim_count, max_attempts from public.jobs
      where status = 'running' and heartbeat_at < now() - make_interval(secs => $1) for update skip locked`,
    [staleAfterSeconds],
  );
  for (const j of stale) {
    if (j.claim_count < j.max_attempts) {
      await sys.query("update public.jobs set status = 'queued', locked_by = null, stage = 'requeued after worker stopped' where id = $1", [j.id]);
      continue;
    }
    await failJob(sys, j.id, { message: "Processing stopped repeatedly on our side. You were not charged; please try again.", retryable: true, code: "worker_lost" });
    if (j.kind === "render") {
      if (j.credits_held > 0) {
        await sys.query(
          "insert into public.credit_transactions (org_id, wallet, kind, amount, period, job_id, note) values ($1, 'video', 'release', $2, $4, $3, 'Render failed: hold released, no charge') on conflict do nothing",
          [j.org_id, j.credits_held, j.id, new Date().toISOString().slice(0, 7)],
        );
      }
      await sys.query("update public.projects set status = 'ready_to_render' where id = $1 and org_id = $2 and status = 'rendering'", [j.project_id, j.org_id]);
    } else {
      await sys.query("update public.media_assets set status = 'uploaded' where id = $1 and status = 'analysing'", [j.media_id]);
    }
  }
  return stale;
}
