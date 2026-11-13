import { randomUUID } from "node:crypto";
import { getPlan } from "@/lib/pricing";
import { z } from "zod";
import { asUser, iso, num, type Ctx } from "../context";
import { requireRole, requireScope } from "../auth/principal";
import { AppError, invalid, notFound, toAppError, unavailable, parseInput } from "../errors";
import { mediaKey } from "../storage/types";
import { mediaToolsAvailable } from "../workers/ffmpeg";
import { currentPeriod } from "./usage";
import { presentJob, submitJob, type JobRow } from "./jobs";

/*
  Media library: search, details, uploads and analysis requests. Storage keys and
  permanent URLs are never returned; previews and downloads are short-lived signed URLs.
*/

export const UPLOAD_TYPES: Record<string, { ext: string; kind: "video" | "image" | "audio"; maxBytes: number }> = {
  "video/mp4": { ext: "mp4", kind: "video", maxBytes: 5e9 },
  "video/quicktime": { ext: "mov", kind: "video", maxBytes: 5e9 },
  "video/webm": { ext: "webm", kind: "video", maxBytes: 5e9 },
  "image/jpeg": { ext: "jpg", kind: "image", maxBytes: 5e7 },
  "image/png": { ext: "png", kind: "image", maxBytes: 5e7 },
  "image/webp": { ext: "webp", kind: "image", maxBytes: 5e7 },
  "audio/mpeg": { ext: "mp3", kind: "audio", maxBytes: 5e8 },
  "audio/wav": { ext: "wav", kind: "audio", maxBytes: 5e8 },
  "audio/aac": { ext: "aac", kind: "audio", maxBytes: 5e8 },
};

const RATIOS: Record<string, number> = { "9:16": 9 / 16, "1:1": 1, "16:9": 16 / 9, "4:5": 4 / 5 };

export const SearchInput = z.object({
  query: z.string().trim().max(300).optional(),
  kind: z.enum(["video", "image", "audio"]).optional(),
  orientation: z.enum(["landscape", "portrait", "square"]).optional(),
  aspect_ratio: z.enum(["9:16", "1:1", "16:9", "4:5"]).optional(),
  min_duration_seconds: z.number().min(0).optional(),
  max_duration_seconds: z.number().min(0).optional(),
  tags: z.array(z.string().trim().min(1).max(60)).max(10).optional(),
  brand_id: z.uuid().optional(),
  project_id: z.uuid().optional(),
  status: z.enum(["awaiting_upload", "uploaded", "analysing", "ready", "failed"]).optional(),
  sort: z.enum(["relevance", "best_quality", "newest", "longest"]).optional(),
  limit: z.number().int().min(1).max(50).optional(),
  offset: z.number().int().min(0).max(10000).optional(),
});
export type SearchInput = z.infer<typeof SearchInput>;

type MediaRow = {
  id: string; title: string; description: string | null; kind: string; mime_type: string; size_bytes: string | number | null;
  duration_seconds: string | number | null; width: number | null; height: number | null; orientation: string | null; status: string;
  storage_key: string; original_filename: string | null; tags: string[]; ai_tags: string[]; usage_rights: string | null; brand_id: string | null;
  created_at: string; updated_at: string; relevance?: number | null; quality_score?: number | null; analysed?: boolean;
};

function summary(m: MediaRow) {
  return {
    id: m.id,
    title: m.title,
    description: m.description && m.description.length > 300 ? m.description.slice(0, 297) + "…" : m.description,
    kind: m.kind,
    status: m.status,
    duration_seconds: num(m.duration_seconds),
    width: m.width,
    height: m.height,
    orientation: m.orientation,
    tags: m.tags,
    ai_tags: m.ai_tags,
    analysed: Boolean(m.analysed),
    quality_score: num(m.quality_score),
    relevance: m.relevance === undefined || m.relevance === null ? null : Math.round(Number(m.relevance) * 1000) / 1000,
  };
}

export async function searchMedia(ctx: Ctx, raw: SearchInput) {
  const f = parseInput(SearchInput, raw);
  const params: unknown[] = [ctx.principal.orgId];
  const where = ["m.org_id = $1"];
  const p = (v: unknown) => `$${params.push(v)}`;
  let rank = "null::real";
  if (f.query) {
    const q = p(f.query);
    // Match on all words first; fall back to any word so loose queries still find footage.
    where.push(`(m.search @@ websearch_to_tsquery('english', ${q}) or m.search @@ to_tsquery('english', coalesce(nullif(array_to_string(tsvector_to_array(to_tsvector('english', ${q})), ' | '), ''), 'x')))`);
    rank = `ts_rank(m.search, to_tsquery('english', coalesce(nullif(array_to_string(tsvector_to_array(to_tsvector('english', ${q})), ' | '), ''), 'x')))`;
  }
  if (f.kind) where.push(`m.kind = ${p(f.kind)}`);
  if (f.orientation) where.push(`m.orientation = ${p(f.orientation)}`);
  if (f.aspect_ratio) where.push(`m.width is not null and abs(m.width::numeric / m.height - ${p(RATIOS[f.aspect_ratio])}) < 0.03`);
  if (f.min_duration_seconds !== undefined) where.push(`m.duration_seconds >= ${p(f.min_duration_seconds)}`);
  if (f.max_duration_seconds !== undefined) where.push(`m.duration_seconds <= ${p(f.max_duration_seconds)}`);
  if (f.tags?.length) where.push(`(m.tags && ${p(f.tags.map((t) => t.toLowerCase()))}::text[] or m.ai_tags && $${params.length}::text[])`);
  if (f.brand_id) where.push(`m.brand_id = ${p(f.brand_id)}`);
  if (f.project_id) where.push(`exists (select 1 from public.project_media pm where pm.media_id = m.id and pm.project_id = ${p(f.project_id)})`);
  if (f.status) where.push(`m.status = ${p(f.status)}`);
  const order =
    f.sort === "newest" ? "m.created_at desc"
    : f.sort === "longest" ? "m.duration_seconds desc nulls last"
    : f.sort === "best_quality" ? "quality_score desc nulls last, relevance desc nulls last"
    : f.query ? "relevance desc nulls last, quality_score desc nulls last" : "m.created_at desc";
  const limit = f.limit ?? 20;
  const rows = await asUser(ctx, (sql) =>
    sql.query<MediaRow>(
      `select m.*, ${rank} as relevance, a.quality_score, (a.id is not null) as analysed
         from public.media_assets m
         left join lateral (select ma.id, (ma.quality ->> 'score')::numeric as quality_score from public.media_analysis ma
                             where ma.media_id = m.id order by ma.created_at desc limit 1) a on true
        where ${where.join(" and ")}
        order by ${order}
        limit ${limit + 1} offset ${f.offset ?? 0}`,
      params,
    ),
  );
  return {
    results: rows.slice(0, limit).map(summary),
    has_more: rows.length > limit,
    next_offset: rows.length > limit ? (f.offset ?? 0) + limit : null,
    search_method: f.query ? "full-text (title, tags, AI tags, description)" : "filters only",
  };
}

async function loadMedia(ctx: Ctx, id: string) {
  const [m] = await asUser(ctx, (sql) => sql.query<MediaRow>("select * from public.media_assets where org_id = $1 and id = $2", [ctx.principal.orgId, id]));
  if (!m) throw notFound("Media asset");
  return m;
}

export async function getMediaDetails(ctx: Ctx, id: string, opts: { includePreviewUrl?: boolean } = {}) {
  const m = await loadMedia(ctx, id);
  const extra = await asUser(ctx, async (sql) => {
    const [analysis] = await sql.query<{ id: string; created_at: string; technical: Record<string, unknown>; scenes: unknown[]; quality: Record<string, unknown>; ai: Record<string, unknown> | null }>(
      "select id, created_at, technical, scenes, quality, ai from public.media_analysis where org_id = $1 and media_id = $2 order by created_at desc limit 1",
      [ctx.principal.orgId, id],
    );
    const projects = await sql.query<{ id: string; name: string }>(
      "select p.id, p.name from public.project_media pm join public.projects p on p.id = pm.project_id where pm.org_id = $1 and pm.media_id = $2 order by p.name",
      [ctx.principal.orgId, id],
    );
    const [pending] = await sql.query<JobRow>("select * from public.jobs where org_id = $1 and media_id = $2 and kind = 'media_analysis' and status in ('queued', 'running') order by created_at desc limit 1", [ctx.principal.orgId, id]);
    return { analysis, projects, pending };
  });
  const canPreview = opts.includePreviewUrl && (m.status === "uploaded" || m.status === "ready" || m.status === "analysing");
  const preview = canPreview ? await ctx.storage.signedGetUrl(m.storage_key, { ttlSeconds: ctx.signedUrlTtlSeconds, filename: m.original_filename ?? undefined }) : null;
  return {
    ...summary(m),
    description: m.description,
    file: { mime_type: m.mime_type, size_bytes: num(m.size_bytes), original_filename: m.original_filename, storage: "private (signed URLs only)" },
    usage_rights: m.usage_rights,
    brand_id: m.brand_id,
    projects: extra.projects,
    analysis: extra.analysis
      ? {
          analysis_id: extra.analysis.id,
          analysed_at: iso(extra.analysis.created_at),
          scene_count: Array.isArray(extra.analysis.scenes) ? extra.analysis.scenes.length : 0,
          quality: extra.analysis.quality,
          ai_summary: (extra.analysis.ai as { summary?: string } | null)?.summary ?? null,
        }
      : null,
    analysis_in_progress: extra.pending ? presentJob(extra.pending) : null,
    preview_url: preview ? { url: preview.url, expires_at: preview.expiresAt } : null,
    created_at: iso(m.created_at),
    updated_at: iso(m.updated_at),
  };
}

/* ---- uploads ----------------------------------------------------------- */

export const UploadInput = z.object({
  title: z.string().trim().min(1).max(200),
  filename: z.string().trim().min(1).max(255),
  content_type: z.string(),
  size_bytes: z.number().int().positive(),
  description: z.string().trim().max(2000).optional(),
  tags: z.array(z.string().trim().min(1).max(60)).max(20).optional(),
  brand_id: z.uuid().optional(),
  usage_rights: z.string().trim().max(500).optional(),
});

export async function createMediaUpload(ctx: Ctx, raw: z.infer<typeof UploadInput>) {
  requireScope(ctx.principal, "mcp:write");
  requireRole(ctx.principal, "editor");
  const u = parseInput(UploadInput, raw);
  const type = UPLOAD_TYPES[u.content_type];
  if (!type) throw invalid(`File type not supported. Allowed: ${Object.keys(UPLOAD_TYPES).join(", ")}`);
  if (u.size_bytes > type.maxBytes) throw invalid(`File is too large (max ${Math.round(type.maxBytes / 1e6)} MB for ${type.kind})`);
  const id = randomUUID();
  const key = mediaKey(ctx.principal.orgId, id, type.ext);
  try {
    await asUser(ctx, (sql) =>
      sql.query(
        `insert into public.media_assets (id, org_id, title, description, kind, mime_type, size_bytes, storage_key, original_filename, tags, brand_id, usage_rights, created_by)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
        [id, ctx.principal.orgId, u.title, u.description ?? null, type.kind, u.content_type, u.size_bytes, key, u.filename, (u.tags ?? []).map((t) => t.toLowerCase()), u.brand_id ?? null, u.usage_rights ?? null, ctx.principal.userId],
      ),
    );
  } catch (e) {
    throw toAppError(e);
  }
  const put = await ctx.storage.signedPutUrl(key, { ttlSeconds: Math.max(ctx.signedUrlTtlSeconds, 900), contentType: u.content_type });
  return {
    media_id: id,
    status: "awaiting_upload",
    upload: { method: "PUT", url: put.url, expires_at: put.expiresAt, headers: { "content-type": u.content_type } },
    next_step: "PUT the file bytes to upload.url with the content-type header, then call complete_media_upload with this media_id.",
  };
}

export async function completeMediaUpload(ctx: Ctx, id: string) {
  requireScope(ctx.principal, "mcp:write");
  requireRole(ctx.principal, "editor");
  const m = await loadMedia(ctx, id);
  if (m.status !== "awaiting_upload") throw new AppError("conflict", `This upload is already ${m.status}`);
  const head = await ctx.storage.head(m.storage_key);
  if (!head) throw invalid("The file has not been uploaded yet (nothing found at the upload URL)");
  const type = UPLOAD_TYPES[m.mime_type];
  const tooBig = !type || head.size > type.maxBytes;
  await asUser(ctx, (sql) =>
    sql.query("update public.media_assets set status = $3, size_bytes = $4 where org_id = $1 and id = $2", [ctx.principal.orgId, id, tooBig ? "failed" : "uploaded", head.size]),
  );
  if (tooBig) throw invalid("The uploaded file is larger than allowed and was rejected");
  return { media_id: id, status: "uploaded", size_bytes: head.size, next_step: "Call analyse_media to extract duration, scenes and quality." };
}

/* ---- analysis ---------------------------------------------------------- */

export async function requestAnalysis(ctx: Ctx, id: string) {
  requireScope(ctx.principal, "mcp:write");
  requireRole(ctx.principal, "editor");
  const m = await loadMedia(ctx, id); // ownership check in user context
  if (m.kind !== "video") throw invalid("Analysis currently supports video files only");
  if (m.status === "awaiting_upload") throw invalid("Finish the upload first (complete_media_upload)");
  if (!(await mediaToolsAvailable(ctx.media))) throw unavailable("Media analysis is not available on this server (FFmpeg is not installed).");
  if (!(await ctx.storage.head(m.storage_key))) throw invalid("The original file is missing from storage");

  return ctx.db.system(async (sys) => {
    // Analysis allowance (minutes per month, config/pricing.json).
    const [org] = await sys.query<{ plan_id: string }>("select plan_id from public.organisations where id = $1", [ctx.principal.orgId]);
    const allowanceSeconds = (getPlan(org.plan_id)?.analysisMinutes ?? 0) * 60;
    const [used] = await sys.query<{ s: number }>(
      "select coalesce(-sum(amount), 0)::int as s from public.credit_transactions where org_id = $1 and wallet = 'analysis' and kind = 'charge' and period = $2",
      [ctx.principal.orgId, currentPeriod()],
    );
    const needed = Math.ceil(num(m.duration_seconds) ?? 0);
    if (allowanceSeconds && used.s + needed > allowanceSeconds) {
      throw new AppError("insufficient_credits", "Your plan's media analysis allowance for this month is used up.", { allowance_minutes: allowanceSeconds / 60, used_minutes: Math.round(used.s / 60) });
    }
    // One active analysis per asset: re-requests while queued/running return the same job.
    const [active] = await sys.query<JobRow>("select * from public.jobs where org_id = $1 and media_id = $2 and kind = 'media_analysis' and status in ('queued', 'running') limit 1", [ctx.principal.orgId, id]);
    if (active) return { ...presentJob(active), duplicate: true };
    const [{ n }] = await sys.query<{ n: number }>("select count(*)::int as n from public.jobs where org_id = $1 and media_id = $2 and kind = 'media_analysis'", [ctx.principal.orgId, id]);
    const { job, duplicate } = await submitJob(sys, {
      orgId: ctx.principal.orgId,
      kind: "media_analysis",
      idempotencyKey: `analysis:${id}:${n + 1}`,
      input: { media_id: id },
      mediaId: id,
      createdBy: ctx.principal.userId,
    });
    await sys.query("update public.media_assets set status = 'analysing' where id = $1 and org_id = $2", [id, ctx.principal.orgId]);
    return { ...presentJob(job), duplicate };
  });
}

export async function getMediaAnalysis(ctx: Ctx, id: string, opts: { includeThumbnailUrls?: boolean } = {}) {
  await loadMedia(ctx, id);
  const [row] = await asUser(ctx, (sql) =>
    sql.query<{ id: string; job_id: string | null; created_at: string; technical: Record<string, unknown>; scenes: { start: number; end: number; thumbnail_key?: string; description?: string }[]; quality: Record<string, unknown>; ai: Record<string, unknown> | null }>(
      "select * from public.media_analysis where org_id = $1 and media_id = $2 order by created_at desc limit 1",
      [ctx.principal.orgId, id],
    ),
  );
  if (!row) {
    const [job] = await asUser(ctx, (sql) => sql.query<JobRow>("select * from public.jobs where org_id = $1 and media_id = $2 and kind = 'media_analysis' order by created_at desc limit 1", [ctx.principal.orgId, id]));
    return { media_id: id, status: job ? job.status : "not_analysed", job: job ? presentJob(job) : null, analysis: null };
  }
  const scenes = await Promise.all(
    row.scenes.map(async ({ thumbnail_key, ...s }) => ({
      ...s,
      ...(opts.includeThumbnailUrls && thumbnail_key ? { thumbnail_url: (await ctx.storage.signedGetUrl(thumbnail_key, { ttlSeconds: ctx.signedUrlTtlSeconds })).url } : {}),
    })),
  );
  return {
    media_id: id,
    status: "analysed",
    analysis: {
      analysis_id: row.id,
      job_id: row.job_id,
      analysed_at: iso(row.created_at),
      technical: row.technical,
      quality: row.quality,
      scenes,
      ai: row.ai ?? { status: "not run", reason: "AI description runs only when the workspace has consented to AI media analysis and AI is configured." },
    },
  };
}
