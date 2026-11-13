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
     values ($1, $2, $3, $4::jsonb, $5, $6, $7, $8, $9, $10)
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
    `update public.jobs set status = 'running', started_at = now(), heartbeat_at = now(), locked_by = $2, stage = 'starting'
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
  await sys.query("update public.jobs set status = 'succeeded', stage = 'done', progress = 100, result = $2::jsonb, finished_at = now() where id = $1", [jobId, JSON.stringify(result)]);
}

export async function failJob(sys: Sql, jobId: string, error: { message: string; retryable: boolean; code?: string }) {
  await sys.query("update public.jobs set status = 'failed', stage = 'failed', error = $2::jsonb, finished_at = now() where id = $1", [jobId, JSON.stringify(error)]);
}

/** Jobs whose worker stopped heartbeating go back to the queue (or fail after max attempts). */
export async function requeueStaleJobs(sys: Sql, staleAfterSeconds = 600) {
  return sys.query<{ id: string }>(
    `update public.jobs set status = 'queued', locked_by = null, stage = 'requeued after worker stopped'
      where status = 'running' and heartbeat_at < now() - make_interval(secs => $1) returning id`,
    [staleAfterSeconds],
  );
}
