import { z } from "zod";
import { asUser, iso, num, type Ctx } from "../context";
import { requireRole, requireScope } from "../auth/principal";
import type { Sql } from "../db/types";
import { AppError, invalid, notFound, toAppError, parseInput } from "../errors";
import { presentJob, type JobRow } from "./jobs";

/* Video projects and storyboards. */

export const FORMATS = ["9:16", "1:1", "16:9", "4:5"] as const;

export const ProjectInput = z.object({
  name: z.string().trim().min(1).max(160),
  brand_id: z.uuid().optional(),
  objective: z.string().trim().max(500).optional(),
  audience: z.string().trim().max(500).optional(),
  description: z.string().trim().max(4000).optional(),
  platform: z.string().trim().max(80).optional(),
  formats: z.array(z.enum(FORMATS)).min(1).max(4).optional(),
  duration_seconds: z.number().int().min(5).max(300).optional(),
  media_ids: z.array(z.uuid()).max(100).optional(),
});
export type ProjectInput = z.infer<typeof ProjectInput>;

type ProjectRow = {
  id: string; name: string; status: string; objective: string | null; audience: string | null; description: string | null; platform: string | null;
  formats: string[]; duration_seconds: number | null; brand_id: string | null; brand_name?: string | null; created_at: string; updated_at: string;
  media_count?: number; storyboard_count?: number;
};

export async function listProjects(ctx: Ctx, opts: { status?: string; limit?: number; offset?: number } = {}) {
  const params: unknown[] = [ctx.principal.orgId];
  let where = "p.org_id = $1";
  if (opts.status) where += ` and p.status = $${params.push(opts.status)}`;
  const limit = Math.min(opts.limit ?? 20, 50);
  const rows = await asUser(ctx, (sql) =>
    sql.query<ProjectRow>(
      `select p.*, b.name as brand_name,
              (select count(*) from public.project_media pm where pm.project_id = p.id)::int as media_count,
              (select count(*) from public.storyboards s where s.project_id = p.id)::int as storyboard_count
         from public.projects p left join public.brand_profiles b on b.id = p.brand_id
        where ${where} order by p.updated_at desc limit ${limit + 1} offset ${opts.offset ?? 0}`,
      params,
    ),
  );
  return {
    projects: rows.slice(0, limit).map((p) => ({
      id: p.id, name: p.name, status: p.status, brand: p.brand_id ? { id: p.brand_id, name: p.brand_name } : null,
      formats: p.formats, duration_seconds: p.duration_seconds, media_count: p.media_count, storyboard_count: p.storyboard_count, updated_at: iso(p.updated_at),
    })),
    has_more: rows.length > limit,
  };
}

export async function loadProject(sql: Sql, orgId: string, id: string) {
  const [p] = await sql.query<ProjectRow>(
    "select p.*, b.name as brand_name from public.projects p left join public.brand_profiles b on b.id = p.brand_id where p.org_id = $1 and p.id = $2",
    [orgId, id],
  );
  if (!p) throw notFound("Project");
  return p;
}

export async function getProject(ctx: Ctx, id: string) {
  return asUser(ctx, async (sql) => {
    const p = await loadProject(sql, ctx.principal.orgId, id);
    const media = await sql.query<{ id: string; title: string; kind: string; status: string; duration_seconds: string | null; orientation: string | null }>(
      `select m.id, m.title, m.kind, m.status, m.duration_seconds, m.orientation from public.project_media pm join public.media_assets m on m.id = pm.media_id
        where pm.project_id = $1 order by pm.added_at`,
      [id],
    );
    const briefs = await sql.query<{ id: string; brief: Record<string, unknown>; source: string; created_at: string }>("select id, brief, source, created_at from public.video_briefs where project_id = $1 order by created_at desc limit 3", [id]);
    const [concepts] = await sql.query<{ id: string; concepts: unknown; created_at: string }>("select id, concepts, created_at from public.video_concepts where project_id = $1 order by created_at desc limit 1", [id]);
    const boards = await sql.query<{ id: string; version: number; title: string; format: string; total_duration_seconds: string; scenes: unknown[]; source: string; created_at: string }>(
      "select id, version, title, format, total_duration_seconds, scenes, source, created_at from public.storyboards where project_id = $1 order by version desc",
      [id],
    );
    const jobs = await sql.query<JobRow>("select * from public.jobs where project_id = $1 and kind = 'render' order by created_at desc limit 5", [id]);
    const exports = await sql.query<{ id: string; format: string; status: string; created_at: string; job_id: string }>("select id, format, status, created_at, job_id from public.exports where project_id = $1 order by created_at desc limit 10", [id]);
    const latest = boards[0];
    return {
      id: p.id, name: p.name, status: p.status,
      brand: p.brand_id ? { id: p.brand_id, name: p.brand_name } : null,
      brief: { objective: p.objective, audience: p.audience, description: p.description, platform: p.platform },
      formats: p.formats, duration_seconds: p.duration_seconds,
      media: media.map((m) => ({ ...m, duration_seconds: num(m.duration_seconds) })),
      latest_briefs: briefs.map((b) => ({ id: b.id, source: b.source, created_at: iso(b.created_at), brief: b.brief })),
      latest_concepts: concepts ? { id: concepts.id, created_at: iso(concepts.created_at), concepts: concepts.concepts } : null,
      storyboard: latest
        ? { id: latest.id, version: latest.version, title: latest.title, format: latest.format, total_duration_seconds: num(latest.total_duration_seconds), source: latest.source, scenes: latest.scenes, created_at: iso(latest.created_at) }
        : null,
      storyboard_versions: boards.map((b) => ({ id: b.id, version: b.version, title: b.title, source: b.source, created_at: iso(b.created_at) })),
      renders: jobs.map(presentJob),
      exports: exports.map((e) => ({ ...e, created_at: iso(e.created_at) })),
      created_at: iso(p.created_at), updated_at: iso(p.updated_at),
    };
  });
}

export async function createProject(ctx: Ctx, raw: ProjectInput) {
  requireScope(ctx.principal, "mcp:write");
  requireRole(ctx.principal, "editor");
  const i = parseInput(ProjectInput, raw);
  try {
    const id = await asUser(ctx, async (sql) => {
      if (i.brand_id) {
        const [b] = await sql.query("select 1 from public.brand_profiles where org_id = $1 and id = $2", [ctx.principal.orgId, i.brand_id]);
        if (!b) throw notFound("Brand profile");
      }
      const mediaIds = [...new Set(i.media_ids ?? [])];
      if (mediaIds.length) {
        const found = await sql.query<{ id: string }>("select id from public.media_assets where org_id = $1 and id = any($2::uuid[])", [ctx.principal.orgId, mediaIds]);
        const missing = mediaIds.filter((m) => !found.some((f) => f.id === m));
        if (missing.length) throw new AppError("not_found", "Some media assets were not found, or you do not have access to them", { media_ids: missing });
      }
      const [p] = await sql.query<{ id: string }>(
        `insert into public.projects (org_id, brand_id, name, objective, audience, description, platform, formats, duration_seconds, created_by)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) returning id`,
        [ctx.principal.orgId, i.brand_id ?? null, i.name, i.objective ?? null, i.audience ?? null, i.description ?? null, i.platform ?? null, i.formats ?? ["9:16"], i.duration_seconds ?? null, ctx.principal.userId],
      );
      for (const m of mediaIds) await sql.query("insert into public.project_media (project_id, media_id, org_id) values ($1, $2, $3)", [p.id, m, ctx.principal.orgId]);
      return p.id;
    });
    return getProject(ctx, id);
  } catch (e) {
    throw toAppError(e);
  }
}

/* ---- storyboards ------------------------------------------------------- */

export const SceneInput = z.object({
  duration_seconds: z.number().min(0.5).max(60),
  purpose: z.string().trim().max(300).optional(),
  on_screen_text: z.string().trim().max(80).nullable().optional(),
  voiceover: z.string().trim().max(600).nullable().optional(),
  visual_description: z.string().trim().max(600).optional(),
  asset_id: z.uuid().nullable().optional(),
  source_in_seconds: z.number().min(0).nullable().optional(),
  transition: z.enum(["cut", "dissolve", "fade"]).optional(),
  audio_notes: z.string().trim().max(300).nullable().optional(),
});
export type SceneInput = z.infer<typeof SceneInput>;

export type Scene = {
  scene_number: number;
  duration_seconds: number;
  purpose: string | null;
  on_screen_text: string | null;
  voiceover: string | null;
  visual_description: string | null;
  asset_id: string | null;
  asset_title?: string;
  source_in_seconds: number | null;
  transition: "cut" | "dissolve" | "fade";
  audio_notes: string | null;
};

/**
 * Check scenes against the organisation's real footage. strict: reject problems
 * (client-submitted storyboards). lenient: repair and warn (AI output).
 */
export async function validateScenes(sql: Sql, orgId: string, scenes: (SceneInput | Scene)[], mode: "strict" | "lenient") {
  const warnings: string[] = [];
  const ids = [...new Set(scenes.map((s) => s.asset_id).filter((x): x is string => Boolean(x)))];
  const assets = ids.length
    ? await sql.query<{ id: string; title: string; kind: string; status: string; duration_seconds: string | null }>(
        "select id, title, kind, status, duration_seconds from public.media_assets where org_id = $1 and id = any($2::uuid[])",
        [orgId, ids],
      )
    : [];
  const out: Scene[] = scenes.map((s, i) => {
    const n = i + 1;
    let assetId = s.asset_id ?? null;
    let sourceIn = s.source_in_seconds ?? null;
    let duration = Math.round(s.duration_seconds * 100) / 100;
    const asset = assetId ? assets.find((a) => a.id === assetId) : undefined;
    const fail = (msg: string) => {
      if (mode === "strict") throw invalid(`Scene ${n}: ${msg}`);
      warnings.push(`Scene ${n}: ${msg}`);
    };
    if (assetId && !asset) {
      fail("the referenced footage was not found in this workspace; the scene has no footage");
      assetId = null;
      sourceIn = null;
    } else if (asset) {
      const assetDuration = num(asset.duration_seconds);
      if (asset.kind !== "video") fail(`"${asset.title}" is not a video`);
      if (!["uploaded", "ready"].includes(asset.status)) fail(`"${asset.title}" is not ready (status: ${asset.status})`);
      if (assetDuration === null) fail(`"${asset.title}" has no known duration yet; analyse it first`);
      else {
        sourceIn = sourceIn ?? 0;
        if (duration > assetDuration) {
          fail(`"${asset.title}" is only ${assetDuration}s long; scene shortened to fit`);
          duration = Math.floor(assetDuration * 100) / 100;
        }
        if (sourceIn + duration > assetDuration + 0.05) {
          fail(`start ${sourceIn}s + ${duration}s runs past the end of "${asset.title}" (${assetDuration}s); start moved earlier`);
          sourceIn = Math.max(0, Math.floor((assetDuration - duration) * 100) / 100);
        }
      }
    }
    if (!assetId && !s.on_screen_text) fail("needs footage or on-screen text");
    return {
      scene_number: n,
      duration_seconds: duration,
      purpose: s.purpose ?? null,
      on_screen_text: s.on_screen_text ?? null,
      voiceover: s.voiceover ?? null,
      visual_description: s.visual_description ?? null,
      asset_id: assetId,
      ...(asset && assetId ? { asset_title: asset.title } : {}),
      source_in_seconds: assetId ? sourceIn : null,
      transition: s.transition ?? "cut",
      audio_notes: s.audio_notes ?? null,
    };
  });
  const total = Math.round(out.reduce((a, s) => a + s.duration_seconds, 0) * 100) / 100;
  if (total > 300) throw invalid("Storyboards can be at most 300 seconds long");
  const renderable = out.every((s) => s.asset_id || s.on_screen_text);
  return { scenes: out, total, warnings, renderable };
}

export async function saveStoryboard(
  ctx: Ctx,
  sb: { projectId: string; title: string; format: (typeof FORMATS)[number]; scenes: Scene[]; total: number; source: "ai" | "client"; model?: string | null; renderable: boolean },
) {
  return asUser(ctx, async (sql) => {
    await loadProject(sql, ctx.principal.orgId, sb.projectId);
    const [{ v }] = await sql.query<{ v: number }>("select coalesce(max(version), 0)::int + 1 as v from public.storyboards where project_id = $1", [sb.projectId]);
    const [row] = await sql.query<{ id: string; version: number; created_at: string }>(
      `insert into public.storyboards (org_id, project_id, version, title, format, total_duration_seconds, scenes, source, model, created_by)
       values ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9, $10) returning id, version, created_at`,
      [ctx.principal.orgId, sb.projectId, v, sb.title, sb.format, sb.total, JSON.stringify(sb.scenes), sb.source, sb.model ?? null, ctx.principal.userId],
    );
    await sql.query("update public.projects set status = $3 where org_id = $1 and id = $2 and status in ('draft', 'storyboarding', 'ready_to_render', 'completed')", [
      ctx.principal.orgId,
      sb.projectId,
      sb.renderable ? "ready_to_render" : "storyboarding",
    ]);
    return { storyboard_id: row.id, version: row.version, created_at: iso(row.created_at) };
  });
}

export const SubmitStoryboardInput = z.object({
  project_id: z.uuid(),
  title: z.string().trim().min(1).max(160),
  format: z.enum(FORMATS),
  scenes: z.array(SceneInput).min(1).max(30),
});

/** A storyboard written by the client (e.g. by the AI assistant connected over MCP), validated against real footage. */
export async function submitStoryboard(ctx: Ctx, raw: z.infer<typeof SubmitStoryboardInput>) {
  requireScope(ctx.principal, "mcp:write");
  requireRole(ctx.principal, "editor");
  const i = parseInput(SubmitStoryboardInput, raw);
  const v = await asUser(ctx, async (sql) => {
    await loadProject(sql, ctx.principal.orgId, i.project_id);
    return validateScenes(sql, ctx.principal.orgId, i.scenes, "strict");
  });
  const saved = await saveStoryboard(ctx, { projectId: i.project_id, title: i.title, format: i.format, scenes: v.scenes, total: v.total, source: "client", renderable: v.renderable });
  return { ...saved, project_id: i.project_id, title: i.title, format: i.format, total_duration_seconds: v.total, renderable: v.renderable, scenes: v.scenes, warnings: v.warnings };
}
