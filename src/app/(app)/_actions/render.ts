"use server";

import { withCtx } from "@/server/app/result";
import { createVideo, getExport, getRenderStatus, retryRender } from "@/server/services/render";
import type { FORMATS } from "@/server/services/projects";

/*
  Rendering from the web app: the same two-step, server-quoted flow as MCP.
  quoteRender never starts work; confirmRender needs the server-signed quote.
*/
export async function quoteRender(projectId: string, storyboardId: string, formats?: (typeof FORMATS)[number][]) {
  return withCtx(async (ctx) => {
    const r = await createVideo(ctx, { project_id: projectId, storyboard_id: storyboardId, formats });
    if (r.status !== "confirmation_required") throw new Error("unexpected render state");
    return r.quote;
  });
}

export async function confirmRender(projectId: string, storyboardId: string, quoteToken: string, formats?: (typeof FORMATS)[number][]) {
  return withCtx(async (ctx) => {
    const r = await createVideo(ctx, { project_id: projectId, storyboard_id: storyboardId, formats, confirm: true, quote_token: quoteToken });
    if (r.status !== "queued") throw new Error("unexpected render state");
    return r.job;
  });
}

export async function renderStatus(jobId: string) {
  return withCtx((ctx) => getRenderStatus(ctx, jobId));
}

export async function retryFailedRender(jobId: string) {
  return withCtx((ctx) => retryRender(ctx, jobId));
}

/** A fresh, short-lived signed download link (minted on click, never stored). */
export async function exportDownload(exportId: string) {
  return withCtx(async (ctx) => {
    const e = await getExport(ctx, exportId);
    if (!e.download) throw new Error("not ready");
    return { url: e.download.url, expires_at: e.download.expires_at };
  });
}
