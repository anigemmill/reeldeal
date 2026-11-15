"use server";

import { withCtx } from "@/server/app/result";
import { createVideoBrief, generateStoryboard, generateVideoConcepts } from "@/server/services/creative";
import { mediaThumbnails } from "@/server/services/media";
import { createProject, getProject, submitStoryboard, type FORMATS, type SceneInput } from "@/server/services/projects";

/*
  Creative workflow for Autopilot and Studio: the same shared creative and project
  services the MCP tools call. Each step is one real request; the browser shows a
  stage as running exactly while its request is in flight. Nothing here is billed.
*/

type Format = (typeof FORMATS)[number];

export async function startProject(input: { request: string; brand_id?: string; media_ids: string[]; objective: string; audience?: string; formats: Format[]; duration_seconds: number }) {
  return withCtx(async (ctx) => {
    const words = input.request.trim().split(/\s+/).slice(0, 7).join(" ");
    const name = words.length > 3 ? `${words}${input.request.trim().split(/\s+/).length > 7 ? "…" : ""}` : "Autopilot video";
    const p = await createProject(ctx, {
      name: name.slice(0, 160),
      brand_id: input.brand_id,
      objective: input.objective,
      audience: input.audience || undefined,
      description: input.request,
      formats: input.formats,
      duration_seconds: input.duration_seconds,
      media_ids: input.media_ids,
    });
    return { project_id: p.id };
  });
}

export async function writeBrief(projectId: string, request: string) {
  return withCtx((ctx) => createVideoBrief(ctx, { project_id: projectId, request }));
}

export async function writeConcepts(briefId: string, count: number) {
  return withCtx((ctx) => generateVideoConcepts(ctx, { brief_id: briefId, count }));
}

export async function writeStoryboard(input: { project_id: string; brief_id?: string; concepts_id?: string; concept_index?: number; base_storyboard_id?: string; direction?: string }) {
  return withCtx((ctx) => generateStoryboard(ctx, input));
}

export async function saveScenes(input: { project_id: string; title: string; format: Format; scenes: SceneInput[] }) {
  return withCtx((ctx) => submitStoryboard(ctx, input));
}

/** Everything the Autopilot review and Studio need about one project, with short-lived thumbnails. */
export async function projectState(projectId: string) {
  return withCtx(async (ctx) => {
    const project = await getProject(ctx, projectId);
    const scenes = (project.storyboard?.scenes ?? []) as { asset_id: string | null }[];
    const ids = [...scenes.map((s) => s.asset_id), ...project.media.map((m) => m.id)].filter((x): x is string => Boolean(x));
    return { project, thumbnails: await mediaThumbnails(ctx, ids) };
  });
}
