"use client";

import { AlertTriangle, Loader2, Sparkles, X } from "lucide-react";
import Link from "next/link";
import { Dialog } from "radix-ui";
import { useCallback, useEffect, useState } from "react";
import { cancelUpload, mediaDetail } from "@/app/(app)/_actions/media";
import { AiBadge, Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/misc";
import { bytes, duration, ratioOf, relativeTime } from "@/lib/format";

/* Side panel with a media asset's real details, preview and analysis results. */

type Detail = Awaited<ReturnType<typeof mediaDetail>> extends { ok: true; data: infer D } | { ok: false } ? D : never;

export function MediaDetail({ mediaId, canEdit, uploadingHere, onClose, onAnalyse, onRemoved }: { mediaId: string; canEdit: boolean; uploadingHere?: boolean; onClose: () => void; onAnalyse: (id: string) => Promise<void>; onRemoved?: () => Promise<void> }) {
  const [data, setData] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const apply = useCallback((r: Awaited<ReturnType<typeof mediaDetail>>) => {
    if (r.ok) {
      setData(r.data);
      setError(null);
    } else setError(r.error.message);
  }, []);
  const load = useCallback(async () => apply(await mediaDetail(mediaId)), [mediaId, apply]);

  useEffect(() => {
    let live = true;
    mediaDetail(mediaId).then((r) => live && apply(r));
    return () => {
      live = false;
    };
  }, [mediaId, apply]);

  const running = data && (data.analysis.status === "queued" || data.analysis.status === "running" || data.details.status === "analysing");
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => void load(), 3000);
    return () => clearInterval(t);
  }, [running, load]);

  const d = data?.details as (Record<string, unknown> & { title: string; kind: string; status: string; width: number | null; height: number | null; duration_seconds: number | null; orientation: string | null; tags: string[]; ai_tags: string[]; description: string | null; file: { mime_type: string; size_bytes: number | null; original_filename: string | null }; preview_url: { url: string } | null; created_at: string | null }) | undefined;
  const a = data?.analysis as
    | { status: string; job: { status: string; stage: string | null; progress_percent: number; error: { message: string; retryable: boolean } | null } | null; analysis: { analysed_at: string | null; technical: Record<string, unknown>; quality: { score?: number; checks?: Record<string, unknown>; issues?: string[] } & Record<string, unknown>; scenes: { start: number; end: number; thumbnail_url?: string; description?: string }[]; ai: { status?: string; reason?: string } & Record<string, unknown> } | null }
    | undefined;

  return (
    <Dialog.Root open onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-scrim" />
        <Dialog.Content aria-describedby={undefined} className="fixed inset-y-0 right-0 z-50 flex w-[min(560px,100vw)] flex-col overflow-y-auto border-l border-line bg-surface shadow-float">
          <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-line bg-surface px-5 py-3.5">
            <Dialog.Title className="truncate font-display text-lg font-semibold">{d?.title ?? "Media"}</Dialog.Title>
            <Dialog.Close aria-label="Close" className="inline-flex size-9 items-center justify-center rounded-md text-ink-muted hover:bg-surface-muted">
              <X className="size-4" aria-hidden />
            </Dialog.Close>
          </div>
          <div className="flex flex-col gap-5 p-5">
            {error ? (
              <p role="alert" className="rounded-md bg-danger/10 px-3.5 py-3 text-sm">
                {error}
              </p>
            ) : !d || !a ? (
              <div role="status" className="flex flex-col gap-3">
                <span className="sr-only">Loading details…</span>
                <Skeleton className="aspect-video" />
                <Skeleton className="h-24" />
              </div>
            ) : (
              <>
                {d.preview_url ? (
                  d.kind === "video" ? (
                    <video src={d.preview_url.url} controls preload="metadata" className="aspect-video w-full rounded-lg bg-media-veil object-contain" aria-label={`Preview of ${d.title}`} />
                  ) : d.kind === "image" ? (
                    // eslint-disable-next-line @next/next/no-img-element -- signed storage URL
                    <img src={d.preview_url.url} alt={d.title} className="max-h-80 w-full rounded-lg bg-surface-muted object-contain" />
                  ) : null
                ) : (
                  <p className="rounded-lg bg-surface-muted px-4 py-8 text-center text-sm text-ink-muted">{d.status === "awaiting_upload" ? (uploadingHere ? "Still uploading in this tab." : "This upload was interrupted before it finished (the page was closed or reloaded). Remove it and upload the file again.") : d.status === "failed" && a.job?.status !== "failed" ? "This upload failed or was cancelled." : d.status === "failed" ? "This file couldn't be read as a video." : "No preview available."}</p>
                )}

                <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-sm sm:grid-cols-3">
                  <Meta k="Length" v={duration(d.duration_seconds)} />
                  <Meta k="Resolution" v={d.width && d.height ? `${d.width}×${d.height}` : "–"} />
                  <Meta k="Shape" v={d.orientation ? `${d.orientation}${ratioOf(d.width, d.height) ? ` · ${ratioOf(d.width, d.height)}` : ""}` : "–"} />
                  <Meta k="File" v={d.file.original_filename ?? d.file.mime_type} />
                  <Meta k="Size" v={bytes(d.file.size_bytes)} />
                  <Meta k="Uploaded" v={relativeTime(d.created_at)} />
                </dl>

                {d.tags.length || d.ai_tags.length ? (
                  <div className="flex flex-wrap gap-1.5">
                    {d.tags.map((t) => (
                      <Badge key={t} tone="outline">
                        {t}
                      </Badge>
                    ))}
                    {d.ai_tags.map((t) => (
                      <AiBadge key={t}>{t}</AiBadge>
                    ))}
                  </div>
                ) : null}

                <section aria-labelledby="analysis-title" className="flex flex-col gap-3 border-t border-line pt-4">
                  <div className="flex items-center justify-between gap-3">
                    <h3 id="analysis-title" className="font-display font-semibold">
                      Analysis
                    </h3>
                    {d.kind === "video" && canEdit && (a.status === "not_analysed" || a.status === "failed" || a.job?.status === "failed") && d.status !== "awaiting_upload" && d.status !== "failed" ? (
                      <Button size="sm" variant="primary" loading={busy} onClick={async () => (setBusy(true), await onAnalyse(mediaId), await load(), setBusy(false))}>
                        {a.job?.status === "failed" ? "Try analysis again" : "Analyse"}
                      </Button>
                    ) : null}
                  </div>
                  {a.status === "analysed" && a.analysis && d.kind === "image" ? (
                    <p className="text-sm text-ink-muted">Dimensions read and a thumbnail made. Images aren&apos;t scored.</p>
                  ) : a.status === "analysed" && a.analysis ? (
                    <AnalysisResult analysis={a.analysis} />
                  ) : a.job && (a.job.status === "queued" || a.job.status === "running") ? (
                    <p className="flex items-center gap-2 text-sm" role="status">
                      <Loader2 className="size-4 animate-spin text-ai motion-reduce:animate-none" aria-hidden />
                      {a.job.status === "queued" ? "Queued: a worker will pick this up shortly." : `${a.job.stage ?? "Analysing"} · ${Math.round(a.job.progress_percent)}%`}
                    </p>
                  ) : a.job?.status === "failed" ? (
                    <p className="flex items-start gap-2 text-sm text-danger">
                      <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden /> {a.job.error?.message ?? "Analysis failed."}
                    </p>
                  ) : (
                    <p className="text-sm text-ink-muted">{d.kind === "audio" ? "Audio files are not analysed." : "Not analysed yet."}</p>
                  )}
                </section>

                {d.status === "awaiting_upload" && !uploadingHere && canEdit ? (
                  <Button
                    variant="secondary"
                    loading={busy}
                    onClick={async () => {
                      if (!confirm("Remove this unfinished upload? Nothing else is affected.")) return;
                      setBusy(true);
                      const r = await cancelUpload(mediaId);
                      setBusy(false);
                      if (r.ok) await onRemoved?.();
                      else setError(r.error.message);
                    }}
                  >
                    Remove unfinished upload
                  </Button>
                ) : null}
                {d.kind === "video" && d.status === "ready" ? (
                  <Button asChild variant="action">
                    <Link href={`/autopilot?media=${mediaId}`}>
                      <Sparkles aria-hidden /> Make a video with this clip
                    </Link>
                  </Button>
                ) : null}
              </>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function Meta({ k, v }: { k: string; v: string }) {
  return (
    <div className="min-w-0">
      <dt className="font-mono text-[10px] text-ink-muted uppercase">{k}</dt>
      <dd className="truncate">{v}</dd>
    </div>
  );
}

function AnalysisResult({ analysis }: { analysis: { analysed_at: string | null; quality: Record<string, unknown>; scenes: { start: number; end: number; thumbnail_url?: string; description?: string }[]; ai: { status?: string; reason?: string } & Record<string, unknown> } }) {
  const q = analysis.quality as { score?: number; resolution?: string; exposure?: string; black_frames_seconds?: number; audio?: { silent: boolean | null; mean_volume_db: number | null } | null };
  const checks = [
    q.resolution ? `Resolution: ${q.resolution}` : null,
    q.exposure ? `Exposure: ${q.exposure}` : null,
    typeof q.black_frames_seconds === "number" ? `Black frames: ${q.black_frames_seconds}s` : null,
    q.audio === null ? "Sound: none" : q.audio ? `Sound: ${q.audio.silent ? "silent" : `${q.audio.mean_volume_db ?? "?"} dB average`}` : null,
  ].filter(Boolean) as string[];
  return (
    <div className="flex flex-col gap-3 text-sm">
      <p className="flex flex-wrap items-center gap-2">
        {typeof q.score === "number" ? <AiBadge>Quality {Math.round(q.score)}/100</AiBadge> : null}
        <span className="text-ink-muted">
          {analysis.scenes.length} scene{analysis.scenes.length === 1 ? "" : "s"} · analysed {relativeTime(analysis.analysed_at)}
        </span>
      </p>
      {checks.length ? (
        <ul className="flex flex-wrap gap-x-4 gap-y-1 font-mono text-[11px] text-ink-muted">
          {checks.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>
      ) : null}
      <ol className="grid grid-cols-3 gap-2">
        {analysis.scenes.slice(0, 12).map((s, i) => (
          <li key={i} className="flex flex-col gap-1">
            {s.thumbnail_url ? (
              // eslint-disable-next-line @next/next/no-img-element -- signed keyframe URL
              <img src={s.thumbnail_url} alt={s.description ?? `Scene ${i + 1}`} className="aspect-video w-full rounded-md object-cover" />
            ) : (
              <div className="aspect-video rounded-md bg-surface-muted" />
            )}
            <span className="font-mono text-[10px] text-ink-muted">
              {duration(s.start)}–{duration(s.end)}
            </span>
            {s.description ? <span className="text-xs">{s.description}</span> : null}
          </li>
        ))}
      </ol>
      <p className="text-xs text-ink-muted">{analysis.ai.status === "not run" ? `No AI description: ${analysis.ai.reason ?? "not run"}` : "Includes AI scene descriptions (from still frames only)."}</p>
    </div>
  );
}
