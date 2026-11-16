import { Plus } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { Accent, MarketingPage, SectionEyebrow } from "@/components/marketing/shared";
import { Button } from "@/components/ui/button";
import { Container, Eyebrow } from "@/components/ui/misc";
import { addOnGroups, comparisonTable, enterprisePlan, gstNote, planCards, pricingFaqs } from "@/content/pricing-page";
import { pricing } from "@/lib/pricing";
import { cn } from "@/lib/utils";
import { PlanCards } from "./plans";

/* Pricing page (design/website/W-Pricing.dc.html). All figures come from config/pricing.json. */
export function PricingScreen() {
  return (
    <MarketingPage>
      <Hero />
      <Plans />
      <Credits />
      <AddOns />
      <Compare />
      <Faq />
    </MarketingPage>
  );
}

function Hero() {
  return (
    <section aria-labelledby="pricing-title" className="relative isolate overflow-hidden pt-10 text-center sm:pt-18">
      <div aria-hidden className="absolute inset-x-[15%] -top-45 -z-10 h-[300px] bg-grad-clear-sky opacity-40 blur-[90px]" />
      <Container>
        <SectionEyebrow className="justify-center">Pricing · {pricing.currency}</SectionEyebrow>
        <h1 id="pricing-title" className="mx-auto max-w-[900px] font-display text-[clamp(44px,6vw,88px)] leading-[0.96] font-semibold tracking-[-0.045em]">
          Simple plans. <Accent underline>Serious output.</Accent>
        </h1>
        <p className="mx-auto mt-5.5 max-w-[560px] text-lg leading-relaxed text-ink-muted">
          Every plan is built around finished videos a month. Start free, upgrade when you’re posting every week.
        </p>
      </Container>
    </section>
  );
}

function Plans() {
  const ent = enterprisePlan();
  return (
    <section aria-label="Plans" className="pt-8">
      <Container className="max-w-[1400px]">
        <PlanCards plans={planCards()} monthsFree={pricing.annualDiscount.monthsFree} />

        {ent && (
          <div className="mode-studio mt-3 flex flex-wrap items-center justify-between gap-7 rounded-[26px] bg-bg p-6 text-ink sm:p-9">
            <div className="flex-[1_1_300px]">
              <h3 className="font-display text-[26px] font-semibold">{ent.name}</h3>
              <p className="mt-2 text-[15px] text-ink-muted">{ent.tagline} Custom pricing.</p>
            </div>
            <ul className="grid flex-[2_1_520px] gap-x-5 gap-y-2 text-sm sm:grid-cols-2">
              {ent.features.map((f) => (
                <li key={f} className="flex gap-2.5">
                  <span aria-hidden className="text-link">
                    ✓
                  </span>
                  {f}
                </li>
              ))}
            </ul>
            <Button asChild shape="pill" size="lg" className="flex-none border-0 bg-ink font-semibold text-bg hover:bg-ink/90">
              <Link href="/demo">Talk to us</Link>
            </Button>
          </div>
        )}
        <p className="mt-4.5 text-center text-sm text-ink-muted">
          All prices in {pricing.currency}. {gstNote()}
          {pricing.rollover.annualAllowancesMonthly && " Annual plans get their videos monthly, not all upfront."}
        </p>
      </Container>
    </section>
  );
}

function SectionTitle({ id, children, className }: { id: string; children: ReactNode; className?: string }) {
  return (
    <h2 id={id} className={cn("font-display text-[clamp(36px,4vw,56px)] leading-none font-semibold tracking-[-0.035em]", className)}>
      {children}
    </h2>
  );
}

function Credits() {
  return (
    <section aria-labelledby="credits-title" className="pt-24 sm:pt-28">
      <Container>
        <div className="mb-9 flex flex-wrap items-end justify-between gap-6">
          <SectionTitle id="credits-title">
            How video credits <Accent>work.</Accent>
          </SectionTitle>
          <p className="max-w-[420px] text-base leading-relaxed text-ink-muted">
            One credit is one finished standard video. Previews, small fixes and our own failed renders never cost you anything.
          </p>
        </div>
        <div className="flex flex-wrap gap-3.5">
          <div className="min-w-0 flex-[1.3_1_480px] overflow-hidden rounded-[24px] border border-line">
            <table className="w-full border-collapse text-[15px]">
              <caption className="sr-only">Credits per video</caption>
              <thead>
                <tr className="bg-surface-muted text-left">
                  <th scope="col" className="px-5 py-3.5 font-semibold">
                    What you make
                  </th>
                  <th scope="col" className="px-5 py-3.5 text-right font-semibold">
                    Credits
                  </th>
                </tr>
              </thead>
              <tbody>
                {pricing.creditCosts.map((c) => (
                  <tr key={c.id} className="border-t border-line">
                    <td className="px-5 py-3.5">{c.activity}</td>
                    <td className="px-5 py-3.5 text-right">
                      <span
                        className={cn(
                          "rounded-pill px-2.5 py-1 font-mono",
                          c.credits > 0 ? "bg-surface-muted text-ink" : "bg-ai text-ai-foreground",
                        )}
                      >
                        {c.credits > 0 ? c.credits : c.label}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="min-w-0 flex-[1_1_340px] rounded-[24px] bg-primary p-7 text-primary-foreground">
            <Eyebrow className="mb-4 text-primary-foreground">Every standard video includes</Eyebrow>
            <ul className="flex flex-col gap-3 text-[15px]">
              {pricing.standardVideoIncludes.map((i) => (
                <li key={i} className="flex gap-2.5">
                  <span aria-hidden className="text-ai">
                    ●
                  </span>
                  {i}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Container>
    </section>
  );
}

function AddOns() {
  return (
    <section aria-labelledby="addons-title" className="pt-24">
      <Container>
        <SectionTitle id="addons-title" className="mb-8">
          Need more? <Accent>Top up, don’t upgrade.</Accent>
        </SectionTitle>
        <div className="grid gap-3.5 md:grid-cols-2">
          {addOnGroups().map((g) => (
            <div key={g.title} className="rounded-[24px] bg-surface-muted p-7">
              <div className="mb-1.5 flex items-baseline justify-between gap-3">
                <h3 className="font-display text-2xl font-semibold">{g.title}</h3>
                <span className="font-mono text-[11px] text-ink-muted">{g.tag}</span>
              </div>
              <p className="mb-5 text-sm leading-normal text-ink-muted">{g.text}</p>
              <ul className="grid grid-cols-[repeat(auto-fit,minmax(110px,1fr))] gap-2">
                {g.items.map((it) => (
                  <li key={it.qty} className="rounded-2xl bg-surface p-3.5">
                    <span className="block font-mono text-[13px] text-ink-muted">{it.qty}</span>
                    <span className="mt-1 block font-display text-[26px] font-semibold">{it.price}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}

function Compare() {
  const { columns, rows, highlight } = comparisonTable();
  return (
    <section aria-labelledby="compare-title" className="py-24 sm:py-28">
      <Container>
        <SectionTitle id="compare-title" className="mb-8">
          Compare plans
        </SectionTitle>
        {/* Scrolls sideways on narrow screens; the region is focusable so keyboard users can scroll it. */}
        <div role="region" aria-labelledby="compare-title" tabIndex={0} className="overflow-x-auto rounded-[22px] border border-line bg-surface">
          <table className="w-full min-w-[860px] border-collapse text-sm">
            <thead>
              <tr className="text-left">
                <th scope="col" className="px-5 py-4.5 font-medium text-ink-muted">
                  Feature
                </th>
                {columns.map((p, i) => (
                  <th key={p.id} scope="col" className={cn("px-4 py-4.5 font-display text-[17px]", i === highlight && "bg-surface-muted")}>
                    {p.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(([label, ...cells]) => (
                <tr key={label} className="border-t border-line">
                  <th scope="row" className="px-5 py-3.5 text-left font-medium">
                    {label}
                  </th>
                  {cells.map((v, i) => (
                    <td key={i} className={cn("px-4 py-3.5", i === highlight && "bg-surface-muted", v === "No" && "text-ink-muted")}>
                      {v}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Container>
    </section>
  );
}

function Faq() {
  return (
    <section aria-labelledby="faq-title" className="mode-studio bg-bg py-24 text-ink sm:py-28">
      <Container className="flex flex-wrap gap-14">
        <div className="flex-[1_1_320px]">
          <h2 id="faq-title" className="mb-4 font-display text-[clamp(56px,7vw,104px)] leading-[0.88] font-semibold tracking-[-0.05em]">
            The
            <br />
            <Accent>details.</Accent>
          </h2>
          <p className="mb-6 text-base leading-relaxed text-ink-muted">Credits, rollover and what counts as storage.</p>
          <Button asChild variant="secondary" shape="pill" size="lg" className="bg-transparent">
            <Link href="/demo">Ask us something else</Link>
          </Button>
        </div>
        <div className="min-w-0 flex-[2_1_560px]">
          {pricingFaqs().map((f, i) => (
            // Native disclosure: keyboard and screen-reader support without script.
            <details key={f.q} open={i === 0} className="group border-t border-line">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 rounded-sm py-5.5 text-[19px] font-medium [&::-webkit-details-marker]:hidden">
                {f.q}
                <span
                  aria-hidden
                  className="flex size-8 flex-none items-center justify-center rounded-full border border-line text-ink-muted transition-transform group-open:rotate-45 group-open:border-ai group-open:text-ai motion-reduce:transition-none"
                >
                  <Plus className="size-4" />
                </span>
              </summary>
              <p className="mb-5.5 max-w-[660px] text-base leading-relaxed text-ink-muted">{f.a}</p>
            </details>
          ))}
        </div>
      </Container>
    </section>
  );
}
