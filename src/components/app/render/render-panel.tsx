"use client";

import { AlertTriangle, CheckCircle2, Loader2, RotateCcw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { confirmRender, exportDownload, quoteRender, renderStatus, retryFailedRender } from "@/app/(app)/_actions/render";
import { ExportDownload } from "@/components/app/export-download";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/dialog";
import { ProgressBar } from "@/components/ui/progress";
import { duration } from "@/lib/format";

/*
  Render a storyboard: the server quotes the credits (from config/pricing.json via the
  render service), the customer confirms in a dialog, and only then is a render job
  queued with the credits held. Progress and outcome come from the real job; nothing
  is shown as exported until the worker has stored the MP4. Failed renders are not
  charged and can be retried free.
*/
type Quote = { credits: number; available_credits: number; enough_credits: boolean; formats: string[]; video_length_seconds: number; quote_token: string; expires_at: string; rule: string };
type Job = { job_id: string; status: string; stage: string | null; progress_percent: number; error: { message: string; retryable: boolean } | null; exports?: { export_id: string; format: string }[]; queue_position?: number | null };

export function RenderPanel({ projectId, storyboardId, renderable, canRender, initialJob, onFinished, compact }: { projectId: string; storyboardId: string; renderable: boolean; canRender: boolean; initialJob?: Job | null; onFinished?: () => void; compact?: boolean }) {
  const [quote, setQuote] = useState<Quote | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<"quote" | "confirm" | "retry" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [job, setJob] = useState<Job | null>(initialJob ?? null);

  const active = job && (job.status === "queued" || job.status === "running");
  const poll = useCallback(async (id: string) => {
    const r = await renderStatus(id);
    if (r.ok) setJob(r.data as Job);
    return r.ok ? (r.data as Job).status : "error";
  }, []);

  useEffect(() => {
    if (!active || !job) return;
    const t = setInterval(async () => {
      const s = await poll(job.job_id);
      if (s === "succeeded" || s === "failed") onFinished?.();
    }, 2000);
    return () => clearInterval(t);
  }, [active, job, poll, onFinished]);

  const getQuote = async () => {
    setBusy("quote");
    setError(null);
    const r = await quoteRender(projectId, storyboardId);
    setBusy(null);
    if (!r.ok) return setError(r.error.message);
    setQuote(r.data as Quote);
    setOpen(true);
  };

  const confirm = async () => {
    if (!quote) return;
    setBusy("confirm");
    const r = await confirmRender(projectId, storyboardId, quote.quote_token, quote.formats as never);
    setBusy(null);
    setOpen(false);
    if (!r.ok) return setError(r.error.code === "insufficient_credits" ? `${r.error.message} Credits renew with your plan.` : r.error.message);
    setJob({ ...(r.data as unknown as Job) });
    void poll((r.data as { job_id: string }).job_id);
  };

  const retry = async () => {
    if (!job) return;
    setBusy("retry");
    const r = await retryFailedRender(job.job_id);
    setBusy(null);
    if (!r.ok) return setError(r.error.message);
    const next = (r.data as { job: Job }).job ?? (r.data as unknown as Job);
    setJob(next);
  };

  return (
    <div className="flex flex-col gap-3" aria-live="polite">
      {job?.status === "succeeded" ? (
        <div className="flex flex-col gap-2.5 rounded-xl border border-success/40 bg-success/10 p-4">
          <p className="flex items-center gap-2 font-semibold">
            <CheckCircle2 className="size-5 text-success" aria-hidden /> Your video is ready
          </p>
          {job.exports?.[0] ? <ExportPreview exportId={job.exports[0].export_id} /> : null}
          <div className="flex flex-wrap gap-2">
            {(job.exports ?? []).map((e) => (
              <ExportDownload key={e.export_id} exportId={e.export_id} label={`Download ${e.format} MP4`} variant="primary" />
            ))}
          </div>
        </div>
      ) : active ? (
        <div className="flex flex-col gap-2 rounded-xl border border-line bg-surface p-4">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <Loader2 className="size-4 animate-spin text-ai motion-reduce:animate-none" aria-hidden />
            {job.status === "queued" ? `Queued${job.queue_position ? ` · position ${job.queue_position}` : ""}: waiting for a render worker` : `Rendering: ${job.stage ?? "starting"}`}
          </p>
          <ProgressBar label="Render progress" value={job.progress_percent} tone="ai" />
          <p className="text-xs text-ink-muted">Credits are held, and only charged if the render succeeds. You can leave this page; the video will be in Exports.</p>
        </div>
      ) : job?.status === "failed" ? (
        <div className="flex flex-col gap-2.5 rounded-xl border border-danger/40 bg-danger/10 p-4">
          <p className="flex items-start gap-2 text-sm">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden />
            <span>
              <span className="font-semibold">The render failed. You were not charged.</span> {job.error?.message}
            </span>
          </p>
          {job.error?.retryable && canRender ? (
            <Button variant="secondary" className="w-fit" loading={busy === "retry"} onClick={retry}>
              <RotateCcw aria-hidden /> Retry free
            </Button>
          ) : null}
        </div>
      ) : null}

      {error ? (
        <p role="alert" className="rounded-md border border-danger/40 bg-danger/10 px-3.5 py-2.5 text-sm">
          {error}
        </p>
      ) : null}

      {!active ? (
        <Button variant="action" size={compact ? "md" : "lg"} className="w-full" disabled={!renderable || !canRender} loading={busy === "quote"} onClick={getQuote}>
          {job?.status === "succeeded" ? "Render again" : "Approve and render"}
        </Button>
      ) : null}
      {!renderable ? <p className="text-xs text-ink-muted">Every scene needs footage or on-screen text before it can be rendered.</p> : !canRender ? <p className="text-xs text-ink-muted">Your role can&apos;t start renders in this workspace.</p> : null}

      <Modal
        open={open}
        onOpenChange={setOpen}
        title="Render this video?"
        description={quote ? `This uses ${quote.credits} video credit${quote.credits === 1 ? "" : "s"}. You have ${quote.available_credits}.` : undefined}
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button variant="action" disabled={!quote?.enough_credits} loading={busy === "confirm"} onClick={confirm}>
              Render · {quote?.credits} credit{quote?.credits === 1 ? "" : "s"}
            </Button>
          </>
        }
      >
        {quote ? (
          <ul className="flex flex-col gap-2 text-sm">
            <li className="flex justify-between gap-3">
              <span className="text-ink-muted">Length</span>
              <span className="font-mono">{duration(quote.video_length_seconds)}</span>
            </li>
            <li className="flex justify-between gap-3">
              <span className="text-ink-muted">Formats</span>
              <span className="font-mono">{quote.formats.join(" + ")}</span>
            </li>
            <li className="flex justify-between gap-3">
              <span className="text-ink-muted">Credits</span>
              <span className="font-mono">
                {quote.credits} of {quote.available_credits} available
              </span>
            </li>
            <li className="flex justify-between gap-3">
              <span className="text-ink-muted">If the render fails on our side</span>
              <span>Not charged · free retry</span>
            </li>
            {!quote.enough_credits ? (
              <li role="alert" className="rounded-md bg-danger/10 px-3 py-2 text-ink">
                Not enough credits for this render.
              </li>
            ) : null}
            <li className="text-xs text-ink-muted">{quote.rule}</li>
          </ul>
        ) : null}
      </Modal>
    </div>
  );
}

/** Plays the finished MP4 (a short-lived signed link, fetched when shown). */
export function ExportPreview({ exportId }: { exportId: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    exportDownload(exportId).then((r) => live && r.ok && setUrl(r.data.url));
    return () => {
      live = false;
    };
  }, [exportId]);
  if (!url) return null;
  return <video src={url} controls preload="metadata" className="max-h-80 w-full rounded-lg bg-media-veil object-contain" aria-label="Rendered video" />;
}
