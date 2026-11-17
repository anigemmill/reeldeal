"use client";

import { CreditCard, Download, ExternalLink, Info } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ProgressBar } from "@/components/ui/progress";
import { SegmentedControl } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { dateFmt, previewOnly, SampleBadge } from "./preview";
import { SettingsFrame, SettingsSection, type SettingsItem } from "./settings-shell";

/*
  Settings → Usage and billing (DESIGN). Plan and allowances come from config/pricing.json,
  balances and history from the credit ledger (credit_transactions), subscription state
  from the planned billing_accounts table, written by Stripe webhooks in the billing stage.
  Until then the real page shows Free and "Billing isn't available yet".
*/
export type BillingData = {
  currency: string;
  plan: { id: string; name: string; priceMonthly: number | null; priceAnnual: number | null; users: number | null; brands: number | null; storageGB: number | null; analysisMinutes: number | null; videoCredits: number };
  interval: "monthly" | "annual";
  status: "active" | "trialing" | "past_due" | "cancelled" | "none";
  currentPeriodStart: string;
  renewsAt: string | null;
  usage: { videoCreditsAvailable: number; videoCreditsHeld: number; videoCreditsUsed: number; analysisMinutesUsed: number; storageGBUsed: number; brandsUsed: number; seatsUsed: number };
  billingEmail: string;
  billingName: string;
  taxNumber: string;
  address: string;
  paymentMethod: { brand: string; last4: string; expires: string } | null;
  history: { at: string; wallet: string; kind: string; amount: number; note: string }[];
  invoices: { id: string; date: string; amount: number; status: string }[];
  /**
   * preview: sample data on the design review pages. live: the workspace's real figures.
   * When billing isn't available (no subscription record yet, or not the owner), the screen
   * shows that plainly and hides every subscription, payment and invoice detail.
   */
  mode?: "preview" | "live";
  billing?: { available: true } | { available: false; reason: string };
  /** One-off trial allowance (Free) rather than a monthly one. */
  videoCreditsOnce?: boolean;
};

const STATUS: Record<BillingData["status"], { label: string; tone: "success" | "warning" | "danger" | "neutral" }> = {
  active: { label: "Active", tone: "success" },
  trialing: { label: "Trial", tone: "neutral" },
  past_due: { label: "Payment overdue", tone: "warning" },
  cancelled: { label: "Cancelled", tone: "danger" },
  none: { label: "No subscription", tone: "neutral" },
};
const KIND: Record<string, string> = { grant: "Allowance", hold: "Held for render", release: "Hold released", charge: "Used", refund: "Refund", adjustment: "Adjustment" };
const WALLET: Record<string, string> = { video: "Video credits", analysis: "Analysis minutes", ai_generation: "AI generation" };

export function BillingScreen({ data, settingsItems }: { data: BillingData; settingsItems?: SettingsItem[] }) {
  const [filter, setFilter] = useState("all");
  const money = (n: number | null) => (n === null ? "Price on request" : new Intl.NumberFormat("en-NZ", { style: "currency", currency: data.currency, maximumFractionDigits: 0 }).format(n));
  const p = data.plan;
  const u = data.usage;
  const status = STATUS[data.status];
  const annualSaving = p.priceMonthly !== null && p.priceAnnual !== null ? p.priceMonthly * 12 - p.priceAnnual : 0;
  const rows = data.history.filter((h) => filter === "all" || h.wallet === filter);
  const live = data.mode === "live";
  const billing = data.billing ?? { available: true as const };
  const meters = [
    { label: "Video credits", value: `${u.videoCreditsAvailable} available`, detail: `${u.videoCreditsUsed} used · ${u.videoCreditsHeld} held for a render in progress · ${p.videoCredits} ${data.videoCreditsOnce ? "to try Reeldeal (one-off)" : "a month"}`, pct: p.videoCredits ? (u.videoCreditsAvailable / p.videoCredits) * 100 : 0 },
    { label: "Media analysis", value: `${u.analysisMinutesUsed} of ${p.analysisMinutes ?? "∞"} min`, detail: "Minutes of footage analysed this month", pct: p.analysisMinutes ? (u.analysisMinutesUsed / p.analysisMinutes) * 100 : 0 },
    { label: "Storage", value: `${u.storageGBUsed} of ${p.storageGB ?? "∞"} GB`, detail: "Originals and exports (previews don't count)", pct: p.storageGB ? (u.storageGBUsed / p.storageGB) * 100 : 0 },
    { label: "Brand profiles", value: `${u.brandsUsed} of ${p.brands ?? "∞"}`, detail: "", pct: p.brands ? (u.brandsUsed / p.brands) * 100 : 0 },
    { label: "Seats", value: `${u.seatsUsed} of ${p.users ?? "∞"}`, detail: "Members and pending invitations", pct: p.users ? (u.seatsUsed / p.users) * 100 : 0 },
  ];

  return (
    <SettingsFrame current="billing" items={settingsItems} title="Usage and billing" intro="Your plan, what you've used this month, and how you pay." actions={live ? undefined : <SampleBadge />}>
      <p role="note" className="flex gap-3 rounded-lg border border-line bg-surface-muted px-4 py-3 text-sm leading-relaxed">
        <Info className="mt-0.5 size-4 shrink-0 text-ink-muted" aria-hidden />
        <span>
          {live ? (
            billing.available ? (
              "Your plan, credits and usage are live figures for this workspace."
            ) : (
              <>
                <strong className="font-semibold">Online billing isn&apos;t set up yet.</strong> {billing.reason} The plan, credits and usage on this page are this workspace&apos;s real figures; nothing is charged here.
              </>
            )
          ) : (
            "Design preview of the billing area. Paid plans can't be bought yet: today every workspace is on Free and this page shows your real credits and usage only. Payments, invoices and plan changes arrive with Stripe."
          )}
        </span>
      </p>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <section aria-labelledby="plan-title" className="flex flex-col gap-4 rounded-xl border border-line bg-surface p-6 shadow-card">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex flex-col gap-1">
              <p className="font-mono text-[11px] tracking-label text-ink-muted uppercase">Current plan</p>
              <h2 id="plan-title" className="font-display text-3xl font-semibold tracking-display">
                {p.name}
              </h2>
            </div>
            {billing.available ? <Badge tone={status.tone}>{status.label}</Badge> : <Badge tone="outline">Billing not set up</Badge>}
          </div>
          <p className="flex items-baseline gap-1.5">
            <span className="font-display text-2xl font-semibold">{money(data.interval === "annual" ? p.priceAnnual : p.priceMonthly)}</span>
            <span className="text-sm text-ink-muted">{data.interval === "annual" ? "a year" : "a month"} · {data.currency}</span>
          </p>
          <ul className="grid gap-x-6 gap-y-1.5 text-sm text-ink-muted sm:grid-cols-2">
            <li>{p.videoCredits} videos {data.videoCreditsOnce ? "to try Reeldeal" : "a month"}</li>
            <li>{p.analysisMinutes} min of media analysis</li>
            <li>{p.storageGB?.toLocaleString("en-NZ")} GB storage</li>
            <li>
              {p.users} seats · {p.brands} brand profiles
            </li>
          </ul>
          <p className="text-sm">
            {!billing.available ? (
              "Nothing renews and nothing is charged: there's no subscription on this workspace."
            ) : data.renewsAt ? (
              <>
                Renews on <strong className="font-semibold">{dateFmt(data.renewsAt, { day: "numeric", month: "long", year: "numeric" })}</strong>. Unused video credits roll over as set out on the pricing page.
              </>
            ) : (
              "No renewal scheduled."
            )}
          </p>
          <div className="mt-auto flex flex-wrap gap-2">
            <Button asChild variant="primary">
              <Link href="/pricing">{billing.available ? "Change plan" : "See plans"}</Link>
            </Button>
            {billing.available && data.interval === "monthly" && annualSaving > 0 ? (
              <Button variant="secondary" onClick={() => previewOnly("Billing not changed")}>
                Switch to annual (save {money(annualSaving)})
              </Button>
            ) : null}
          </div>
        </section>

        <section aria-labelledby="sub-title" className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-6">
          <h2 id="sub-title" className="font-display text-lg font-semibold">
            Subscription
          </h2>
          {!billing.available ? (
            <p className="text-sm leading-relaxed text-ink-muted">{billing.reason}</p>
          ) : (
          <>
          <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-6 gap-y-2.5 text-sm">
            <dt className="text-ink-muted">Status</dt>
            <dd>{status.label}</dd>
            <dt className="text-ink-muted">Billing</dt>
            <dd>{data.interval === "annual" ? "Annually" : "Monthly"}</dd>
            <dt className="text-ink-muted">This period</dt>
            <dd>
              {dateFmt(data.currentPeriodStart)} – {dateFmt(data.renewsAt)}
            </dd>
            <dt className="text-ink-muted">Next invoice</dt>
            <dd>
              {money(p.priceMonthly)} on {dateFmt(data.renewsAt)}
            </dd>
          </dl>
          <button type="button" onClick={() => previewOnly("Subscription not cancelled")} className="mt-auto w-fit text-sm text-ink-muted underline underline-offset-4 hover:text-ink">
            Cancel subscription
          </button>
          </>
          )}
        </section>
      </div>

      <SettingsSection
        id="usage"
        title="This month's usage"
        description={`${data.videoCreditsOnce ? "Free plan videos are a one-off trial; analysis allowance resets on the 1st of each month." : data.renewsAt ? `Allowances reset on ${dateFmt(data.renewsAt, { day: "numeric", month: "long" })}.` : "Allowances reset on the 1st of each month."} Failed renders on our side are never charged.`}
      >
        <ul className="grid gap-3 sm:grid-cols-2">
          {meters.map((m) => (
            <li key={m.label} className="flex flex-col gap-2 rounded-lg border border-line bg-surface p-4">
              <p className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="font-semibold">{m.label}</span>
                <span className="font-mono text-sm">{m.value}</span>
              </p>
              <ProgressBar label={`${m.label} used`} value={m.pct} size="sm" tone={m.pct > 90 ? "ai" : "primary"} />
              {m.detail ? <p className="text-xs text-ink-muted">{m.detail}</p> : null}
            </li>
          ))}
        </ul>
      </SettingsSection>

      <SettingsSection id="history" title="Usage history" description="Every credit added, held, released or used, from the ledger. Holds are released whether a render succeeds or fails; only successful renders are charged.">
        <SegmentedControl
          label="Show"
          size="sm"
          value={filter}
          onValueChange={setFilter}
          options={[
            { value: "all", label: "All" },
            { value: "video", label: "Video credits" },
            { value: "analysis", label: "Analysis" },
          ]}
        />
        {/* Focusable so keyboard users can scroll it sideways on narrow screens. */}
        <div tabIndex={0} role="region" aria-label="Usage history table" className="overflow-x-auto rounded-lg border border-line bg-surface focus-visible:outline-2 focus-visible:outline-focus">
          <table className="w-full min-w-[560px] text-left text-sm">
            <caption className="sr-only">Usage history</caption>
            <thead className="border-b border-line font-mono text-[11px] tracking-label text-ink-muted uppercase">
              <tr>
                <th scope="col" className="px-4 py-3 font-normal">Date</th>
                <th scope="col" className="px-4 py-3 font-normal">What</th>
                <th scope="col" className="px-4 py-3 font-normal">Type</th>
                <th scope="col" className="px-4 py-3 text-right font-normal">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-ink-muted">
                    Nothing yet. Credits appear here as they&apos;re added and used.
                  </td>
                </tr>
              ) : null}
              {rows.map((h, i) => (
                <tr key={i}>
                  <td className="px-4 py-3 whitespace-nowrap text-ink-muted">{dateFmt(h.at, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}</td>
                  <td className="px-4 py-3">
                    {h.note}
                    <span className="block text-xs text-ink-muted">{WALLET[h.wallet]}</span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">{KIND[h.kind] ?? h.kind}</td>
                  <td className={cn("px-4 py-3 text-right font-mono whitespace-nowrap", h.amount > 0 ? "text-success" : "")}>
                    {h.amount > 0 ? "+" : "−"}
                    {Math.abs(h.amount)}
                    {h.wallet === "analysis" ? " min" : ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SettingsSection>

      <SettingsSection id="billing-details" title="Billing details" description="Shown on invoices. The owner manages billing; card details are held by our payment provider, never by Reeldeal.">
        {!billing.available ? (
          <p className="rounded-lg border border-dashed border-line-strong p-5 text-sm text-ink-muted">Billing contact, company details and payment method appear here once paid plans can be bought online.</p>
        ) : (
        <div className="flex flex-col divide-y divide-line rounded-lg border border-line bg-surface">
          <dl className="grid gap-x-6 gap-y-2.5 p-5 text-sm sm:grid-cols-[170px_minmax(0,1fr)]">
            <dt className="text-ink-muted">Billing contact</dt>
            <dd className="break-all">{data.billingEmail}</dd>
            <dt className="text-ink-muted">Company</dt>
            <dd>{data.billingName}</dd>
            <dt className="text-ink-muted">GST number</dt>
            <dd>{data.taxNumber}</dd>
            <dt className="text-ink-muted">Address</dt>
            <dd>{data.address}</dd>
          </dl>
          <div className="flex flex-wrap items-center gap-3.5 p-5">
            <CreditCard className="size-5 text-ink-muted" strokeWidth={1.8} aria-hidden />
            <span className="min-w-0 flex-1 text-sm">{data.paymentMethod ? `${data.paymentMethod.brand} ending ${data.paymentMethod.last4} · expires ${data.paymentMethod.expires}` : "No payment method"}</span>
            <Button variant="secondary" size="sm" onClick={() => previewOnly("Opens the secure payment portal when billing launches")}>
              Update billing details <ExternalLink aria-hidden />
            </Button>
          </div>
        </div>
        )}
      </SettingsSection>

      <SettingsSection id="invoices" title="Invoices">
        {data.invoices.length === 0 ? (
          <p className="rounded-lg border border-dashed border-line-strong p-5 text-sm text-ink-muted">Invoices appear here once you&apos;re on a paid plan.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-line rounded-lg border border-line bg-surface">
            {data.invoices.map((i) => (
              <li key={i.id} className="flex flex-wrap items-center gap-3 p-4 text-sm">
                <span className="font-mono">{i.id}</span>
                <span className="text-ink-muted">{dateFmt(i.date)}</span>
                <span className="flex-1 text-right font-mono">{money(i.amount)}</span>
                <Badge size="sm" tone="success" className="capitalize">{i.status}</Badge>
                <Button size="sm" variant="ghost" onClick={() => previewOnly("No invoice downloaded")}>
                  <Download aria-hidden /> PDF
                </Button>
              </li>
            ))}
          </ul>
        )}
      </SettingsSection>
    </SettingsFrame>
  );
}
