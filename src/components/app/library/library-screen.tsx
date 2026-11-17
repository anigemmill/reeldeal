"use client";

import { AlertTriangle, CheckCircle2, LayoutGrid, List, Loader2, RotateCcw, Search, Sparkles, UploadCloud, X } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { analyse, mediaActivity, searchLibrary, setAiConsent } from "@/app/(app)/_actions/media";
import { Thumb } from "@/components/app/media/thumb";
import { AiBadge, Badge, PillToggle } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/choice";
import { ProgressBar } from "@/components/ui/progress";
import { toast } from "@/components/ui/toast";
import { bytes, duration, relativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { MediaDetail } from "./media-detail";
import { ACCEPT_ATTR, useUploads, type UploadItem } from "./use-uploads";

/*
  Media library (design/app/A-Library.dc.html) on real data: direct uploads with
  progress, server-side search and filters, analysis status from real jobs, and a
  detail panel. Polls while anything is uploading or being analysed.
*/

export type LibraryItem = {
  id: string;
  title: string;
  kind: string;
  status: string;
  duration_seconds: number | null;
  width: number | null;
  height: number | null;
  orientation: string | null;
  tags: string[];
  ai_tags: string[];
  quality_score: number | null;
  size_bytes: number | null;
  created_at: string | null;
  thumbnail_url?: string | null;
};
export type Activity = { id: string; status: string; analysis: { status: string; stage: string | null; progress_percent: number | null; error: string | null } | null };
type Filters = { query: string; kind: "" | "video" | "image"; status: "" | "ready" | "analysing" | "uploaded" | "failed"; sort: "relevance" | "newest" | "best_quality" | "longest" };

const KIND_FILTERS = [
  { v: "", l: "All" },
  { v: "video", l: "Video" },
  { v: "image", l: "Images" },
] as const;
const STATUS_FILTERS = [
  { v: "", l: "Any status" },
  { v: "ready", l: "Analysed" },
  { v: "analysing", l: "Analysing" },
  { v: "uploaded", l: "Not analysed" },
  { v: "failed", l: "Failed" },
] as const;
const SORTS = [
  { v: "newest", l: "Newest" },
  { v: "best_quality", l: "Best quality" },
  { v: "longest", l: "Longest" },
  { v: "relevance", l: "Best match" },
] as const;

export function LibraryScreen(props: {
  initial: LibraryItem[];
  hasMore: boolean;
  total: number;
  activity: Activity[];
  canEdit: boolean;
  canManage: boolean;
  aiConsent: boolean;
  aiConfigured: boolean;
  analysis: { usedMinutes: number; allowanceMinutes: number | null };
  initialMedia: string | null;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [items, setItems] = useState(props.initial);
  const [hasMore, setHasMore] = useState(props.hasMore);
  const [activity, setActivity] = useState(new Map(props.activity.map((a) => [a.id, a])));
  const [filters, setFilters] = useState<Filters>({ query: "", kind: "", status: "", sort: "newest" });
  const [view, setView] = useState<"grid" | "list">("grid");
  const [selected, setSelected] = useState<string | null>(props.initialMedia);
  const [consent, setConsent] = useState(props.aiConsent);
  const [searching, startSearch] = useTransition();
  const [dragging, setDragging] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const filtersRef = useRef(filters);
  useEffect(() => {
    filtersRef.current = filters;
  }, [filters]);

  const refresh = useCallback(async (f: Filters = filtersRef.current) => {
    const [r, a] = await Promise.all([searchLibrary({ query: f.query || undefined, kind: f.kind || undefined, status: f.status || undefined, sort: f.query && f.sort === "newest" ? "relevance" : f.sort }), mediaActivity()]);
    if (r.ok) {
      setItems(r.data.results as LibraryItem[]);
      setHasMore(r.data.has_more);
    } else if (r.error.code === "unauthenticated") router.push(`/sign-in?expired=1&next=/library`);
    if (a.ok) setActivity(new Map(a.data.items.map((x) => [x.id, x as Activity])));
  }, [router]);

  const uploads = useUploads(useCallback(() => void refresh(), [refresh]));
  const activeUploads = new Set(uploads.items.filter((u) => u.mediaId && ["preparing", "uploading", "finishing"].includes(u.phase)).map((u) => u.mediaId!));

  // Search as you type (debounced), filters immediately.
  useEffect(() => {
    const t = setTimeout(() => startSearch(() => void refresh(filters)), filters.query ? 300 : 0);
    return () => clearTimeout(t);
  }, [filters, refresh]);

  // Poll while uploads run or analysis is pending.
  const pending = uploads.active || items.some((i) => i.status === "analysing") || [...activity.values()].some((a) => a.analysis?.status === "queued" || a.analysis?.status === "running");
  const wasPending = useRef(pending);
  useEffect(() => {
    // When processing finishes, refresh server-rendered usage (sidebar meters).
    if (wasPending.current && !pending) router.refresh();
    wasPending.current = pending;
    if (!pending) return;
    const t = setInterval(() => void refresh(), 3000);
    return () => clearInterval(t);
  }, [pending, refresh, router]);

  // The details panel unmounts as soon as it closes, so Radix can't hand focus back:
  // remember what opened it and return focus there (keyboard users keep their place).
  const opener = useRef<HTMLElement | null>(null);
  const select = (id: string | null) => {
    if (id) opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    else
      requestAnimationFrame(() => {
        const el = opener.current;
        if (el?.isConnected && (!document.activeElement || document.activeElement === document.body)) el.focus();
      });
    setSelected(id);
    const q = new URLSearchParams(params);
    if (id) q.set("media", id);
    else q.delete("media");
    // Shallow URL update (shareable ?media= link) without a server round trip. router.replace
    // re-rendered the whole page and briefly removed the document <title> (an axe
    // document-title failure and an untitled page for screen readers). Next.js keeps
    // useSearchParams in sync with history.replaceState.
    window.history.replaceState(null, "", `/library${q.size ? `?${q}` : ""}`);
  };

  const onDrop = (files: FileList | null) => {
    if (!files?.length) return;
    if (!props.canEdit) return toast({ title: "You can't upload in this workspace", description: "Viewers can browse the library; ask an editor to upload.", tone: "warning" });
    uploads.add(files);
  };

  const readyCount = items.filter((i) => i.status === "ready").length;
  const totalSeconds = items.reduce((a, i) => a + (i.duration_seconds ?? 0), 0);

  return (
    <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-5 px-4 py-6 sm:px-6 lg:px-7 lg:py-6">
      <header className="flex flex-wrap items-center gap-3.5">
        <div className="min-w-0 flex-[1_1_260px]">
          <h1 className="font-display text-[32px] font-semibold tracking-[-0.03em]">Library</h1>
          <p className="mt-1 text-ink-muted">
            {filters.query || filters.kind || filters.status ? `${items.length}${hasMore ? "+" : ""} matching` : `${Math.max(items.length, props.total)}${hasMore ? "+" : ""} file${items.length === 1 ? "" : "s"}`}
            {totalSeconds ? ` · ${duration(totalSeconds)} of footage shown` : ""}
            {readyCount ? ` · ${readyCount} analysed` : ""}
          </p>
        </div>
        <label className="flex h-11 flex-[0_1_360px] items-center gap-2 rounded-md border border-line bg-surface px-3.5">
          <Search className="size-4 shrink-0 text-ink-muted" aria-hidden />
          <span className="sr-only">Search footage</span>
          <input
            type="search"
            value={filters.query}
            onChange={(e) => setFilters((f) => ({ ...f, query: e.target.value }))}
            placeholder="Search titles, tags, descriptions"
            className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-ink-muted"
          />
          {searching ? <Loader2 className="size-4 animate-spin text-ink-muted motion-reduce:animate-none" aria-label="Searching" /> : null}
        </label>
        <Button variant="primary" onClick={() => fileInput.current?.click()} disabled={!props.canEdit}>
          <UploadCloud aria-hidden /> Upload
        </Button>
        <input ref={fileInput} type="file" multiple accept={ACCEPT_ATTR} className="sr-only" tabIndex={-1} aria-hidden onChange={(e) => (onDrop(e.target.files), (e.target.value = ""))} />
      </header>

      <div className="flex flex-wrap gap-3.5">
        <div
          onDragOver={(e) => (e.preventDefault(), setDragging(true))}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => (e.preventDefault(), setDragging(false), onDrop(e.dataTransfer.files))}
          className={cn("flex min-h-[230px] flex-[1_1_260px] flex-col items-center justify-center gap-2.5 rounded-[20px] border-2 border-dashed bg-surface p-5 text-center transition-colors", dragging ? "border-primary bg-tint" : "border-primary/40")}
        >
          <span className="flex size-13 items-center justify-center rounded-2xl bg-tint text-primary">
            <UploadCloud className="size-6" aria-hidden />
          </span>
          <p className="font-display text-lg font-semibold">Drop footage here</p>
          <p className="text-[13px] leading-normal text-ink-muted">MP4, MOV or WebM video (up to 20 GB) and JPEG, PNG or WebP images. Large files upload in parts and can resume.</p>
          <Button size="sm" variant="secondary" onClick={() => fileInput.current?.click()} disabled={!props.canEdit}>
            Choose files
          </Button>
        </div>
        <UploadPanel uploads={uploads} activity={activity} />
      </div>

      <AnalysisNote consent={consent} canManage={props.canManage} aiConfigured={props.aiConfigured} analysis={props.analysis} onConsent={async (v) => {
        const r = await setAiConsent(v);
        if (r.ok) setConsent(r.data.ai_media_analysis_consent);
        else toast({ title: "Couldn't change the setting", description: r.error.message, tone: "danger" });
      }} />

      <div className="flex flex-wrap items-center gap-2">
        <div role="group" aria-label="File type" className="flex flex-wrap gap-1.5">
          {KIND_FILTERS.map((k) => (
            <PillToggle key={k.l} pressed={filters.kind === k.v} onClick={() => setFilters((f) => ({ ...f, kind: k.v }))}>
              {k.l}
            </PillToggle>
          ))}
        </div>
        <div role="group" aria-label="Processing status" className="flex flex-wrap gap-1.5">
          {STATUS_FILTERS.map((s) => (
            <PillToggle key={s.l} pressed={filters.status === s.v} onClick={() => setFilters((f) => ({ ...f, status: s.v }))}>
              {s.l}
            </PillToggle>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <label className="flex items-center gap-2 text-sm text-ink-muted">
            Sort
            <select value={filters.sort} onChange={(e) => setFilters((f) => ({ ...f, sort: e.target.value as Filters["sort"] }))} className="h-9 rounded-md border border-line bg-surface px-2 text-sm text-ink">
              {SORTS.map((s) => (
                <option key={s.v} value={s.v}>
                  {s.l}
                </option>
              ))}
            </select>
          </label>
          <div role="group" aria-label="View" className="flex rounded-md border border-line">
            <button type="button" aria-pressed={view === "grid"} aria-label="Grid view" onClick={() => setView("grid")} className={cn("inline-flex size-9 items-center justify-center", view === "grid" && "bg-surface-muted")}>
              <LayoutGrid className="size-4" aria-hidden />
            </button>
            <button type="button" aria-pressed={view === "list"} aria-label="List view" onClick={() => setView("list")} className={cn("inline-flex size-9 items-center justify-center", view === "list" && "bg-surface-muted")}>
              <List className="size-4" aria-hidden />
            </button>
          </div>
        </div>
      </div>

      {items.length === 0 ? (
        <p className="rounded-xl border border-line bg-surface px-5 py-10 text-center text-ink-muted">
          {filters.query || filters.kind || filters.status ? "Nothing matches these filters." : "Your library is empty. Drop your first clips above: phone footage is fine."}
        </p>
      ) : view === "grid" ? (
        <ul className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-6" aria-label="Media">
          {items.map((m) => (
            <li key={m.id}>
              <button type="button" onClick={() => select(m.id)} className="group flex w-full flex-col gap-2 rounded-lg text-left">
                <Thumb src={m.thumbnail_url} alt={m.title} kind={m.kind} ratio="16:9" className="rounded-lg">
                  {m.quality_score !== null ? <span className="absolute top-1.5 left-1.5 rounded-pill bg-ai px-1.5 py-0.5 font-mono text-[10px] text-ai-foreground">{Math.round(m.quality_score)}</span> : null}
                  {m.duration_seconds ? <span className="absolute right-1.5 bottom-1.5 rounded-pill bg-media-veil/60 px-1.5 py-0.5 font-mono text-[10px] text-on-media">{duration(m.duration_seconds)}</span> : null}
                  <StatusOverlay item={m} activity={activity.get(m.id)} active={activeUploads} />
                </Thumb>
                <span className="truncate text-sm font-medium group-hover:underline">{m.title}</span>
                <span className="-mt-1.5 flex flex-wrap gap-1">
                  {[...m.tags, ...m.ai_tags].slice(0, 2).map((t) => (
                    <Badge key={t} size="sm" tone="outline">
                      {t}
                    </Badge>
                  ))}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <table className="w-full text-left text-sm">
          <thead className="font-mono text-[11px] text-ink-muted uppercase">
            <tr>
              <th className="py-2 font-normal">Name</th>
              <th className="py-2 font-normal">Status</th>
              <th className="hidden py-2 font-normal sm:table-cell">Length</th>
              <th className="hidden py-2 font-normal md:table-cell">Orientation</th>
              <th className="hidden py-2 font-normal md:table-cell">Quality</th>
              <th className="hidden py-2 font-normal lg:table-cell">Size</th>
              <th className="hidden py-2 font-normal lg:table-cell">Uploaded</th>
            </tr>
          </thead>
          <tbody>
            {items.map((m) => (
              <tr key={m.id} className="border-t border-line">
                <td className="py-2">
                  <button type="button" onClick={() => select(m.id)} className="flex items-center gap-3 text-left hover:underline">
                    <Thumb src={m.thumbnail_url} alt="" kind={m.kind} className="w-14 shrink-0" />
                    <span className="truncate font-medium">{m.title}</span>
                  </button>
                </td>
                <td className="py-2">
                  <StatusText item={m} activity={activity.get(m.id)} active={activeUploads} />
                </td>
                <td className="hidden py-2 font-mono text-xs sm:table-cell">{duration(m.duration_seconds)}</td>
                <td className="hidden py-2 md:table-cell">{m.orientation ?? "–"}</td>
                <td className="hidden py-2 font-mono text-xs md:table-cell">{m.quality_score === null ? "–" : Math.round(m.quality_score)}</td>
                <td className="hidden py-2 font-mono text-xs lg:table-cell">{bytes(m.size_bytes)}</td>
                <td className="hidden py-2 text-ink-muted lg:table-cell">{relativeTime(m.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {hasMore ? <p className="text-center text-sm text-ink-muted">Showing the first {items.length}. Narrow the search to find more.</p> : null}

      {selected ? (
        <MediaDetail
          key={selected}
          mediaId={selected}
          canEdit={props.canEdit}
          onClose={() => select(null)}
          uploadingHere={activeUploads.has(selected)}
          onRemoved={async () => {
            select(null);
            await refresh();
          }}
          onAnalyse={async (id) => {
            const r = await analyse(id);
            if (!r.ok) toast({ title: "Analysis not started", description: r.error.message, tone: "danger" });
            await refresh();
          }}
        />
      ) : null}
    </div>
  );
}

/* activeUploads: uploads running in this tab; an unfinished upload not among them was interrupted (tab closed, reload). */
function statusOf(item: LibraryItem, a: Activity | undefined, activeUploads: Set<string>) {
  if (item.status === "awaiting_upload") return activeUploads.has(item.id) ? { label: "Uploading", tone: "primary" as const } : { label: "Upload interrupted", tone: "danger" as const };
  if (a?.analysis?.status === "failed" && item.status !== "ready") return { label: "Analysis failed", tone: "danger" as const };
  if (item.status === "failed") return { label: "Upload failed", tone: "danger" as const };
  if (item.status === "analysing" || a?.analysis?.status === "queued" || a?.analysis?.status === "running")
    return { label: a?.analysis?.status === "queued" ? "Queued for analysis" : `Analysing${a?.analysis?.progress_percent ? ` ${Math.round(a.analysis.progress_percent)}%` : ""}`, tone: "ai" as const };
  if (item.status === "ready") return { label: "Analysed", tone: "success" as const };
  return { label: item.kind === "video" ? "Not analysed" : "Uploaded", tone: "neutral" as const };
}

function StatusOverlay({ item, activity, active }: { item: LibraryItem; activity?: Activity; active: Set<string> }) {
  const s = statusOf(item, activity, active);
  if (s.tone === "success" || s.tone === "neutral") return null;
  return (
    <span className="absolute inset-x-1.5 top-1.5 flex min-w-0 justify-end [&>*]:max-w-full [&>*]:truncate">
      {s.tone === "ai" ? <AiBadge size="sm">{s.label}</AiBadge> : <Badge size="sm" tone={s.tone === "danger" ? "danger" : "primary"}>{s.label}</Badge>}
    </span>
  );
}

function StatusText({ item, activity, active }: { item: LibraryItem; activity?: Activity; active: Set<string> }) {
  const s = statusOf(item, activity, active);
  return <span className={cn("text-xs", s.tone === "danger" ? "text-danger" : s.tone === "ai" ? "text-ink" : s.tone === "success" ? "text-ink" : "text-ink-muted")}>{s.label}</span>;
}

function UploadPanel({ uploads, activity }: { uploads: ReturnType<typeof useUploads>; activity: Map<string, Activity> }) {
  const list = uploads.items;
  const total = list.reduce((a, x) => a + x.file.size, 0);
  const loaded = list.reduce((a, x) => a + (x.phase === "done" ? x.file.size : x.loaded), 0);
  return (
    <section aria-labelledby="uploads-title" className="flex min-w-0 flex-[2.4_1_520px] flex-col gap-3 rounded-[20px] border border-line bg-surface px-5 py-4.5">
      <div className="flex flex-wrap items-baseline justify-between gap-2.5">
        <h2 id="uploads-title" className="font-display text-lg font-semibold">
          Uploads
        </h2>
        <span className="font-mono text-xs text-ink-muted" aria-live="polite">
          {list.length ? `${list.filter((x) => x.phase === "done").length} of ${list.length} done · ${bytes(loaded)} of ${bytes(total)}` : "Nothing uploading"}
        </span>
      </div>
      {list.length ? (
        <>
          <ProgressBar label="Overall upload progress" value={total ? (loaded / total) * 100 : 0} size="sm" />
          <ul className="flex max-h-64 flex-col overflow-y-auto">
            {list.map((u) => (
              <UploadRow key={u.id} u={u} activity={u.mediaId ? activity.get(u.mediaId) : undefined} onCancel={() => uploads.cancel(u.id)} onRetry={() => uploads.retry(u.id)} />
            ))}
          </ul>
          {list.some((x) => x.phase === "done" || x.phase === "cancelled") ? (
            <Button size="sm" variant="ghost" className="self-end" onClick={uploads.clearFinished}>
              Clear finished
            </Button>
          ) : null}
        </>
      ) : (
        <p className="text-sm text-ink-muted">Files you add show their progress here. You can keep working while they upload; leaving this page stops uploads in progress.</p>
      )}
    </section>
  );
}

function UploadRow({ u, activity, onCancel, onRetry }: { u: UploadItem; activity?: Activity; onCancel: () => void; onRetry: () => void }) {
  const pct = u.file.size ? (u.loaded / u.file.size) * 100 : 0;
  const analysing = u.phase === "done" && (activity?.analysis?.status === "queued" || activity?.analysis?.status === "running");
  const analysed = u.phase === "done" && activity?.status === "ready";
  const label =
    u.phase === "queued" ? "Waiting"
    : u.phase === "preparing" ? "Preparing"
    : u.phase === "uploading" ? `Uploading ${Math.floor(pct)}%`
    : u.phase === "finishing" ? "Checking the upload"
    : u.phase === "cancelled" ? "Cancelled"
    : u.phase === "failed" ? "Failed"
    : analysing ? "Analysing"
    : analysed ? "Analysed"
    : (u.note ?? "Uploaded");
  return (
    <li className="flex items-center gap-3 border-t border-line py-2.5 first:border-t-0">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-surface-muted">
        {u.phase === "failed" ? <AlertTriangle className="size-4 text-danger" aria-hidden /> : analysed || (u.phase === "done" && !analysing) ? <CheckCircle2 className="size-4 text-success" aria-hidden /> : <Loader2 className="size-4 animate-spin text-ai motion-reduce:animate-none" aria-hidden />}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-baseline justify-between gap-3 text-sm">
          <span className="truncate font-medium">{u.file.name}</span>
          <span className="shrink-0 font-mono text-[11px] text-ink-muted">{bytes(u.file.size)}</span>
        </div>
        {u.phase === "uploading" ? <ProgressBar label={`${u.file.name} upload`} value={pct} size="sm" /> : null}
        <span className={cn("text-xs", u.phase === "failed" ? "text-danger" : "text-ink-muted")}>{u.phase === "failed" ? `${label}: ${u.error}` : label}</span>
      </div>
      {["queued", "preparing", "uploading", "finishing"].includes(u.phase) ? (
        <button type="button" onClick={onCancel} aria-label={`Cancel upload of ${u.file.name}`} className="inline-flex size-8 items-center justify-center rounded-md text-ink-muted hover:bg-surface-muted">
          <X className="size-4" aria-hidden />
        </button>
      ) : u.phase === "failed" && u.error && !u.error.includes("isn't supported") && !u.error.includes("empty") ? (
        <Button size="sm" variant="secondary" onClick={onRetry}>
          <RotateCcw aria-hidden /> Retry
        </Button>
      ) : null}
    </li>
  );
}

function AnalysisNote({ consent, canManage, aiConfigured, analysis, onConsent }: { consent: boolean; canManage: boolean; aiConfigured: boolean; analysis: { usedMinutes: number; allowanceMinutes: number | null }; onConsent: (v: boolean) => void }) {
  return (
    <section aria-label="About analysis" className="flex flex-wrap items-start gap-4 rounded-[20px] bg-tint px-5 py-4">
      <div className="flex min-w-[260px] flex-1 flex-col gap-1.5">
        <span className="flex items-center gap-2 font-mono text-[11px] text-ink">
          <Sparkles className="size-3.5 text-ai" aria-hidden /> ANALYSIS
        </span>
        <p className="text-sm leading-relaxed">
          Every uploaded video is analysed on our servers: length, resolution, scene changes, a keyframe per scene, and quality checks for resolution, exposure, black frames, frame rate and sound.
        </p>
        <p className="font-mono text-[11px] text-ink-muted">
          Uses media analysis time: {analysis.usedMinutes} of {analysis.allowanceMinutes ?? "∞"} min used this period.
        </p>
      </div>
      <div className="flex min-w-[240px] flex-col gap-2 rounded-xl bg-surface p-3.5 text-sm">
        <Switch label="AI scene descriptions" checked={consent} onCheckedChange={onConsent} disabled={!canManage || !aiConfigured} />
        <p className="text-xs leading-relaxed text-ink-muted">
          {!aiConfigured
            ? "Not available on this server (no AI provider configured)."
            : consent
              ? "On: one still frame per scene (never the video) is sent to OpenAI to describe it. Applies to new analyses."
              : `Off: nothing from your footage is sent to an AI provider.${canManage ? "" : " An admin can turn this on."}`}
        </p>
      </div>
    </section>
  );
}
