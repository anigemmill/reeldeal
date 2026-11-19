import { AlertTriangle, ArrowRight, CheckCircle2, Circle, Clapperboard, Download, Loader2, RotateCcw, Shield, Sparkles, UploadCloud } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { ExportDownload } from "@/components/app/export-download";
import { Thumb } from "@/components/app/media/thumb";
import { MediaArt, PlaceholderTag } from "@/components/media/media-art";
import { AiBadge, Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Eyebrow } from "@/components/ui/misc";
import { ProgressBar } from "@/components/ui/progress";
import { getMedia } from "@/content/media";
import { duration, relativeTime } from "@/lib/format";
import type { UsageMeter } from "@/server/app/view";
import { AutopilotPrompt } from "./autopilot-prompt";

/*
  App dashboard on real workspace data (approved Phase 1 layout). Autopilot and
  Studio lead; projects, footage, exports and usage support them. Every number and
  record comes from the shared services; a new workspace gets a guided first-use
  view instead of empty panels. The Autopilot card's background is decorative brand
  imagery (labelled), not customer footage.
*/

export type DashboardProject = { id: string; name: string; status: string; format: string | null; duration_seconds: number | null; updated_at: string | null; thumbnail: string | null };
export type DashboardActivity = { id: string; title: string; kind: string; status: string; analysis: { status: string; stage: string | null; progress_percent: number | null; error: string | null } | null };
export type DashboardMoment = { id: string; title: string; quality_score: number | null; thumbnail_url?: string | null };
export type DashboardExport = { export_id: string; project_name: string | null; format: string; status: string; duration_seconds: number | null; created_at: string | null };
export type DashboardFailedRender = { job_id: string; project_id: string | null; finished_at: string | null; error: { message: string } | null };
export type DashboardData = {
  greetingName: string | null;
  workspace: { name: string; plan: string };
  brand: { id: string; name: string; industry: string | null } | null;
  brandCount: number;
  meters: UsageMeter[];
  credits: { available: number; held: number; allowanceLabel: string };
  counts: { media: number; projects: number };
  projects: DashboardProject[];
  activity: DashboardActivity[];
  moments: DashboardMoment[];
  exports: DashboardExport[];
  failedRenders: DashboardFailedRender[];
  history: { at: string | null; kind: string; amount: number; note: string | null }[];
  suggestions: readonly string[];
  welcome: boolean;
  /** U11: the owner hasn't finished onboarding steps 4–7; links to where they left off. */
  setup?: { step: string; label: string } | null;
};

export function DashboardScreen({ data }: { data: DashboardData }) {
  const firstUse = data.counts.media === 0 && data.counts.projects === 0;
  return (
    <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-10 px-4 py-6 sm:px-6 lg:px-10 lg:py-9">
      <header className="flex flex-col gap-3">
        <Eyebrow>
          {data.workspace.name} · {data.workspace.plan} plan
        </Eyebrow>
        <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-3">
          <h1 className="font-display text-[clamp(34px,4vw,54px)] leading-[0.98] font-semibold tracking-display">
            {data.welcome ? (
              <>
                Welcome{data.greetingName ? `, ${data.greetingName.split(" ")[0]}` : ""}. <em className="font-accent font-normal">Let&apos;s begin.</em>
              </>
            ) : (
              <>
                What are we making <em className="font-accent font-normal">today?</em>
              </>
            )}
          </h1>
          <dl aria-label="Usage" className="flex flex-wrap gap-x-5 gap-y-1 pb-1 text-[13px]">
            {data.meters.map((m) => (
              <div key={m.id} className="flex items-baseline gap-1.5">
                <dt className="text-ink-muted">{m.label}</dt>
                <dd className="font-mono text-xs">{m.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </header>
      {data.setup ? (
        <aside aria-labelledby="setup-title" className="flex flex-col items-start gap-3 rounded-lg border border-primary/40 bg-surface p-5 sm:flex-row sm:items-center sm:gap-5">
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <h2 id="setup-title" className="font-semibold">
              Finish setting up {data.workspace.name}
            </h2>
            <p className="text-sm text-ink-muted">Next: {data.setup.label}. Your brand, logo and preferences make every video look like you. Each step can be skipped.</p>
          </div>
          <Button asChild variant="secondary">
            <Link href={`/onboarding/setup?step=${data.setup.step}`}>Continue setup</Link>
          </Button>
        </aside>
      ) : null}

      {firstUse ? <GettingStarted data={data} /> : null}

      <section aria-label="Create" className="grid grid-cols-[minmax(0,1fr)] gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <AutopilotCard suggestions={data.suggestions} credits={data.credits} />
        <StudioCard project={data.projects[0] ?? null} hasMedia={data.counts.media > 0} />
      </section>

      {data.projects.length ? (
        <section aria-labelledby="recent-title" className="flex flex-col gap-4">
          <SectionHead id="recent-title" title="Continue where you left off" aside={<AsideLink href="/projects">All projects</AsideLink>} />
          <ul className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 sm:-mx-6 sm:px-6 lg:mx-0 lg:grid lg:grid-cols-5 lg:overflow-visible lg:px-0">
            {data.projects.map((p) => (
              <li key={p.id} className="w-[200px] shrink-0 snap-start lg:w-auto">
                <ProjectCard project={p} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <FootageCard data={data} />
        <div className="flex min-w-0 flex-col gap-4">
          <ExportsCard exports={data.exports} failed={data.failedRenders} />
          <CreditsCard data={data} />
        </div>
      </div>
    </div>
  );
}

/* ---- First use ------------------------------------------------------------ */

function GettingStarted({ data }: { data: DashboardData }) {
  const steps = [
    { done: Boolean(data.brand), title: "Your brand", body: data.brand ? `${data.brand.name} is set up. Add colours, voice and a logo any time.` : "Add your brand so videos look and sound like you.", href: data.brand ? `/brands/${data.brand.id}` : "/brands", cta: data.brand ? "Edit brand" : "Add brand" },
    { done: data.counts.media > 0, title: "Upload footage", body: "Drop in phone or camera clips. We analyse them for scenes, quality and the best moments.", href: "/library", cta: "Upload footage" },
    { done: data.counts.projects > 0, title: "Make your first video", body: "Describe it in a sentence. Storyboards are free; you confirm the credits before anything renders.", href: "/autopilot", cta: "Open Autopilot" },
  ];
  return (
    <section aria-labelledby="start-title" className="rounded-2xl border border-line bg-surface p-5 sm:p-7">
      <h2 id="start-title" className="font-display text-xl font-semibold tracking-tight">
        Three steps to your first video
      </h2>
      <ol className="mt-5 grid gap-4 md:grid-cols-3">
        {steps.map((s, i) => (
          <li key={s.title} className="flex flex-col gap-3 rounded-xl bg-surface-muted p-4">
            <span className="flex items-center gap-2 font-mono text-[11px] text-ink-muted">
              {s.done ? <CheckCircle2 className="size-4 text-success" aria-hidden /> : <Circle className="size-4" aria-hidden />}
              STEP {i + 1}
              {s.done ? <span className="sr-only">(done)</span> : null}
            </span>
            <p className="font-semibold">{s.title}</p>
            <p className="text-sm leading-relaxed text-ink-muted">{s.body}</p>
            <Button asChild size="sm" variant={!s.done && steps.slice(0, i).every((x) => x.done) ? "primary" : "secondary"} className="mt-auto w-fit">
              <Link href={s.href}>{s.cta}</Link>
            </Button>
          </li>
        ))}
      </ol>
    </section>
  );
}

/* ---- Primary actions ------------------------------------------------------ */

function AutopilotCard({ suggestions, credits }: { suggestions: readonly string[]; credits: DashboardData["credits"] }) {
  return (
    <article className="relative isolate flex min-h-[460px] flex-col justify-end overflow-hidden rounded-2xl text-on-media">
      <MediaArt asset={getMedia("coast-sail")} className="-z-20" />
      <div aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-t from-media-veil/85 via-media-veil/35 to-media-veil/5" />
      <div className="absolute top-5 left-5 flex items-center gap-2">
        <span className="rounded-pill bg-on-media px-3 py-1.5 font-mono text-[11px] tracking-[0.08em] text-media-veil">AUTOPILOT</span>
        <AiBadge>Fastest way</AiBadge>
      </div>
      <PlaceholderTag className="top-5 right-5 left-auto" />
      <div className="flex flex-col gap-4 p-5 sm:p-7">
        <div className="max-w-xl">
          <h2 className="font-display text-[clamp(30px,3.2vw,44px)] leading-[1] font-semibold tracking-[-0.03em]">
            Make a video <em className="font-accent font-normal">in minutes.</em>
          </h2>
          <p className="mt-2.5 text-[15px] leading-relaxed text-on-media/85">Describe it in a sentence. Autopilot writes the brief, proposes concepts and builds a storyboard from your own footage.</p>
        </div>
        <AutopilotPrompt suggestions={suggestions} />
        <p className="font-mono text-[11px] text-on-media/75">
          Storyboard previews are free · {credits.available} video credit{credits.available === 1 ? "" : "s"} available ({credits.allowanceLabel})
        </p>
      </div>
    </article>
  );
}

const STATUS: Record<string, ReactNode> = {
  draft: <Badge>Draft</Badge>,
  storyboarding: <Badge tone="warning">Storyboard needs footage</Badge>,
  ready_to_render: <Badge tone="warning">Ready to render</Badge>,
  rendering: <AiBadge>Rendering</AiBadge>,
  completed: <Badge tone="success">Video ready</Badge>,
  archived: <Badge tone="outline">Archived</Badge>,
};
const statusBadge = (s: string) => STATUS[s] ?? <Badge>{s}</Badge>;

function StudioCard({ project, hasMedia }: { project: DashboardProject | null; hasMedia: boolean }) {
  return (
    <article className="mode-studio flex flex-col gap-5 rounded-2xl border border-line bg-bg p-5 text-ink sm:p-7">
      <div className="flex items-start justify-between gap-4">
        <div>
          <span className="inline-block rounded-pill bg-primary px-3 py-1.5 font-mono text-[11px] tracking-[0.08em] text-primary-foreground">STUDIO</span>
          <h2 className="mt-4 font-display text-[clamp(28px,2.6vw,36px)] leading-none font-semibold tracking-[-0.03em]">Edit with full control.</h2>
          <p className="mt-2.5 max-w-sm text-[15px] leading-relaxed text-ink-muted">Scene by scene: footage, timing, on-screen text, and an assistant that revises on request.</p>
        </div>
        <Clapperboard className="hidden size-7 shrink-0 text-ink-muted sm:block" strokeWidth={1.5} aria-hidden />
      </div>
      {project ? (
        <>
          <div className="flex flex-1 gap-3 rounded-[18px] border border-line bg-surface p-3">
            <Thumb src={project.thumbnail} alt="" ratio="9:16" className="w-[30%] max-w-[120px] shrink-0 rounded-[10px]" />
            <div className="flex min-w-0 flex-1 flex-col justify-center gap-2 text-sm">
              <span className="font-mono text-[10px] text-ink-muted">MOST RECENT PROJECT</span>
              <span className="font-medium">{project.name}</span>
              <span>{statusBadge(project.status)}</span>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="font-mono text-xs text-ink-muted">
              {project.format ?? "No storyboard yet"} · edited {relativeTime(project.updated_at)}
            </p>
            <Button asChild variant="primary" className="px-5">
              <Link href={`/studio?project=${project.id}`}>
                Resume in Studio <ArrowRight aria-hidden />
              </Link>
            </Button>
          </div>
        </>
      ) : (
        <div className="flex flex-1 flex-col justify-end gap-3 rounded-[18px] border border-dashed border-line-strong p-5 text-sm text-ink-muted">
          <p>No projects yet. {hasMedia ? "Start one with Autopilot, then fine-tune it here." : "Upload footage first: Studio works with your own clips."}</p>
          <Button asChild variant="primary" className="w-fit px-5">
            <Link href={hasMedia ? "/autopilot" : "/library"}>
              {hasMedia ? "Start with Autopilot" : "Upload footage"} <ArrowRight aria-hidden />
            </Link>
          </Button>
        </div>
      )}
    </article>
  );
}

/* ---- Supporting ----------------------------------------------------------- */

function SectionHead({ id, title, aside }: { id: string; title: string; aside?: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <h2 id={id} className="font-display text-xl font-semibold tracking-tight">
        {title}
      </h2>
      {aside}
    </div>
  );
}

function AsideLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="text-sm text-link underline-offset-4 hover:underline">
      {children}
    </Link>
  );
}

function ProjectCard({ project }: { project: DashboardProject }) {
  return (
    <Link href={`/studio?project=${project.id}`} className="group flex flex-col gap-2.5 rounded-lg">
      <Thumb src={project.thumbnail} alt="" ratio="4:5" className="rounded-lg transition-transform duration-(--rd-dur) ease-brand group-hover:-translate-y-0.5">
        <span className="absolute top-2 left-2">{statusBadge(project.status)}</span>
        {project.format ? (
          <span className="absolute right-2 bottom-2 rounded-pill bg-media-veil/55 px-2 py-0.5 font-mono text-[10px] text-on-media">
            {project.format}
            {project.duration_seconds ? ` · ${duration(project.duration_seconds)}` : ""}
          </span>
        ) : null}
      </Thumb>
      <div className="px-0.5">
        <p className="truncate text-sm font-medium group-hover:underline">{project.name}</p>
        <p className="font-mono text-[11px] text-ink-muted">edited {relativeTime(project.updated_at)}</p>
      </div>
    </Link>
  );
}

function activityLabel(a: DashboardActivity): { text: string; tone: "primary" | "ai" | "danger" | "success"; progress: number | null } {
  if (a.status === "awaiting_upload") return { text: "Waiting for upload to finish", tone: "primary", progress: null };
  if (a.status === "failed") return { text: a.analysis?.error ?? "Upload failed or was cancelled", tone: "danger", progress: null };
  if (a.analysis?.status === "failed") return { text: a.analysis.error ?? "Analysis failed", tone: "danger", progress: null };
  if (a.analysis?.status === "queued") return { text: "Queued for analysis", tone: "ai", progress: null };
  if (a.analysis?.status === "running") return { text: a.analysis.stage ? `Analysing: ${a.analysis.stage}` : "Analysing", tone: "ai", progress: a.analysis.progress_percent };
  if (a.status === "ready") return { text: "Analysed", tone: "success", progress: null };
  return { text: a.kind === "video" ? "Uploaded, not analysed yet" : "Uploaded", tone: "primary", progress: null };
}

function FootageCard({ data }: { data: DashboardData }) {
  return (
    <section aria-labelledby="footage-title" className="flex flex-col gap-5 rounded-xl border border-line bg-surface p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="footage-title" className="font-display text-xl font-semibold tracking-tight">
            Footage
          </h2>
          <p className="mt-1 font-mono text-xs text-ink-muted">
            {data.counts.media} file{data.counts.media === 1 ? "" : "s"} in your library
          </p>
        </div>
        <Button asChild variant="secondary" size="sm">
          <Link href="/library">
            <UploadCloud aria-hidden />
            Upload
          </Link>
        </Button>
      </div>

      {data.activity.length ? (
        <ul className="flex flex-col gap-3" aria-label="Processing">
          {data.activity.map((a) => {
            const l = activityLabel(a);
            return (
              <li key={a.id} className="flex items-center gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-surface-muted">
                  {l.tone === "danger" ? <AlertTriangle className="size-4 text-danger" aria-hidden /> : l.tone === "success" ? <CheckCircle2 className="size-4 text-success" aria-hidden /> : <Loader2 className="size-4 animate-spin text-ai motion-reduce:animate-none" aria-hidden />}
                </span>
                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <Link href={`/library?media=${a.id}`} className="truncate font-medium hover:underline">
                      {a.title}
                    </Link>
                    {l.progress !== null ? <span className="shrink-0 font-mono text-[11px] text-ink-muted">{Math.round(l.progress)}%</span> : null}
                  </div>
                  {l.progress !== null ? <ProgressBar label={`${a.title} analysis`} value={l.progress} tone="ai" size="sm" /> : null}
                  <span className={l.tone === "danger" ? "text-xs text-danger" : "text-xs text-ink-muted"}>{l.text}</span>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="rounded-md bg-surface-muted px-4 py-3 text-sm text-ink-muted">{data.counts.media ? "Nothing processing right now." : "Upload your first clips to see them analysed here."}</p>
      )}

      {data.moments.length ? (
        <div className="flex flex-col gap-3 border-t border-line pt-5">
          <div className="flex flex-wrap items-center gap-2">
            <Sparkles className="size-4 text-ai" aria-hidden />
            <p className="text-sm">
              <span className="font-medium">Your strongest clips.</span> <span className="text-ink-muted">Ranked by the analysis quality score.</span>
            </p>
          </div>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {data.moments.map((m) => (
              <li key={m.id} className="flex flex-col gap-1.5">
                <Link href={`/library?media=${m.id}`}>
                  <Thumb src={m.thumbnail_url} alt={m.title} ratio="16:9">
                    {m.quality_score !== null ? <span className="absolute top-1.5 right-1.5 rounded-pill bg-ai px-1.5 py-0.5 font-mono text-[10px] text-ai-foreground">{Math.round(m.quality_score)}</span> : null}
                  </Thumb>
                </Link>
                <span className="truncate text-xs text-ink-muted">{m.title}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

function ExportsCard({ exports, failed }: { exports: DashboardExport[]; failed: DashboardFailedRender[] }) {
  return (
    <section aria-labelledby="exports-title" className="flex flex-col gap-4 rounded-xl border border-line bg-surface p-5 sm:p-6">
      <SectionHead id="exports-title" title="Recent exports" aside={<AsideLink href="/exports">All exports</AsideLink>} />
      {exports.length || failed.length ? (
        <ul className="flex flex-col divide-y divide-line">
          {failed.slice(0, 2).map((f) => (
            <li key={f.job_id} className="flex items-center gap-3 py-3 first:pt-0">
              <RotateCcw className="size-4 shrink-0 text-danger" aria-hidden />
              <div className="min-w-0 flex-1 text-sm">
                <p className="font-medium">Render failed · not charged</p>
                <p className="truncate text-xs text-ink-muted">{f.error?.message ?? "Failed on our side"}</p>
              </div>
              {f.project_id ? (
                <Button asChild size="sm" variant="secondary">
                  <Link href={`/studio?project=${f.project_id}`}>Review</Link>
                </Button>
              ) : null}
            </li>
          ))}
          {exports.map((e) => (
            <li key={e.export_id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{e.project_name ?? "Video"}</p>
                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                  <Badge tone="outline" size="sm">
                    {e.format}
                  </Badge>
                  <span className="font-mono text-[11px] text-ink-muted">
                    {duration(e.duration_seconds)} · {relativeTime(e.created_at)}
                  </span>
                </div>
              </div>
              {e.status === "ready" ? <ExportDownload exportId={e.export_id} /> : <span className="text-xs text-danger">Failed</span>}
            </li>
          ))}
        </ul>
      ) : (
        <p className="flex items-center gap-2 rounded-md bg-surface-muted px-4 py-3 text-sm text-ink-muted">
          <Download className="size-4" aria-hidden /> Finished videos appear here, ready to download.
        </p>
      )}
      <p className="mt-auto rounded-md bg-surface-muted px-3.5 py-3 text-xs text-ink-muted">Credits are only spent when a render succeeds. If a render fails on our side, re-rendering is free.</p>
    </section>
  );
}

const KIND_LABEL: Record<string, string> = { grant: "Allowance", hold: "Held for render", release: "Released", charge: "Video rendered", refund: "Refund", adjustment: "Adjustment" };

function CreditsCard({ data }: { data: DashboardData }) {
  const rows = data.history.filter((h) => h.kind !== "release" && h.kind !== "hold").slice(0, 4);
  return (
    <section aria-labelledby="credits-title" className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-5 sm:p-6">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="credits-title" className="font-display text-xl font-semibold tracking-tight">
          Credits
        </h2>
        <span className="font-mono text-xs text-ink-muted">
          {data.credits.available} available{data.credits.held ? ` · ${data.credits.held} held` : ""}
        </span>
      </div>
      {rows.length ? (
        <ul className="flex flex-col gap-1.5 text-sm">
          {rows.map((h, i) => (
            <li key={i} className="flex justify-between gap-3">
              <span className="truncate text-ink-muted">{h.note ?? KIND_LABEL[h.kind] ?? h.kind}</span>
              <span className="shrink-0 font-mono text-xs">{h.amount > 0 ? `+${h.amount}` : h.amount}</span>
            </li>
          ))}
        </ul>
      ) : null}
      {!data.brand ? null : (
        <p className="flex items-center gap-1.5 text-xs text-ink-muted">
          <Shield className="size-3.5" aria-hidden /> Brand: {data.brand.name}
          {data.brandCount > 1 ? ` + ${data.brandCount - 1} more` : ""}
        </p>
      )}
    </section>
  );
}
