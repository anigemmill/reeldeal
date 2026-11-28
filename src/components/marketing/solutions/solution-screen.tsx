import { Check } from "lucide-react";
import Link from "next/link";
import { Accent, MarketingPage } from "@/components/marketing/shared";
import { MediaArt, PlaceholderTag } from "@/components/media/media-art";
import { Button } from "@/components/ui/button";
import { Container, Eyebrow } from "@/components/ui/misc";
import { getMedia } from "@/content/media";
import type { IndustrySolution, SolutionSeason } from "@/content/solutions";
import { cn } from "@/lib/utils";
import { FitSwitcher } from "./fit-switcher";
import { PRIMARY_CTA, SIGN_UP_OPEN } from "@/content/site";

/*
  An industry solution page (design/website/W-Solutions.dc.html). Tourism is the
  first; every section reads from an `IndustrySolution` in src/content/solutions.ts.
*/
export function SolutionScreen({ solution }: { solution: IndustrySolution }) {
  return (
    <MarketingPage>
      <Hero solution={solution} />
      <section aria-labelledby="fit-title" className="pt-20 pb-20 sm:pt-28 sm:pb-24">
        <Container>
          <h2
            id="fit-title"
            className="mb-7 text-center font-display text-[clamp(48px,7vw,108px)] leading-[0.92] font-semibold tracking-[-0.05em] text-ink-muted"
          >
            Find <span className="text-ink">your fit</span>
          </h2>
          <FitSwitcher segments={solution.segments} />
        </Container>
      </section>
      <Seasons solution={solution} />
      <Reasons solution={solution} />
    </MarketingPage>
  );
}

function Hero({ solution }: { solution: IndustrySolution }) {
  const { hero } = solution;
  return (
    <section aria-labelledby="page-title" className="pt-4 sm:pt-8">
      <Container className="flex flex-wrap gap-4">
        <div className="flex min-h-[560px] min-w-0 flex-[1_1_460px] flex-col justify-between gap-10 rounded-2xl bg-surface-muted p-7 sm:p-10 lg:min-h-[620px] lg:p-14">
          <Eyebrow className="text-xs text-ink-soft">{solution.eyebrow}</Eyebrow>
          <div>
            <h1 id="page-title" className="mb-5.5 font-display text-[clamp(44px,5.4vw,80px)] leading-[0.95] font-semibold tracking-[-0.045em]">
              {solution.title.lead} <Accent>{solution.title.accent}</Accent>
            </h1>
            <p className="mb-7.5 max-w-[460px] text-lg leading-relaxed text-ink-soft">{solution.lead}</p>
            <div className="flex flex-wrap gap-2.5">
              <Button asChild variant="primary" shape="pill" size="lg" className="font-semibold">
                <Link href={PRIMARY_CTA.href}>{PRIMARY_CTA.label}</Link>
              </Button>
              {SIGN_UP_OPEN && (
                <Button asChild shape="pill" size="lg" className="border-0 bg-ink text-bg hover:bg-ink/90">
                  <Link href="/demo">Book a demo</Link>
                </Button>
              )}
            </div>
          </div>
          <ul className="flex flex-wrap gap-x-4.5 gap-y-2 text-sm text-ink-soft">
            {solution.assurances.map((a) => (
              <li key={a} className="flex items-center gap-1.5">
                <Check className="size-4" aria-hidden />
                {a}
              </li>
            ))}
          </ul>
        </div>

        <div className="relative min-h-[460px] min-w-0 flex-[1.2_1_520px] overflow-hidden rounded-2xl lg:min-h-[620px]">
          <MediaArt asset={getMedia(hero.media)} />
          <PlaceholderTag className="top-4 left-4" asset={getMedia(hero.media)} />
          <div className="absolute bottom-6 left-6 flex gap-2" aria-hidden>
            {hero.thumbs.map((id) => (
              <div key={id} className="relative h-28 w-21 overflow-hidden rounded-xl border-2 border-on-media">
                <MediaArt asset={getMedia(id)} />
              </div>
            ))}
          </div>
          {/* Sample of what Autopilot returns. The business is invented sample data. */}
          <div className="absolute top-6 right-6 left-6 rounded-[20px] bg-surface p-4.5 text-ink shadow-float sm:left-auto sm:w-[270px]">
            <div className="mb-2.5 flex items-center justify-between">
              <span className="font-display text-lg font-semibold">{hero.sample.business}</span>
              <span className="rounded-pill bg-ai px-2 py-1 font-mono text-[10px] text-ai-foreground">READY</span>
            </div>
            <p className="mb-3 text-[13px] leading-normal text-ink-muted">{hero.sample.summary}</p>
            <div aria-hidden className="h-1.5 rounded-pill bg-grad-panel" />
          </div>
        </div>
      </Container>
    </section>
  );
}

const SEASON_TONE: Record<SolutionSeason["tone"], string> = {
  // Each card sets its own mode so text and pill colours come from tested token pairs.
  tint: "bg-tint text-on-tint",
  muted: "mode-workspace bg-surface-muted text-ink",
  primary: "bg-primary text-primary-foreground",
  dark: "bg-surface text-ink",
};

function Seasons({ solution }: { solution: IndustrySolution }) {
  const { seasons } = solution;
  return (
    <section aria-labelledby="seasons-title" className="mode-studio bg-bg py-20 text-ink sm:py-28">
      <Container>
        <div className="mb-12 flex flex-wrap items-end justify-between gap-6">
          <h2 id="seasons-title" className="max-w-[760px] font-display text-[clamp(40px,4.8vw,68px)] leading-[0.98] font-semibold tracking-[-0.04em]">
            {seasons.title.lead} <Accent>{seasons.title.accent}</Accent>
          </h2>
          <p className="max-w-[360px] text-[17px] leading-relaxed text-ink-muted">{seasons.lead}</p>
        </div>
        <ul className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
          {seasons.items.map((s) => (
            <li key={s.title} className={cn("flex flex-col gap-3.5 rounded-xl p-3", SEASON_TONE[s.tone])}>
              <div className="relative h-[220px] overflow-hidden rounded-lg">
                <MediaArt asset={getMedia(s.media)} />
              </div>
              <div className="px-2.5 pt-1 pb-3">
                <p className="mb-1.5 font-mono text-[11px] tracking-[0.08em] uppercase">{s.when}</p>
                <h3 className="mb-3 font-display text-[22px] font-semibold">{s.title}</h3>
                <p className="mode-workspace rounded-pill bg-surface px-3 py-2.25 text-[13px] text-ink">
                  <span className="sr-only">Example prompt: </span>“{s.prompt}”
                </p>
              </div>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}

function Reasons({ solution }: { solution: IndustrySolution }) {
  const { reasons, agency } = solution;
  return (
    <section aria-labelledby="reasons-title" className="py-20 sm:py-28">
      <Container>
        <h2 id="reasons-title" className="mb-12 font-display text-[clamp(40px,4.8vw,68px)] leading-[0.98] font-semibold tracking-[-0.04em]">
          {reasons.title.lead} <Accent>{reasons.title.accent}</Accent>
        </h2>
        <ol className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          {reasons.items.map((r, i) => (
            <li key={r.title} className="border-t-2 border-ink pt-5">
              <span aria-hidden className="mb-3.5 block font-mono text-xs text-primary">
                {String(i + 1).padStart(2, "0")}
              </span>
              <h3 className="mb-2 font-display text-[22px] font-semibold">{r.title}</h3>
              <p className="text-[15px] leading-normal text-ink-muted">{r.text}</p>
            </li>
          ))}
        </ol>

        <div className="mt-18 flex flex-wrap items-center justify-between gap-6 rounded-2xl bg-primary p-7 text-primary-foreground sm:p-12">
          <div className="max-w-[640px]">
            <h3 className="mb-2 font-display text-[32px] leading-tight font-semibold tracking-[-0.02em]">{agency.title}</h3>
            <p className="text-base leading-normal">{agency.text}</p>
          </div>
          <Button asChild shape="pill" size="lg" className="border-0 bg-surface font-semibold text-ink hover:bg-surface/90">
            <Link href="/demo">{agency.cta}</Link>
          </Button>
        </div>
      </Container>
    </section>
  );
}
