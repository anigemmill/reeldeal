"use server";

import { withCtx } from "@/server/app/result";
import { getMediaDetails } from "@/server/services/media";
import { createProject, getStoryboard, submitStoryboard, toSceneInput } from "@/server/services/projects";

/* Studio actions: thin wrappers over the shared project and media services. */

export async function loadVersion(projectId: string, storyboardId: string) {
  return withCtx((ctx) => getStoryboard(ctx, projectId, storyboardId));
}

/** Restoring a version saves its scenes as a NEW version, so history is never rewritten. */
export async function restoreVersion(projectId: string, storyboardId: string) {
  return withCtx(async (ctx) => {
    const sb = await getStoryboard(ctx, projectId, storyboardId);
    return submitStoryboard(ctx, { project_id: projectId, title: sb.title, format: sb.format as "9:16", scenes: sb.scenes.map(toSceneInput) });
  });
}

/** Short-lived signed links to play the source clips of a storyboard's scenes. */
export async function scenePreviews(mediaIds: string[]) {
  return withCtx(async (ctx) => {
    const out: Record<string, string | null> = {};
    for (const id of [...new Set(mediaIds)].slice(0, 30)) {
      const d = await getMediaDetails(ctx, id, { includePreviewUrl: true }).catch(() => null);
      out[id] = (d?.preview_url as { url: string } | null)?.url ?? null;
    }
    return out;
  });
}

export async function newStudioProject(name: string, format: "9:16" | "1:1" | "16:9" | "4:5") {
  return withCtx(async (ctx) => {
    const p = await createProject(ctx, { name: name.trim() || "Untitled project", formats: [format] });
    return { project_id: p.id };
  });
}
