import { ArrowRight, Clapperboard, Download, RotateCcw, Sparkles, UploadCloud } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { MediaArt, PlaceholderTag } from "@/components/media/media-art";
import { MediaThumb } from "@/components/media/media-thumb";
import { AiBadge, Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Eyebrow, SampleDataNote } from "@/components/ui/misc";
import { ProgressBar } from "@/components/ui/progress";
import { getMedia } from "@/content/media";
import {
  SAMPLE_BEST_MOMENTS,
  SAMPLE_EXPORTS,
  SAMPLE_LIBRARY,
  SAMPLE_PROCESSING,
  SAMPLE_PROJECTS,
  type SampleProject,
} from "@/content/sample/dashboard";
import { SAMPLE_WORKSPACE, sampleUsageMeters } from "@/content/sample/workspace";
import { cn } from "@/lib/utils";
import { AutopilotPrompt } from "./autopilot-prompt";

/*
  App dashboard (Phase 1 design, no approved canvas design existed).
  Two primary actions lead: Autopilot (make a video from a sentence) and
  Studio (edit with full control). Projects, footage, exports and usage
  support them below. Everything shown is labelled sample data.
*/
export function DashboardScreen() {
  const { meters } = sampleUsageMeters();
  return (
    <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-10 px-4 py-6 sm:px-6 lg:px-10 lg:py-9">
      {/* Greeting and quiet usage strip */}
      <header className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Eyebrow>
            {SAMPLE_WORKSPACE.name} · {SAMPLE_WORKSPACE.kind}
          </Eyebrow>
          <SampleDataNote />
        </div>
        <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-3">
          <h1 className="font-display text-[clamp(34px,4vw,54px)] leading-[0.98] font-semibold tracking-display">
            What are we making <em className="font-accent font-normal">today?</em>
          </h1>
          <dl aria-label="Usage this month" className="flex flex-wrap gap-x-5 gap-y-1 pb-1 text-[13px]">
            {meters.map((m) => (
              <div key={m.id} className="flex items-baseline gap-1.5">
                <dt className="text-ink-muted">{m.label}</dt>
                <dd className="font-mono text-xs">{m.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </header>

      {/* The two ways to work */}
      <section aria-label="Create" className="grid gap-4 xl:grid-cols-[1.35fr_1fr]">
        <AutopilotCard />
        <StudioCard project={SAMPLE_PROJECTS[0]} />
      </section>

      {/* Continue where you left off */}
      <section aria-labelledby="recent-title" className="flex flex-col gap-4">
        <SectionHead id="recent-title" title="Continue where you left off" aside={<SoonLabel>All projects</SoonLabel>} />
        <ul className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 sm:-mx-6 sm:px-6 lg:mx-0 lg:grid lg:grid-cols-5 lg:overflow-visible lg:px-0">
          {SAMPLE_PROJECTS.map((p) => (
            <li key={p.id} className="w-[200px] shrink-0 snap-start lg:w-auto">
              <ProjectCard project={p} />
            </li>
          ))}
        </ul>
      </section>

      {/* Supporting: footage and exports */}
      <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        <FootageCard />
        <ExportsCard />
      </div>
    </div>
  );
}

/* ---- Primary actions ------------------------------------------------------ */

function AutopilotCard() {
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
          <p className="mt-2.5 text-[15px] leading-relaxed text-on-media/85">
            Describe it in a sentence. Autopilot picks the best moments from your library and cuts three on-brand options.
          </p>
        </div>
        <AutopilotPrompt />
        <p className="font-mono text-[11px] text-on-media/75">Storyboard previews are free · 1 video credit per finished video</p>
      </div>
    </article>
  );
}

function StudioCard({ project }: { project: SampleProject }) {
  const asset = getMedia(project.media);
  return (
    <article className="mode-studio flex flex-col gap-5 rounded-2xl border border-line bg-bg p-5 text-ink sm:p-7">
      <div className="flex items-start justify-between gap-4">
        <div>
          <span className="inline-block rounded-pill bg-primary px-3 py-1.5 font-mono text-[11px] tracking-[0.08em] text-primary-foreground">STUDIO</span>
          <h2 className="mt-4 font-display text-[clamp(28px,2.6vw,36px)] leading-none font-semibold tracking-[-0.03em]">Edit with full control.</h2>
          <p className="mt-2.5 max-w-sm text-[15px] leading-relaxed text-ink-muted">Timeline, colour, captions and an assistant that edits on request.</p>
        </div>
        <Clapperboard className="hidden size-7 shrink-0 text-ink-muted sm:block" strokeWidth={1.5} aria-hidden />
      </div>

      {/* Resume the latest project: a still of the editor. */}
      <div className="flex flex-1 flex-col gap-3 rounded-[18px] border border-line bg-surface p-3" aria-hidden>
        <div className="flex gap-3">
          <div className="relative aspect-[9/16] w-[30%] max-w-[120px] shrink-0 overflow-hidden rounded-[10px]">
            <MediaArt asset={asset} />
            <span className="absolute inset-x-2 bottom-[22%] rounded-[6px] bg-media-veil/60 px-1.5 py-1 text-center text-[9px] font-semibold text-on-media">
              Wake up to this.
            </span>
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-2 rounded-[10px] bg-surface-muted p-3 text-xs">
            <span className="font-mono text-[10px] text-ink-muted">ASSISTANT</span>
            <span className="rounded-lg bg-bg p-2">Make the opening warmer and add the booking link.</span>
            <span className="rounded-lg bg-ai p-2 text-ai-foreground">Done. Colour grade and end card updated.</span>
          </div>
        </div>
        <div className="relative flex flex-col gap-1">
          <div className="flex h-5 gap-1">
            {[3, 2, 4, 2, 3].map((f, i) => (
              <span key={i} className="rounded-[5px] bg-primary/85" style={{ flex: f }} />
            ))}
          </div>
          <div className="flex h-3 gap-1">
            <span className="flex-[2]" />
            <span className="flex-[4] rounded bg-tint" />
            <span className="flex-[6]" />
            <span className="flex-[2] rounded bg-ai" />
          </div>
          <div className="flex h-2.5 gap-1">
            <span className="flex-1 rounded bg-ink-muted/35" />
          </div>
          <span className="absolute -top-1 bottom-0 left-[41%] w-0.5 rounded-pill bg-ai" />
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 text-sm">
          <p className="truncate font-medium">{project.title}</p>
          <p className="font-mono text-xs text-ink-muted">
            {project.format} · {project.ratio} · edited {project.updated}
          </p>
        </div>
        <Button asChild variant="primary" className="px-5">
          <Link href="/studio">
            Open Studio <ArrowRight aria-hidden />
          </Link>
        </Button>
      </div>
    </article>
  );
}

/* ---- Supporting --------------------------------------------------------- */

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

function SoonLabel({ children }: { children: ReactNode }) {
  return (
    <span className="hidden text-sm text-ink-muted sm:inline">
      {children} <span className="font-mono text-[10px] uppercase">· soon</span>
    </span>
  );
}

const statusBadge: Record<SampleProject["status"], ReactNode> = {
  draft: <Badge>Draft</Badge>,
  review: <Badge tone="warning">Needs your OK</Badge>,
  rendering: <AiBadge>Rendering</AiBadge>,
  ready: <Badge tone="success">Ready</Badge>,
};

function ProjectCard({ project }: { project: SampleProject }) {
  return (
    <Link href="/studio" className="group flex flex-col gap-2.5 rounded-lg">
      <div className="relative">
        <MediaThumb
          asset={getMedia(project.media)}
          ratio="4:5"
          showTag={false}
          showDuration={false}
          className="transition-transform duration-(--rd-dur) ease-brand group-hover:-translate-y-0.5"
        />
        <span className="absolute top-2 left-2">{statusBadge[project.status]}</span>
        <span className="absolute right-2 bottom-2 rounded-pill bg-media-veil/55 px-2 py-0.5 font-mono text-[10px] text-on-media">
          {project.ratio} · {project.duration}
        </span>
        {project.status === "rendering" && project.progress !== undefined && (
          <ProgressBar label={`${project.title} render progress`} value={project.progress} tone="ai" size="sm" className="absolute inset-x-2 bottom-9 w-auto" />
        )}
      </div>
      <div className="px-0.5">
        <p className="truncate text-sm font-medium group-hover:underline">{project.title}</p>
        <p className="font-mono text-[11px] text-ink-muted">
          {project.format} · {project.via} · {project.updated}
        </p>
      </div>
    </Link>
  );
}

function FootageCard() {
  return (
    <section aria-labelledby="footage-title" className="flex flex-col gap-5 rounded-xl border border-line bg-surface p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="footage-title" className="font-display text-xl font-semibold tracking-tight">
            Footage
          </h2>
          <p className="mt-1 font-mono text-xs text-ink-muted">
            {SAMPLE_LIBRARY.clips} clips · {SAMPLE_LIBRARY.hoursAnalysed} hrs analysed
          </p>
        </div>
        {/* Uploading arrives with the media library (Phase 3). */}
        <Button variant="secondary" size="sm" disabled title="Uploads arrive with the media library">
          <UploadCloud aria-hidden />
          Upload · soon
        </Button>
      </div>

      <ul className="flex flex-col gap-3" aria-label="Processing">
        {SAMPLE_PROCESSING.map((f) => (
          <li key={f.id} className="flex items-center gap-3">
            <div className="relative size-12 shrink-0 overflow-hidden rounded-md">
              <MediaArt asset={getMedia(f.media)} />
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="truncate font-medium">{f.name}</span>
                <span className="shrink-0 font-mono text-[11px] text-ink-muted">
                  {f.stage === "uploading" ? "Uploading" : "Analysing"} {f.progress}%
                </span>
              </div>
              <ProgressBar label={`${f.name} ${f.stage}`} value={f.progress} tone={f.stage === "analysing" ? "ai" : "primary"} size="sm" />
              <span className="text-xs text-ink-muted">{f.detail}</span>
            </div>
          </li>
        ))}
      </ul>

      <div className="flex flex-col gap-3 border-t border-line pt-5">
        <div className="flex flex-wrap items-center gap-2">
          <Sparkles className="size-4 text-ai" aria-hidden />
          <p className="text-sm">
            <span className="font-medium">Best moments from your latest upload.</span>{" "}
            <span className="text-ink-muted">AI scored {SAMPLE_LIBRARY.newClips} new clips.</span>
          </p>
        </div>
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {SAMPLE_BEST_MOMENTS.map((m) => (
            <li key={m.id} className="flex flex-col gap-1.5">
              <MediaThumb asset={getMedia(m.media)} ratio="16:9" score={m.score} showTag={false} />
              <span className="truncate text-xs text-ink-muted">{m.label}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function ExportsCard() {
  return (
    <section aria-labelledby="exports-title" className="flex flex-col gap-4 rounded-xl border border-line bg-surface p-5 sm:p-6">
      <SectionHead id="exports-title" title="Recent exports" aside={<SoonLabel>All exports</SoonLabel>} />
      <ul className="flex flex-col divide-y divide-line">
        {SAMPLE_EXPORTS.map((e) => (
          <li key={e.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
            <div className="relative h-14 w-11 shrink-0 overflow-hidden rounded-md">
              <MediaArt asset={getMedia(e.media)} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{e.title}</p>
              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                {e.formats.map((f) => (
                  <Badge key={f} tone="outline" size="sm">
                    {f}
                  </Badge>
                ))}
                <span className="font-mono text-[11px] text-ink-muted">{e.when}</span>
              </div>
            </div>
            {e.status === "delivered" ? (
              <span className="inline-flex items-center gap-1 text-xs text-success">
                <Download className="size-3.5" aria-hidden />
                Delivered
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-right text-xs text-danger">
                <RotateCcw className="size-3.5 shrink-0" aria-hidden />
                Failed · free re-render
              </span>
            )}
          </li>
        ))}
      </ul>
      <p className={cn("mt-auto rounded-md bg-surface-muted px-3.5 py-3 text-xs text-ink-muted")}>
        Credits are only spent when a render succeeds. If a render fails on our side, re-rendering is free.
      </p>
    </section>
  );
}
