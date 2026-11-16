"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { PlanCard } from "@/content/pricing-page";
import { signupHref } from "@/lib/pricing/links";
import { cn } from "@/lib/utils";

/* Billing toggle and plan cards (W-Pricing "PLANS"). Prices are pre-formatted from config/pricing.json. */
export function PlanCards({ plans, monthsFree }: { plans: PlanCard[]; monthsFree: number }) {
  const [annual, setAnnual] = useState(false);
  const period = annual ? "annual" : "monthly";

  return (
    <>
      <div className="flex justify-center">
        <div role="group" aria-label="Billing period" className="inline-flex gap-0.5 rounded-pill border border-line bg-surface p-1 text-[15px] font-medium">
          {(
            [
              [false, "Monthly"],
              [true, "Annual"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={label}
              type="button"
              aria-pressed={annual === value}
              onClick={() => setAnnual(value)}
              className={cn("rounded-pill px-4.5 py-2.5 transition-colors", annual === value ? "bg-ink text-bg" : "text-ink hover:bg-surface-muted")}
            >
              {label}
              {value && monthsFree > 0 && (
                <span className="ml-1.5 rounded-pill bg-ai px-2 py-0.5 font-mono text-[11px] text-ai-foreground">
                  {monthsFree} MONTHS FREE
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <ul className="mt-14 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {plans.map((p) => {
          const price = p[period];
          return (
            <li key={p.id} className={cn("rounded-[26px] p-0.5", p.recommended ? "bg-ai" : "bg-line")}>
              <div className={cn("flex h-full flex-col gap-4 rounded-[24px] bg-surface p-6 text-ink", p.recommended && "mode-studio bg-bg")}>
                <div className="flex min-h-[26px] items-center justify-between gap-2">
                  <h3 className="font-display text-[22px] font-semibold">{p.name}</h3>
                  {p.recommended && (
                    // "Recommended", not "Most popular", until there is data (docs/decisions.md).
                    <span className="rounded-pill bg-ai px-2.5 py-1 font-mono text-[10px] text-ai-foreground">RECOMMENDED</span>
                  )}
                </div>
                <p className="min-h-10 text-sm leading-snug text-ink-muted">{p.tagline}</p>
                <div>
                  <span className="font-display text-[44px] font-semibold tracking-[-0.04em]">{price.price}</span>
                  <span className="text-sm text-ink-muted"> / month</span>
                  <p className="mt-1 min-h-[18px] text-[13px] text-ink-muted">{price.billed}</p>
                </div>
                <div className="flex items-baseline gap-2 rounded-[14px] bg-surface-muted px-3.5 py-3">
                  <span className="font-mono text-[26px] font-medium">{p.videos}</span>
                  <span className="text-[13px]">{p.videoLabel}</span>
                </div>
                <Button
                  asChild
                  variant={p.recommended ? "action" : p.free ? "secondary" : "primary"}
                  shape="pill"
                  size="lg"
                  className="font-semibold"
                >
                  <Link href={signupHref(p.id, period)}>{p.free ? "Start free" : `Choose ${p.name}`}</Link>
                </Button>
                <ul className="flex flex-col gap-2.5 border-t border-line pt-4 text-sm leading-snug">
                  {p.features.map((f) => (
                    <li key={f} className="flex gap-2.5">
                      <span aria-hidden className={cn("flex-none", p.recommended ? "text-ai" : "text-primary")}>
                        ✓
                      </span>
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
            </li>
          );
        })}
      </ul>
    </>
  );
}
