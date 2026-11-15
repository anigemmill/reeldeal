import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ExportDownload } from "@/components/app/export-download";
import { PageLoading } from "@/components/app/page-loading";
import { Badge } from "@/components/ui/badge";
import { bytes, duration, relativeTime } from "@/lib/format";
import { requireAppContext } from "@/server/app/session";
import { listExports } from "@/server/services/render";

export const metadata: Metadata = { title: "Exports" };

async function Exports() {
  const { ctx } = await requireAppContext("/exports");
  const e = await listExports(ctx, { limit: 50 });
  return (
    <div className="mx-auto flex w-full max-w-[1100px] flex-col gap-6 px-4 py-6 sm:px-6 lg:px-10 lg:py-9">
      <header>
        <h1 className="font-display text-[32px] font-semibold tracking-[-0.03em]">Exports</h1>
        <p className="mt-1 text-ink-muted">Finished MP4s. Download links are created when you click and expire after a few minutes.</p>
      </header>
      {e.failed_renders.length ? (
        <section aria-labelledby="failed-h" className="flex flex-col gap-2 rounded-xl border border-danger/40 bg-danger/10 p-4">
          <h2 id="failed-h" className="font-semibold">
            Failed renders (not charged)
          </h2>
          <ul className="flex flex-col gap-1 text-sm">
            {e.failed_renders.map((f) => (
              <li key={f.job_id} className="flex flex-wrap justify-between gap-2">
                <span>
                  {f.error?.message ?? "Failed on our side"} · {relativeTime(f.finished_at)}
                </span>
                {f.project_id ? (
                  <Link href={`/autopilot?project=${f.project_id}`} className="text-link underline">
                    Open project to retry free
                  </Link>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {e.exports.length ? (
        <ul className="flex flex-col divide-y divide-line rounded-xl border border-line bg-surface">
          {e.exports.map((x) => (
            <li key={x.export_id} className="flex flex-wrap items-center gap-3 p-4">
              <div className="min-w-0 flex-1">
                <Link href={`/studio?project=${x.project_id}`} className="font-medium hover:underline">
                  {x.project_name ?? "Video"}
                </Link>
                <p className="mt-1 flex flex-wrap items-center gap-1.5 font-mono text-[11px] text-ink-muted">
                  <Badge tone="outline" size="sm">
                    {x.format}
                  </Badge>
                  {duration(x.duration_seconds)} · {x.width}×{x.height} · {bytes(x.size_bytes)} · {relativeTime(x.created_at)}
                </p>
              </div>
              {x.status === "ready" ? <ExportDownload exportId={x.export_id} /> : <span className="text-sm text-danger">Failed</span>}
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-xl border border-line bg-surface px-5 py-8 text-center text-ink-muted">No exports yet. Approve a storyboard in Autopilot or Studio to render your first video.</p>
      )}
    </div>
  );
}

export default function ExportsPage() {
  return (
    <Suspense fallback={<PageLoading label="Loading exports" />}>
      <Exports />
    </Suspense>
  );
}
