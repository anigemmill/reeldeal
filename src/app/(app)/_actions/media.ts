"use server";

import { withCtx } from "@/server/app/result";
import { completeMediaUpload, cancelMediaUpload, createMediaUpload, getMediaAnalysis, getMediaDetails, listMediaActivity, requestAnalysis, searchMedia, type SearchInput } from "@/server/services/media";
import { setAiMediaConsent } from "@/server/services/workspace";

/* Media library actions: thin wrappers over the shared media service (same code MCP uses). */

export async function searchLibrary(input: SearchInput) {
  return withCtx((ctx) => searchMedia(ctx, { limit: 48, ...input }, { includeThumbnails: true }));
}

export async function mediaActivity() {
  return withCtx((ctx) => listMediaActivity(ctx, { limit: 20 }));
}

export async function startUpload(file: { title: string; filename: string; content_type: string; size_bytes: number; tags?: string[]; brand_id?: string }) {
  return withCtx((ctx) => createMediaUpload(ctx, file));
}

/** Confirms the stored file; for videos, then queues analysis (which checks the plan's allowance). */
export async function finishUpload(mediaId: string) {
  return withCtx(async (ctx) => {
    const done = await completeMediaUpload(ctx, mediaId);
    if (done.status !== "uploaded") return { ...done, analysis: null };
    const details = await getMediaDetails(ctx, mediaId);
    if (details.kind === "audio" || details.kind === "document") return { ...done, analysis: null };
    try {
      const job = await requestAnalysis(ctx, mediaId);
      return { ...done, analysis: { queued: true as const, job_id: job.job_id as string } };
    } catch (e) {
      return { ...done, analysis: { queued: false as const, reason: (e as Error).message } };
    }
  });
}

export async function cancelUpload(mediaId: string) {
  return withCtx((ctx) => cancelMediaUpload(ctx, mediaId));
}

export async function analyse(mediaId: string) {
  return withCtx((ctx) => requestAnalysis(ctx, mediaId));
}

export async function mediaDetail(mediaId: string) {
  return withCtx(async (ctx) => {
    const [details, analysis] = await Promise.all([getMediaDetails(ctx, mediaId, { includePreviewUrl: true }), getMediaAnalysis(ctx, mediaId, { includeThumbnailUrls: true })]);
    return { details, analysis };
  });
}

export async function setAiConsent(enabled: boolean) {
  return withCtx((ctx) => setAiMediaConsent(ctx, enabled));
}
