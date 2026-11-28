import { Captions, History, LayoutPanelTop, MessageSquareText, Music, Search, ShieldCheck, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Accent, SectionEyebrow } from "@/components/marketing/shared";
import { MediaArt, PlaceholderTag } from "@/components/media/media-art";
import { Container } from "@/components/ui/misc";
import { getMedia, type MediaId } from "@/content/media";
import {
  AUTOPILOT_STEPS,
  BRAND_CHIPS,
  EXPORT_FORMATS,
  LIBRARY_QUERY,
  LIBRARY_RESULTS,
  ORBIT_INNER,
  ORBIT_OUTER,
  PRODUCT_SECTIONS,
  STUDIO_FEATURES,
  type StudioFeatureIcon,
  type StudioFeatureTone,
} from "@/content/product";
import { cn } from "@/lib/utils";

/*
  /product sections (design/website/W-Product.dc.html). The design embeds the live
  Studio and Autopilot screens; here they are static illustrations built from tokens,
  so the marketing page stays light and nothing on it looks clickable when it isn't.
*/

const displayH2 = "font-display text-[clamp(40px,4.8vw,68px)] leading-[0.98] font-semibold tracking-[-0.04em]";

/* ---- Hero --------------------------------------------------------------- */

export function ProductHero() {
  return (
    <section aria-labelledby="page-title" className="relative isolate overflow-hidden pt-12 text-center sm:pt-18">
      <div aria-hidden className="absolute inset-x-[10%] -top-40 -z-10 h-[300px] bg-grad-blue opacity-45 blur-[90px]" />
      <Container>
        <SectionEyebrow className="justify-center">The product</SectionEyebrow>
        <h1 id="page-title" className="mx-auto max-w-[1080px] font-display text-[clamp(40px,5.4vw,80px)] leading-[1.06] font-semibold tracking-[-0.04em]">
          A video studio that works <Accent>for you</Accent>, or{" "}
          <span className="inline-block -rotate-[1.5deg] rounded-[0.24em] bg-tint px-[0.25em] text-on-tint underline decoration-ai decoration-[0.07em] underline-offset-[0.14em]">
            with you.
          </span>
        </h1>
        <p className="mx-auto mt-6 max-w-[620px] text-lg leading-relaxed text-ink-muted sm:text-[19px]">
          Autopilot makes the video for you. Studio lets you shape every cut. Both run on the same brand, library and projects.
        </p>
        <nav aria-label="On this page" className="mt-9 inline-flex flex-wrap justify-center gap-1 rounded-pill border border-line bg-surface p-1 text-sm font-medium">
          {PRODUCT_SECTIONS.map((s, i) => (
            <a
              key={s.id}
              href={`#${s.id}`}
              className={cn("rounded-pill px-4 py-2.5 transition-colors", i === 0 ? "bg-ink text-bg" : "hover:bg-surface-muted")}
            >
              {s.label}
            </a>
          ))}
        </nav>
      </Container>
      <div className="mx-auto mt-14 max-w-[1180px] px-5">
        <StudioIllustration />
      </div>
    </section>
  );
}

/** Static picture of the Studio editor: preview, assistant and timeline. */
function StudioIllustration() {
  return (
    <div
      role="img"
      aria-label="Illustration of the Studio editor: a video preview, an assistant panel and a multi-track timeline"
      className="mode-studio flex h-[360px] flex-col gap-3 overflow-hidden rounded-t-2xl border border-b-0 border-line bg-bg p-3 text-left text-ink shadow-float sm:h-[520px] lg:h-[600px]"
    >
      <div aria-hidden className="flex items-center justify-between rounded-lg bg-surface px-3.5 py-2.5 text-xs">
        <span className="font-mono text-ink-muted">SUMMER REEL · V3</span>
        <span className="rounded-pill bg-action px-3 py-1 font-semibold text-action-foreground">Render</span>
      </div>
      <div aria-hidden className="flex min-h-0 flex-1 gap-3">
        <div className="hidden w-[18%] flex-col gap-2 rounded-lg bg-surface p-2.5 md:flex">
          <span className="font-mono text-[10px] text-ink-muted">CLIPS</span>
          {(["product-steaming-cliff", "product-water-ripples", "product-steaming-shore", "product-lake-sunset"] as const).map((id) => (
            <div key={id} className="relative aspect-video overflow-hidden rounded-md">
              <MediaArt asset={getMedia(id)} />
            </div>
          ))}
        </div>
        <div className="relative min-w-0 flex-1 overflow-hidden rounded-lg">
          <MediaArt asset={getMedia("product-swans-dawn")} />
          <PlaceholderTag asset={getMedia("product-swans-dawn")} />
          <span className="absolute inset-x-[18%] bottom-6 rounded-md bg-media-veil/70 px-3 py-2 text-center text-sm font-semibold text-on-media">
            Wake up to this.
          </span>
        </div>
        <div className="hidden w-[24%] flex-col gap-2 rounded-lg bg-surface p-3 text-xs sm:flex">
          <span className="font-mono text-[10px] text-ink-muted">ASSISTANT</span>
          <span className="rounded-md bg-bg p-2.5">Open on the lake and make it 15 seconds.</span>
          <span className="rounded-md bg-ai p-2.5 text-ai-foreground">Done. Trimmed to 0:15 and moved the kayak shot first.</span>
          <span className="mt-auto flex gap-1.5">
            <span className="flex-1 rounded-pill bg-primary py-1.5 text-center text-primary-foreground">Keep</span>
            <span className="flex-1 rounded-pill border border-line py-1.5 text-center">Undo</span>
          </span>
        </div>
      </div>
      <div aria-hidden className="relative flex flex-col gap-1.5 rounded-lg bg-surface p-3">
        <span className="absolute top-1 bottom-1 left-[38%] w-0.5 rounded bg-ai" />
        <div className="flex h-7 gap-1">
          {[3, 2, 4, 2, 3].map((f, i) => (
            <span key={i} className="rounded-sm bg-primary" style={{ flex: f }} />
          ))}
        </div>
        <div className="flex h-4 gap-1">
          <span className="flex-[2]" />
          <span className="flex-[5] rounded-sm bg-tint" />
          <span className="flex-[4]" />
          <span className="flex-[2] rounded-sm bg-ai" />
        </div>
        <div className="h-3 rounded-sm bg-surface-muted" />
      </div>
    </div>
  );
}

/* ---- Autopilot ---------------------------------------------------------- */

export function AutopilotSection() {
  return (
    <section id="autopilot" aria-labelledby="autopilot-title" className="scroll-mt-6 bg-surface-muted py-20 sm:py-28">
      <Container className="flex flex-wrap items-center gap-14">
        <div className="min-w-0 flex-[1_1_380px]">
          <span className="inline-block rounded-pill bg-ink px-3 py-1.5 font-mono text-[11px] tracking-[0.08em] text-bg">AUTOPILOT · MOBILE FIRST</span>
          <h2 id="autopilot-title" className={cn(displayH2, "mt-5 mb-4.5")}>
            Three taps <Accent>to a finished video.</Accent>
          </h2>
          <p className="mb-8 text-lg leading-relaxed text-ink-soft">
            Made for the person who shot the footage and has ten minutes between guests. No timeline, no jargon.
          </p>
          <ol className="flex flex-col">
            {AUTOPILOT_STEPS.map((s) => (
              <li key={s.n} className="flex gap-4.5 border-t border-line-strong py-4.5">
                <span className="pt-1 font-mono text-[13px] text-link">{s.n}</span>
                <span>
                  <span className="mb-1 block font-display text-xl font-semibold">{s.title}</span>
                  <span className="text-[15px] leading-normal text-ink-soft">{s.text}</span>
                </span>
              </li>
            ))}
          </ol>
        </div>
        <div className="flex min-w-0 flex-[1.3_1_560px] items-end justify-center gap-4" role="img" aria-label="Three Autopilot phone screens: the brief, the AI working, and three options to review">
          <Phone>
            <span className="font-mono text-[9px] text-ink-muted">NEW VIDEO</span>
            <span className="font-display text-base leading-tight font-semibold">What is this video for?</span>
            <span className="rounded-lg border border-line bg-surface p-2 text-[11px]">A 20s reel for the summer sunset cruise</span>
            <div className="grid grid-cols-3 gap-1">
              {(["product-drone-wake", "product-cruise-guests", "product-cruise-hills", "product-cruise-lunch", "product-drone-boat", "product-boat-wake"] as const).map((id) => (
                <div key={id} className="relative aspect-square overflow-hidden rounded-md">
                  <MediaArt asset={getMedia(id)} />
                </div>
              ))}
            </div>
            <span className="mt-auto rounded-pill bg-action py-2 text-center text-[11px] font-semibold text-action-foreground">Make my video</span>
          </Phone>
          <Phone className="sm:-translate-y-10">
            <span className="font-mono text-[9px] text-ink-muted">WORKING</span>
            <span className="font-display text-base leading-tight font-semibold">Building three options</span>
            {["Watching 18 clips", "Picking best moments", "Editing to your brand"].map((t, i) => (
              <span key={t} className="flex items-center gap-2 rounded-lg bg-surface p-2 text-[11px]">
                <span className={cn("size-2 rounded-full", i < 2 ? "bg-primary" : "bg-ai")} />
                {t}
              </span>
            ))}
            <div className="mt-auto h-1.5 overflow-hidden rounded-pill bg-surface">
              <div className="h-full w-2/3 rounded-pill bg-ai" />
            </div>
          </Phone>
          <Phone className="hidden sm:flex">
            <span className="font-mono text-[9px] text-ink-muted">REVIEW</span>
            <span className="font-display text-base leading-tight font-semibold">Pick your favourite</span>
            {(["product-cruise-guests", "product-boat-wake"] as const).map((id, i) => (
              <div key={id} className={cn("relative h-20 overflow-hidden rounded-lg", i === 0 && "ring-2 ring-ai")}>
                <MediaArt asset={getMedia(id)} />
                <span className="absolute bottom-1 left-1 rounded-pill bg-media-veil/60 px-1.5 text-[9px] text-on-media">Option {i + 1}</span>
              </div>
            ))}
            <span className="mt-auto rounded-pill bg-action py-2 text-center text-[11px] font-semibold text-action-foreground">Approve option 1</span>
          </Phone>
        </div>
      </Container>
    </section>
  );
}

function Phone({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div aria-hidden className={cn("flex h-[440px] w-[204px] shrink-0 rounded-[32px] bg-ink p-1.5", className)}>
      <div className="flex flex-1 flex-col gap-2.5 overflow-hidden rounded-[27px] bg-bg p-3.5 pt-6 text-ink">{children}</div>
    </div>
  );
}

/* ---- Studio ------------------------------------------------------------- */

const FEATURE_ICONS: Record<StudioFeatureIcon, LucideIcon> = {
  timeline: LayoutPanelTop,
  assistant: MessageSquareText,
  captions: Captions,
  music: Music,
  brand: ShieldCheck,
  versions: History,
};

const FEATURE_TONES: Record<StudioFeatureTone, string> = {
  primary: "bg-primary text-primary-foreground",
  ai: "bg-ai text-ai-foreground",
  surface: "bg-ink text-bg",
  tint: "bg-tint text-on-tint",
};

export function StudioSection() {
  return (
    <section id="studio" aria-labelledby="studio-title" className="mode-studio scroll-mt-6 bg-bg py-20 text-ink sm:py-28">
      <Container>
        <div className="mb-14 flex flex-wrap items-end justify-between gap-6">
          <div>
            <span className="inline-block rounded-pill bg-primary px-3 py-1.5 font-mono text-[11px] tracking-[0.08em] text-primary-foreground">STUDIO · DESKTOP</span>
            <h2 id="studio-title" className={cn(displayH2, "mt-5 max-w-[760px]")}>
              Powerful enough to finish it. <Accent>Simple enough to enjoy.</Accent>
            </h2>
          </div>
          <p className="max-w-[380px] text-[17px] leading-relaxed text-ink-muted">Open any Autopilot draft and keep going. Same project, same versions, nothing lost.</p>
        </div>
        <ul className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
          {STUDIO_FEATURES.map((f) => {
            const Icon = FEATURE_ICONS[f.icon];
            return (
              <li key={f.title} className="flex min-h-[220px] flex-col gap-10 rounded-xl border border-line bg-surface p-7">
                <span aria-hidden className={cn("flex size-12 items-center justify-center rounded-[14px]", FEATURE_TONES[f.tone])}>
                  <Icon className="size-5.5" strokeWidth={1.9} />
                </span>
                <div>
                  <h3 className="mb-2 font-display text-[22px] font-semibold">{f.title}</h3>
                  <p className="text-[15px] leading-normal text-ink-muted">{f.text}</p>
                </div>
              </li>
            );
          })}
        </ul>
      </Container>
    </section>
  );
}

/* ---- Brand intelligence (design/components/Orbit.dc.html) ---------------- */

function ringPositions(ids: readonly MediaId[]) {
  return ids.map((id, i) => {
    const a = (i / ids.length) * Math.PI * 2;
    return { id, left: `${(50 + 50 * Math.cos(a)).toFixed(2)}%`, top: `${(50 + 50 * Math.sin(a)).toFixed(2)}%` };
  });
}

export function BrandSection() {
  const outer = ringPositions(ORBIT_OUTER);
  const inner = ringPositions(ORBIT_INNER);
  // Counter-rotation keeps the thumbnails upright while their ring turns. Motion stops for reduced-motion users.
  const spinOuter = "animate-[rd-spin_40s_linear_infinite] motion-reduce:animate-none";
  const unspinOuter = "animate-[rd-spin_40s_linear_infinite_reverse] motion-reduce:animate-none";
  const spinInner = "animate-[rd-spin_28s_linear_infinite_reverse] motion-reduce:animate-none";
  const unspinInner = "animate-[rd-spin_28s_linear_infinite] motion-reduce:animate-none";
  return (
    <section id="brand" aria-labelledby="brand-title" className="mode-studio scroll-mt-6 border-t border-line bg-bg py-20 text-ink sm:py-30">
      <Container className="flex flex-wrap items-center gap-16">
        <div className="flex min-w-0 flex-[1_1_520px] justify-center">
          <div aria-hidden className="relative aspect-square w-[520px] max-w-[calc(100%-96px)]">
            <span className="absolute inset-0 rounded-full border border-line" />
            <span className="absolute inset-[18%] rounded-full border border-dashed border-line" />
            <div className={cn("absolute inset-0", spinOuter)}>
              {outer.map((o, i) => (
                <div key={i} className="absolute -mt-8 -ml-12 h-16 w-24" style={{ left: o.left, top: o.top }}>
                  <div className={cn("relative size-full overflow-hidden rounded-[10px] border-2", i % 2 ? "border-ai" : "border-line", unspinOuter)}>
                    <MediaArt asset={getMedia(o.id)} />
                  </div>
                </div>
              ))}
            </div>
            <div className={cn("absolute inset-[18%]", spinInner)}>
              {inner.map((o, i) => (
                <div key={i} className="absolute -mt-6 -ml-9 h-12 w-18" style={{ left: o.left, top: o.top }}>
                  <div className={cn("relative size-full overflow-hidden rounded-lg border-2", i === 0 ? "border-primary" : "border-line", unspinInner)}>
                    <MediaArt asset={getMedia(o.id)} />
                  </div>
                </div>
              ))}
            </div>
            <div className="absolute inset-[34%] rounded-full bg-grad-blue p-1.5">
              <div className="flex size-full flex-col items-center justify-center gap-1 rounded-full bg-bg text-center">
                <span className="font-mono text-3xl text-ai">14</span>
                <span className="text-xs font-semibold">
                  best clips
                  <br />
                  from 312
                </span>
              </div>
            </div>
          </div>
        </div>
        <div className="min-w-0 flex-[1_1_380px]">
          <SectionEyebrow>Brand intelligence</SectionEyebrow>
          <h2 id="brand-title" className={cn(displayH2, "mb-5.5")}>
            It watches every clip, <Accent>so you don’t have to.</Accent>
          </h2>
          <p className="mb-7 text-lg leading-relaxed text-ink-muted">
            Your whole library is analysed for scenes, people, light and steadiness, then matched to your brand and your goal.
          </p>
          <ul className="flex flex-wrap gap-2">
            {BRAND_CHIPS.map((c) => (
              <li key={c} className="rounded-pill border border-line px-3.5 py-2 text-sm">
                {c}
              </li>
            ))}
          </ul>
        </div>
      </Container>
    </section>
  );
}

/* ---- Media library ------------------------------------------------------ */

export function LibrarySection() {
  return (
    <section id="library" aria-labelledby="library-title" className="scroll-mt-6 py-20 text-center sm:py-30">
      <Container>
        <SectionEyebrow className="justify-center">Media library</SectionEyebrow>
        <h2 id="library-title" className="mb-10 font-display text-[clamp(48px,7vw,108px)] leading-[0.92] font-semibold tracking-[-0.05em]">
          <span className="text-ink-muted">Find</span> your shot
        </h2>
        {/* An illustration of a search, not a working input: the real one is in the app's library. */}
        <figure className="mx-auto mb-12 max-w-[720px]">
          <div className="flex items-center gap-3 rounded-pill border border-line bg-surface py-2.5 pr-2.5 pl-6 text-left shadow-prompt">
            <Search className="size-4.5 shrink-0 text-ink-muted" aria-hidden />
            <span className="min-w-0 flex-1 truncate text-base sm:text-lg">{LIBRARY_QUERY}</span>
            <span className="hidden rounded-pill bg-ink px-4.5 py-3 text-sm font-semibold text-bg sm:inline-block">Search 312 clips</span>
          </div>
          <figcaption className="sr-only">Example search across a sample library of 312 clips</figcaption>
        </figure>
        <ul className="grid gap-3.5 text-left sm:grid-cols-2 lg:grid-cols-4">
          {LIBRARY_RESULTS.map((r) => (
            <li key={r.file} className="rounded-xl border border-line bg-surface p-2.5">
              <div className="relative aspect-[4/3] overflow-hidden rounded-[14px]">
                <MediaArt asset={getMedia(r.media)} />
                <PlaceholderTag asset={getMedia(r.media)} />
                <span className="absolute top-2.5 right-2.5 rounded-pill bg-ai px-2 py-1 font-mono text-[11px] text-ai-foreground">
                  <span className="sr-only">Match score </span>
                  {r.score}
                </span>
              </div>
              <div className="flex flex-col gap-2 px-1.5 pt-3 pb-1.5">
                <div className="flex justify-between gap-2">
                  <span className="truncate text-sm font-semibold">{r.file}</span>
                  <span className="font-mono text-[11px] text-ink-muted">{r.time}</span>
                </div>
                <ul className="flex flex-wrap gap-1.5" aria-label="Detected tags">
                  {r.tags.map((t) => (
                    <li key={t} className="rounded-pill bg-surface-muted px-2.5 py-1 text-xs">
                      {t}
                    </li>
                  ))}
                </ul>
              </div>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}

/* ---- Export ------------------------------------------------------------- */

export function ExportSection() {
  return (
    <section id="export" aria-labelledby="export-title" className="scroll-mt-6 bg-primary py-20 text-primary-foreground sm:py-28">
      <Container className="flex flex-wrap items-center gap-14">
        <div className="min-w-0 flex-[1_1_380px]">
          <p className="mb-4 flex items-center gap-2.5 font-mono text-xs tracking-label uppercase">
            <span aria-hidden className="size-[7px] rounded-full bg-ai" />
            Export
          </p>
          <h2 id="export-title" className={cn(displayH2, "mb-4.5")}>
            Every size. <Accent>One click.</Accent>
          </h2>
          <p className="text-lg leading-relaxed">
            Reframed for each format so the subject stays in shot. Captions, logo and safe zones handled per channel. Each extra format uses one video credit.
          </p>
        </div>
        <ul className="flex min-w-0 flex-[1.2_1_520px] flex-wrap items-end justify-center gap-4.5">
          {EXPORT_FORMATS.map((f) => (
            <li key={f.ratio} className="flex flex-col items-center gap-3">
              <div className={cn("relative overflow-hidden rounded-[14px] border-2 border-primary-foreground", f.size)} aria-hidden>
                <MediaArt asset={getMedia("product-drone-wake-export")} />
              </div>
              <span className="font-mono text-[13px]">{f.ratio}</span>
              <span className="text-[13px]">{f.use}</span>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}
