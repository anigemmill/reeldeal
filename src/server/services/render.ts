import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { renderCredits } from "@/lib/pricing";
import { z } from "zod";
import { asUser, iso, num, type Ctx } from "../context";
import { requireRole, requireScope } from "../auth/principal";
import type { Sql } from "../db/types";
import { AppError, invalid, notFound, unavailable, parseInput } from "../errors";
import { mediaToolsAvailable } from "../workers/ffmpeg";
import { presentJob, submitJob, type JobRow } from "./jobs";
import { FORMATS, loadProject, validateScenes, type Scene } from "./projects";
import { availableVideoCredits, currentPeriod, ensureGrant } from "./usage";

/*
  Rendering is billable, so it never starts silently:
    1. create_video without confirmation returns a quote: credits computed on the
       server from config/pricing.json, plus a signed, short-lived quote token.
    2. create_video with confirm: true and that token starts the render. The server
       re-validates everything and recomputes the price; a stale or altered quote is rejected.
  Credits are held when the job is queued and charged only if the render succeeds.
  A failed platform render releases the hold, so it costs nothing. The quote's nonce is
  the job's idempotency key: confirming twice returns the same job and holds credits once.
*/

const QUOTE_TTL_SECONDS = 15 * 60;

type QuotePayload = { o: string; u: string; p: string; s: string; f: string[]; c: number; e: number; n: string };

const sign = (secret: string, body: string) => createHmac("sha256", secret).update(body).digest("base64url");

export function issueQuoteToken(secret: string, q: Omit<QuotePayload, "e" | "n">, now = Date.now()) {
  const payload: QuotePayload = { ...q, e: Math.floor(now / 1000) + QUOTE_TTL_SECONDS, n: randomBytes(12).toString("base64url") };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return { token: `${body}.${sign(secret, body)}`, expiresAt: new Date(payload.e * 1000).toISOString(), nonce: payload.n };
}

export function verifyQuoteToken(secret: string, token: string): QuotePayload {
  const [body, sig] = token.split(".");
  const bad = () => new AppError("invalid_input", "This quote is not valid. Request a new quote by calling create_video without confirm.");
  if (!body || !sig) throw bad();
  const expected = Buffer.from(sign(secret, body));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) throw bad();
  const p = JSON.parse(Buffer.from(body, "base64url").toString()) as QuotePayload;
  if (p.e < Date.now() / 1000) throw new AppError("invalid_input", "This quote has expired. Request a new quote by calling create_video without confirm.");
  return p;
}

async function loadRenderable(sql: Sql, orgId: string, projectId: string, storyboardId?: string) {
  const project = await loadProject(sql, orgId, projectId);
  const [sb] = await sql.query<{ id: string; version: number; title: string; format: string; scenes: Scene[]; total_duration_seconds: string }>(
    storyboardId
      ? "select id, version, title, format, scenes, total_duration_seconds from public.storyboards where org_id = $1 and project_id = $2 and id = $3"
      : "select id, version, title, format, scenes, total_duration_seconds from public.storyboards where org_id = $1 and project_id = $2 order by version desc limit 1",
    storyboardId ? [orgId, projectId, storyboardId] : [orgId, projectId],
  );
  if (!sb) throw storyboardId ? notFound("Storyboard") : invalid("This project has no storyboard yet. Create one with generate_storyboard or submit_storyboard.");
  // Re-check the footage now: it may have been deleted or changed since the storyboard was made.
  const v = await validateScenes(sql, orgId, sb.scenes, "strict");
  if (!v.renderable) throw invalid("Every scene needs footage or on-screen text before rendering.");
  return { project, storyboard: sb, scenes: v.scenes, seconds: v.total };
}

export const CreateVideoInput = z.object({
  project_id: z.uuid(),
  storyboard_id: z.uuid().optional(),
  formats: z.array(z.enum(FORMATS)).min(1).max(4).optional(),
  confirm: z.boolean().optional(),
  quote_token: z.string().max(2000).optional(),
});

export async function createVideo(ctx: Ctx, raw: z.infer<typeof CreateVideoInput>) {
  requireScope(ctx.principal, "mcp:write");
  requireRole(ctx.principal, "editor");
  const i = parseInput(CreateVideoInput, raw);
  if (!(await mediaToolsAvailable(ctx.media))) throw unavailable("Rendering is not available on this server (FFmpeg is not installed).");

  const r = await asUser(ctx, (sql) => loadRenderable(sql, ctx.principal.orgId, i.project_id, i.storyboard_id));
  const formats = [...new Set(i.formats ?? (r.project.formats as (typeof FORMATS)[number][]))].sort();
  const credits = renderCredits({ seconds: r.seconds, formats: formats.length });
  await ctx.db.system((sys) => ensureGrant(sys, ctx.principal.orgId));
  const [org] = await asUser(ctx, (sql) => sql.query<{ plan_id: string }>("select plan_id from public.organisations where id = $1", [ctx.principal.orgId]));
  const available = await asUser(ctx, (sql) => availableVideoCredits(sql, ctx.principal.orgId, org.plan_id));
  const breakdown = {
    video_length_seconds: r.seconds,
    formats,
    credits,
    rule: "1 credit per video up to 60s (2 up to 120s, 3 up to 5 min), +1 per extra format. Charged only if the render succeeds.",
  };

  if (!i.confirm || !i.quote_token) {
    const q = issueQuoteToken(ctx.signingSecret, { o: ctx.principal.orgId, u: ctx.principal.userId, p: r.project.id, s: r.storyboard.id, f: formats, c: credits });
    return {
      status: "confirmation_required" as const,
      message: `Rendering "${r.storyboard.title}" (v${r.storyboard.version}) costs ${credits} video credit${credits === 1 ? "" : "s"}. You have ${available} available. Ask the user to confirm, then call create_video again with confirm: true and this quote_token.`,
      quote: { ...breakdown, available_credits: available, enough_credits: available >= credits, storyboard_id: r.storyboard.id, quote_token: q.token, expires_at: q.expiresAt },
    };
  }

  requireScope(ctx.principal, "mcp:render");
  const q = verifyQuoteToken(ctx.signingSecret, i.quote_token);
  if (q.o !== ctx.principal.orgId || q.u !== ctx.principal.userId || q.p !== r.project.id || q.s !== r.storyboard.id || q.f.join() !== formats.join()) {
    throw invalid("This quote was issued for a different video. Request a new quote.");
  }
  if (q.c !== credits) throw new AppError("conflict", `The price changed (quoted ${q.c}, now ${credits}). Request a new quote.`);

  const job = await ctx.db.system(async (sys) => {
    await sys.query("select pg_advisory_xact_lock(hashtext($1))", [`credits:${ctx.principal.orgId}`]);
    const [existing] = await sys.query<JobRow>("select * from public.jobs where org_id = $1 and kind = 'render' and idempotency_key = $2", [ctx.principal.orgId, `render:${q.n}`]);
    if (existing) return { ...presentJob(existing), duplicate: true };
    const balance = await availableVideoCredits(sys, ctx.principal.orgId, org.plan_id);
    if (balance < credits) throw new AppError("insufficient_credits", `Not enough video credits: this needs ${credits}, ${balance} available.`, { needed: credits, available: balance });
    const { job: created } = await submitJob(sys, {
      orgId: ctx.principal.orgId,
      kind: "render",
      idempotencyKey: `render:${q.n}`,
      input: { project_id: r.project.id, storyboard_id: r.storyboard.id, formats, credits, seconds: r.seconds },
      projectId: r.project.id,
      createdBy: ctx.principal.userId,
      creditsHeld: credits,
    });
    await sys.query("insert into public.credit_transactions (org_id, wallet, kind, amount, period, job_id, note) values ($1, 'video', 'hold', $2, $3, $4, $5)", [
      ctx.principal.orgId,
      -credits,
      currentPeriod(),
      created.id,
      `Hold for render of ${r.project.name}`,
    ]);
    await sys.query("update public.projects set status = 'rendering' where id = $1 and org_id = $2", [r.project.id, ctx.principal.orgId]);
    return { ...presentJob(created), duplicate: false };
  });
  return {
    status: "queued" as const,
    message: job.duplicate ? "This quote was already confirmed; returning the existing render job (no extra credits held)." : `Render queued. ${credits} credit${credits === 1 ? " is" : "s are"} held and only charged if it succeeds.`,
    job,
  };
}

export async function getRenderStatus(ctx: Ctx, jobId: string) {
  const [job] = await asUser(ctx, (sql) => sql.query<JobRow>("select * from public.jobs where org_id = $1 and id = $2", [ctx.principal.orgId, jobId]));
  if (!job) throw notFound("Job");
  const exports = job.status === "succeeded" && job.kind === "render" ? await asUser(ctx, (sql) => sql.query<{ id: string; format: string }>("select id, format from public.exports where job_id = $1 and status = 'ready'", [jobId])) : [];
  const [queuePosition] =
    job.status === "queued" ? await asUser(ctx, (sql) => sql.query<{ n: number }>("select count(*)::int as n from public.jobs where org_id = $1 and status = 'queued' and created_at < $2", [ctx.principal.orgId, job.created_at])) : [];
  return {
    ...presentJob(job),
    queue_position: queuePosition ? queuePosition.n + 1 : null,
    exports: exports.map((e) => ({ export_id: e.id, format: e.format })),
    estimated_completion: null as string | null,
    next_step:
      job.status === "succeeded" ? (job.kind === "render" ? "Call get_export with an export_id for a download link." : "Call get_media_analysis.")
      : job.status === "failed" ? (job.error?.retryable && job.kind === "render" ? "This render can be retried free of charge with retry_render." : "This job cannot be retried.")
      : "Check again shortly.",
  };
}

export async function retryRender(ctx: Ctx, jobId: string) {
  requireScope(ctx.principal, "mcp:write");
  requireScope(ctx.principal, "mcp:render");
  requireRole(ctx.principal, "editor");
  const [failed] = await asUser(ctx, (sql) => sql.query<JobRow>("select * from public.jobs where org_id = $1 and id = $2", [ctx.principal.orgId, jobId]));
  if (!failed || failed.kind !== "render") throw notFound("Render job");
  if (failed.status !== "failed") throw new AppError("conflict", `Only failed renders can be retried (this one is ${failed.status}).`);
  if (!failed.error?.retryable) throw new AppError("conflict", "This render failed in a way that a retry will not fix. Check the storyboard and footage.");
  if (failed.attempt >= failed.max_attempts) throw new AppError("conflict", `This render has already been tried ${failed.attempt} times. Contact support.`);
  const credits = Number(failed.input.credits ?? failed.credits_held);
  // Re-validate the inputs (footage could have changed since).
  await asUser(ctx, (sql) => loadRenderable(sql, ctx.principal.orgId, String(failed.input.project_id), String(failed.input.storyboard_id)));

  const job = await ctx.db.system(async (sys) => {
    await sys.query("select pg_advisory_xact_lock(hashtext($1))", [`credits:${ctx.principal.orgId}`]);
    const [existing] = await sys.query<JobRow>("select * from public.jobs where org_id = $1 and kind = 'render' and idempotency_key = $2", [ctx.principal.orgId, `retry:${failed.id}`]);
    if (existing) return { ...presentJob(existing), duplicate: true };
    const [org] = await sys.query<{ plan_id: string }>("select plan_id from public.organisations where id = $1", [ctx.principal.orgId]);
    const balance = await availableVideoCredits(sys, ctx.principal.orgId, org.plan_id);
    if (balance < credits) throw new AppError("insufficient_credits", `Not enough video credits to hold for the retry: needs ${credits}, ${balance} available.`);
    const { job: created } = await submitJob(sys, {
      orgId: ctx.principal.orgId,
      kind: "render",
      idempotencyKey: `retry:${failed.id}`,
      input: failed.input,
      projectId: failed.project_id,
      createdBy: ctx.principal.userId,
      creditsHeld: credits,
      retryOf: failed.id,
      attempt: failed.attempt + 1,
    });
    await sys.query("insert into public.credit_transactions (org_id, wallet, kind, amount, period, job_id, note) values ($1, 'video', 'hold', $2, $3, $4, 'Hold for render retry')", [
      ctx.principal.orgId,
      -credits,
      currentPeriod(),
      created.id,
    ]);
    await sys.query("update public.projects set status = 'rendering' where id = $1 and org_id = $2", [failed.project_id, ctx.principal.orgId]);
    return { ...presentJob(created), duplicate: false };
  });
  return {
    status: "queued" as const,
    message: job.duplicate
      ? "A retry for this render already exists; returning it."
      : "Retry queued. The failed attempt was not charged; credits are held again and charged once, only if this attempt succeeds.",
    job,
  };
}

/* ---- exports ------------------------------------------------------------- */

type ExportRow = { id: string; project_id: string; project_name?: string; job_id: string; storyboard_id: string | null; format: string; status: string; storage_key: string | null; mime_type: string | null; size_bytes: string | null; duration_seconds: string | null; width: number | null; height: number | null; created_at: string };

const presentExport = (e: ExportRow) => ({
  export_id: e.id,
  project_id: e.project_id,
  project_name: e.project_name ?? null,
  job_id: e.job_id,
  storyboard_id: e.storyboard_id,
  format: e.format,
  status: e.status,
  mime_type: e.mime_type,
  size_bytes: num(e.size_bytes),
  duration_seconds: num(e.duration_seconds),
  width: e.width,
  height: e.height,
  created_at: iso(e.created_at),
});

export async function listExports(ctx: Ctx, opts: { project_id?: string; status?: "ready" | "failed"; limit?: number } = {}) {
  const params: unknown[] = [ctx.principal.orgId];
  let where = "e.org_id = $1";
  if (opts.project_id) where += ` and e.project_id = $${params.push(opts.project_id)}`;
  if (opts.status) where += ` and e.status = $${params.push(opts.status)}`;
  const rows = await asUser(ctx, (sql) =>
    sql.query<ExportRow>(`select e.*, p.name as project_name from public.exports e join public.projects p on p.id = e.project_id where ${where} order by e.created_at desc limit ${Math.min(opts.limit ?? 20, 50)}`, params),
  );
  const failedRenders = await asUser(ctx, (sql) =>
    sql.query<JobRow>(`select * from public.jobs where org_id = $1 and kind = 'render' and status = 'failed' ${opts.project_id ? "and project_id = $2" : ""} order by created_at desc limit 10`, opts.project_id ? [ctx.principal.orgId, opts.project_id] : [ctx.principal.orgId]),
  );
  return { exports: rows.map(presentExport), failed_renders: opts.status === "ready" ? [] : failedRenders.map(presentJob) };
}

export async function getExport(ctx: Ctx, exportId: string, opts: { includeDownloadUrl?: boolean } = {}) {
  const [e] = await asUser(ctx, (sql) =>
    sql.query<ExportRow>("select e.*, p.name as project_name from public.exports e join public.projects p on p.id = e.project_id where e.org_id = $1 and e.id = $2", [ctx.principal.orgId, exportId]),
  );
  if (!e) throw notFound("Export");
  let download: { url: string; expires_at: string } | null = null;
  if (e.status === "ready" && e.storage_key && opts.includeDownloadUrl !== false) {
    const safeName = `${(e.project_name ?? "video").replace(/[^A-Za-z0-9 _-]/g, "").trim().replace(/\s+/g, "-").toLowerCase() || "video"}-${e.format.replace(":", "x")}.mp4`;
    const signed = await ctx.storage.signedGetUrl(e.storage_key, { ttlSeconds: ctx.signedUrlTtlSeconds, filename: safeName });
    download = { url: signed.url, expires_at: signed.expiresAt };
  }
  return { ...presentExport(e), download };
}
