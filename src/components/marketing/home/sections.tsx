import { ArrowRight, Search } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { MediaArt, PlaceholderTag } from "@/components/media/media-art";
import { Button } from "@/components/ui/button";
import { Container, Eyebrow } from "@/components/ui/misc";
import { INDUSTRIES, STEPS, TEASER_PLANS } from "@/content/home";
import { getMedia } from "@/content/media";
import { getPlan, pricing } from "@/lib/pricing";
import { cn } from "@/lib/utils";

/* Static homepage sections (design/website/W-Home.dc.html). */

function Accent({ children, underline }: { children: ReactNode; underline?: boolean }) {
  return (
    <em className={cn("font-accent font-normal", underline && "underline decoration-ai decoration-[0.07em] underline-offset-[0.14em]")}>{children}</em>
  );
}

function SectionEyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <Eyebrow className={cn("mb-4 flex items-center gap-2.5 text-xs", className)}>
      <span aria-hidden className="size-[7px] rounded-full bg-ai" />
      {children}
    </Eyebrow>
  );
}

/* ---- How it works: numbered index on the primary colour ---------------- */

export function HowItWorks() {
  return (
    <section aria-labelledby="how-title" className="bg-primary py-20 text-primary-foreground sm:py-28">
      <Container>
        <div className="mb-14 flex flex-wrap items-end justify-between gap-6">
          <h2 id="how-title" className="font-display text-[clamp(44px,5.4vw,80px)] leading-[0.95] font-semibold tracking-[-0.045em]">
            From folder <Accent underline>to feed.</Accent>
          </h2>
          <p className="max-w-[360px] text-[17px] leading-relaxed text-primary-foreground">
            Six steps, and the AI does most of them. You stay in charge of the bits that matter: the brief and the final yes.
          </p>
        </div>
        <ol className="grid gap-x-16 md:grid-cols-2">
          {STEPS.map((s) => (
            <li key={s.n} className="flex items-center gap-6 border-t border-primary-foreground/30 py-6.5">
              <span aria-hidden className="w-16 shrink-0 font-display text-5xl leading-none tracking-display sm:w-24 sm:text-[64px]">
                {s.n}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2.5">
                  <span className="rounded-pill border border-primary-foreground/60 px-3.5 py-1.5 text-sm font-medium">{s.title}</span>
                  <span
                    className={cn(
                      "rounded-pill px-2 py-1 font-mono text-[11px]",
                      // Outlined on the primary colour: on-primary/primary is contrast-tested for every palette.
                      s.who.includes("AI") ? "bg-ai text-ai-foreground" : "border border-primary-foreground/70 text-primary-foreground",
                    )}
                  >
                    {s.who}
                  </span>
                </div>
                <p className="mt-2.5 text-[15px] leading-normal text-primary-foreground">{s.text}</p>
              </div>
            </li>
          ))}
        </ol>
      </Container>
    </section>
  );
}

/* ---- Bento: Autopilot vs Studio, plus four capability cards --------------- */

export function Bento() {
  return (
    <section aria-labelledby="bento-title" className="py-20 sm:py-30">
      <Container>
        <div className="mb-14 text-center">
          <SectionEyebrow className="justify-center">One platform, two ways to work</SectionEyebrow>
          <h2 id="bento-title" className="mx-auto max-w-[860px] font-display text-[clamp(40px,5vw,72px)] leading-[0.98] font-semibold tracking-display">
            Hand it over, or <Accent underline>take the wheel.</Accent>
          </h2>
        </div>

        <div className="grid gap-4 lg:grid-cols-4">
          {/* Autopilot */}
          <Link
            href="/product#autopilot"
            className="group relative flex min-h-[480px] gap-7 overflow-hidden rounded-2xl bg-surface-muted p-7 sm:p-9 lg:col-span-2"
          >
            <div className="flex min-w-0 flex-1 flex-col justify-between">
              <div>
                <span className="inline-block rounded-pill bg-ink px-3 py-1.5 font-mono text-[11px] tracking-[0.08em] text-bg">AUTOPILOT</span>
                <h3 className="mt-4.5 mb-2.5 font-display text-[40px] leading-none font-semibold tracking-[-0.03em]">Let the AI make it.</h3>
                <p className="text-base leading-relaxed text-ink-soft">On your phone. Upload, describe, approve. No editing skills needed.</p>
              </div>
              <span className="inline-flex items-center gap-1.5 font-semibold">
                Explore Autopilot <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" aria-hidden />
              </span>
            </div>
            <div className="-mb-16 hidden h-[410px] w-[210px] shrink-0 self-end rounded-[34px] bg-media-veil p-2 sm:block" aria-hidden>
              <div className="relative size-full overflow-hidden rounded-[27px]">
                <MediaArt asset={getMedia("coast-sail")} />
                <span className="absolute inset-x-3 top-[44%] rounded-pill bg-on-media px-3 py-2 text-[11px] text-media-veil">Sunset cruise, 20s</span>
                <span className="absolute inset-x-3 bottom-[70px] rounded-[14px] bg-action p-2.5 text-center text-xs font-semibold text-action-foreground">
                  Approve option 2
                </span>
              </div>
            </div>
          </Link>

          {/* Studio */}
          <Link href="/product#studio" className="group mode-studio flex min-h-[480px] flex-col gap-7 rounded-2xl bg-bg p-7 text-ink sm:p-9 lg:col-span-2">
            <div className="flex flex-wrap justify-between gap-5">
              <div>
                <span className="inline-block rounded-pill bg-primary px-3 py-1.5 font-mono text-[11px] tracking-[0.08em] text-primary-foreground">STUDIO</span>
                <h3 className="mt-4.5 mb-2.5 font-display text-[40px] leading-none font-semibold tracking-[-0.03em]">Take the controls.</h3>
                <p className="max-w-[360px] text-base leading-relaxed text-ink-muted">A focused desktop editor with an assistant that edits on request.</p>
              </div>
              <span className="inline-flex items-center gap-1.5 self-end font-semibold">
                Explore Studio <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" aria-hidden />
              </span>
            </div>
            <div className="mt-auto flex flex-col gap-2.5 rounded-[18px] border border-line bg-surface p-3" aria-hidden>
              <div className="flex gap-2.5">
                <div className="relative aspect-video flex-1 overflow-hidden rounded-[10px]">
                  <MediaArt asset={getMedia("forest-ride")} />
                </div>
                <div className="flex w-[36%] flex-col gap-1.5 rounded-[10px] bg-surface-muted p-2.5 text-[11px]">
                  <span className="font-mono text-ink-muted">ASSISTANT</span>
                  <span className="rounded-lg bg-bg p-2">Open on the trail, tighten the middle.</span>
                  <span className="rounded-lg bg-ai p-2 text-ai-foreground">Done. 3 edits applied.</span>
                </div>
              </div>
              <div className="flex h-5 gap-1">
                {[3, 2, 4, 2].map((f, i) => (
                  <span key={i} className="rounded-[5px] bg-primary" style={{ flex: f }} />
                ))}
              </div>
              <div className="flex h-3 gap-1">
                <span className="flex-1" />
                <span className="flex-[3] rounded bg-tint" />
                <span className="flex-[5]" />
                <span className="flex-[2] rounded bg-ai" />
              </div>
            </div>
          </Link>

          {/* Brand profiles */}
          <div className="flex min-h-[300px] flex-col justify-between rounded-xl border border-line bg-surface p-6.5">
            <div className="flex gap-1.5" aria-hidden>
              <span className="size-9 rounded-[10px] bg-primary" />
              <span className="size-9 rounded-[10px] bg-ai" />
              <span className="size-9 rounded-[10px] bg-surface-muted" />
              <span className="flex size-9 items-center justify-center rounded-[10px] bg-ink font-accent text-xl text-bg italic">Aa</span>
            </div>
            <div>
              <h3 className="mb-1.5 font-display text-[22px] font-semibold">Brand profiles</h3>
              <p className="text-sm leading-normal text-ink-muted">Colours, fonts, logo and tone, applied to every cut.</p>
            </div>
          </div>

          {/* Library search */}
          <div className="relative min-h-[300px] overflow-hidden rounded-xl text-on-media">
            <MediaArt asset={getMedia("lake-kayak")} />
            <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-media-veil/60 via-transparent to-transparent" />
            <span className="absolute inset-x-4 top-5 flex items-center gap-2 rounded-pill bg-on-media py-2 pr-3 pl-3.5 text-[13px] text-media-veil">
              <Search className="size-3.5" aria-hidden />
              <span className="flex-1">kayak at sunset</span>
              <span className="font-mono text-[10px]">23 clips</span>
            </span>
            <div className="absolute inset-x-5.5 bottom-5.5">
              <h3 className="mb-1.5 font-display text-[22px] font-semibold">A library that knows its shots</h3>
              <p className="text-sm">Search by what is in the frame.</p>
            </div>
          </div>

          {/* Batch versions */}
          <div className="flex min-h-[300px] flex-col justify-between rounded-xl bg-primary p-6.5 text-primary-foreground">
            <div className="relative h-[120px]" aria-hidden>
              {(
                [
                  ["alpine-sunrise", "left-0 top-[18px] -rotate-8"],
                  ["lake-kayak", "left-14 top-1.5 rotate-2"],
                  ["lodge-night", "left-28 top-3.5 rotate-10"],
                ] as const
              ).map(([id, pos]) => (
                <div key={id} className={cn("absolute h-[100px] w-[76px] overflow-hidden rounded-[10px] shadow-float", pos)}>
                  <MediaArt asset={getMedia(id)} />
                </div>
              ))}
            </div>
            <div>
              <h3 className="mb-1.5 font-display text-[22px] font-semibold">Batch versions</h3>
              <p className="text-sm leading-normal">One brief, every format and length, in one go.</p>
            </div>
          </div>

          {/* Captions */}
          <div className="flex min-h-[300px] flex-col justify-between rounded-xl bg-tint p-6.5 text-on-tint">
            <div className="flex flex-col items-start gap-2" aria-hidden>
              <span className="rounded-lg bg-ink px-2.5 py-1.5 text-[15px] font-semibold text-bg">Wake up to this.</span>
              <span className="rounded-lg bg-surface px-2.5 py-1.5 text-[15px] font-semibold text-ink">Book direct and save.</span>
              <span className="font-mono text-[11px]">AUTO-TIMED · BRAND-STYLED</span>
            </div>
            <div>
              <h3 className="mb-1.5 font-display text-[22px] font-semibold">Captions, done</h3>
              <p className="text-sm leading-normal">Styled to your brand, timed automatically.</p>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}

/* ---- Tourism ------------------------------------------------------------ */

export function Tourism() {
  return (
    <section aria-labelledby="tourism-title" className="pb-20 sm:pb-30">
      <Container className="flex flex-wrap items-center gap-12">
        <div className="relative h-[420px] min-w-0 flex-[1.2_1_520px] overflow-hidden rounded-2xl sm:h-[560px]">
          <MediaArt asset={getMedia("geo-valley")} />
          <PlaceholderTag className="top-4 left-4" />
          <div className="absolute right-5 bottom-5 left-5 rounded-[18px] bg-surface p-4 text-ink shadow-float sm:left-auto sm:w-[260px]">
            <Eyebrow className="mb-1.5 text-[10px]">This week</Eyebrow>
            <div className="mb-2.5 font-display text-lg font-semibold">Valley Geothermal</div>
            <div className="flex gap-1.5 text-xs">
              {["3 reels", "1 ad", "2 stories"].map((x) => (
                <span key={x} className="rounded-pill bg-surface-muted px-2.5 py-1">
                  {x}
                </span>
              ))}
            </div>
          </div>
        </div>
        <div className="min-w-0 flex-[1_1_400px]">
          <SectionEyebrow>Solutions</SectionEyebrow>
          <h2 id="tourism-title" className="mb-5 font-display text-[clamp(40px,4.8vw,68px)] leading-[0.98] font-semibold tracking-display">
            Built for tourism. <Accent>Ready for anyone.</Accent>
          </h2>
          <p className="mb-7 text-lg leading-relaxed text-ink-muted">
            Operators shoot great footage and never have time to edit it. We started there, and it works for any business with a
            camera roll.
          </p>
          <ul className="mb-7 flex flex-wrap gap-2">
            {INDUSTRIES.map((i) => (
              <li key={i} className="rounded-pill border border-ink px-4 py-2.5 text-sm">
                {i}
              </li>
            ))}
          </ul>
          <Button asChild shape="pill" size="lg" className="border-0 bg-ink font-semibold text-bg hover:bg-ink/90">
            <Link href="/solutions/tourism">See tourism solutions</Link>
          </Button>
        </div>
      </Container>
    </section>
  );
}

/* ---- Pricing teaser (from config/pricing.json) ---------------------------- */

export function PricingTeaser() {
  const plans = TEASER_PLANS.map((id) => getPlan(id)!);
  return (
    <section aria-labelledby="pricing-title" className="bg-surface-muted py-20 sm:py-30">
      <Container>
        <div className="mb-12 flex flex-wrap items-end justify-between gap-6">
          <h2 id="pricing-title" className="font-display text-[clamp(40px,5vw,72px)] leading-[0.98] font-semibold tracking-display">
            Pick a plan. <Accent>Start free.</Accent>
          </h2>
          <Link href="/pricing" className="border-b-[1.5px] border-ink pb-0.5 font-semibold">
            Compare all plans →
          </Link>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {plans.map((plan) => {
            const recommended = plan.id === pricing.recommendedPlan;
            return (
              <div key={plan.id} className={cn("rounded-2xl p-[3px]", recommended ? "bg-ai" : "bg-line")}>
                <div className={cn("flex h-full flex-col gap-4.5 rounded-[25px] bg-surface p-7.5 text-ink", recommended && "mode-studio bg-bg")}>
                  <div className="flex items-center justify-between">
                    <h3 className="font-display text-2xl font-semibold">{plan.name}</h3>
                    {recommended && (
                      // "Recommended", not "Most popular", until there is data (NZ Fair Trading Act, docs/decisions.md).
                      <span className="rounded-pill bg-ai px-2.5 py-1 font-mono text-[10px] text-ai-foreground">RECOMMENDED</span>
                    )}
                  </div>
                  <p className="text-[15px] text-ink-muted">{plan.tagline}</p>
                  <p className="font-display text-[44px] font-semibold tracking-[-0.03em]">
                    ${plan.priceMonthly}
                    <span className="text-[15px] font-normal tracking-normal text-ink-muted"> {pricing.currency} / month</span>
                  </p>
                  <div className="flex items-baseline gap-2 rounded-[14px] bg-surface-muted px-3.5 py-3">
                    <span className="font-mono text-[26px]">{plan.videoCredits.amount}</span>
                    <span className="text-sm">videos a month</span>
                  </div>
                  <Button asChild variant={recommended ? "action" : "primary"} shape="pill" size="lg" className="mt-auto font-semibold">
                    <Link href="/pricing">Choose {plan.name}</Link>
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
        <p className="mt-6 text-[15px] text-ink-muted">
          Just looking?{" "}
          <Link href="/signup" className="font-semibold text-ink underline decoration-ai underline-offset-[3px]">
            Start on Free
          </Link>{" "}
          with {getPlan("free")!.videoCredits.amount} videos, no card needed. Agency and Enterprise plans on the{" "}
          <Link href="/pricing" className="font-semibold text-ink underline">
            pricing page
          </Link>
          . Prices in {pricing.currency}, [GST INCLUSIVE OR EXCLUSIVE: TO CONFIRM].
        </p>
      </Container>
    </section>
  );
}
