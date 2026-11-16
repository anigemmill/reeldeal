import { getPlans, pricing, type Plan } from "@/lib/pricing";

/*
  Pricing page view model (design/website/W-Pricing.dc.html). Every number comes
  from config/pricing.json through src/lib/pricing; this file only formats it.
  Copy that is not in the config (FAQ wording, headings) lives here.
*/

const money = (n: number) => (Number.isInteger(n) ? `$${n.toLocaleString("en-NZ")}` : `$${n.toFixed(2)}`);

export function formatStorage(gb: number): string {
  return gb >= 1000 && gb % 1000 === 0 ? `${gb / 1000}TB` : `${gb}GB`;
}

export function formatAnalysis(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = minutes / 60;
  return `${Number.isInteger(h) ? h : h.toFixed(1)} hr${h === 1 ? "" : "s"}`;
}

/** Self-serve plans (with a listed price), in config order. */
export function selfServePlans(): Plan[] {
  return getPlans().filter((p) => p.priceMonthly !== null);
}

export function enterprisePlan(): Plan | undefined {
  return getPlans().find((p) => p.priceMonthly === null);
}

export type PlanCard = {
  id: string;
  name: string;
  tagline: string;
  recommended: boolean;
  free: boolean;
  monthly: { price: string; billed: string };
  annual: { price: string; billed: string };
  videos: string;
  videoLabel: string;
  features: string[];
};

export function planCards(): PlanCard[] {
  return selfServePlans().map((p) => {
    const free = p.priceMonthly === 0;
    const plural = (n: number | undefined, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
    return {
      id: p.id,
      name: p.name,
      tagline: p.tagline,
      recommended: p.id === pricing.recommendedPlan,
      free,
      monthly: free ? { price: "$0", billed: "Free forever" } : { price: money(p.priceMonthly!), billed: "Billed monthly" },
      annual: free
        ? { price: "$0", billed: "Free forever" }
        : { price: money(Math.round((p.priceAnnual! / 12) * 100) / 100), billed: `Billed ${money(p.priceAnnual!)} a year` },
      videos: String(p.videoCredits.amount),
      videoLabel: p.videoCredits.period === "once" ? "one-time video credits" : "videos a month",
      features: [
        plural(p.brandProfiles, "brand profile", "brand profiles"),
        `${formatStorage(p.storageGB!)} storage`,
        `${formatAnalysis(p.analysisMinutes!)} media analysis`,
        ...p.features,
        plural(p.users, "user", "users"),
      ],
    };
  });
}

/** Rows that come from each plan's limits, shown above config.comparison.rows. */
export function comparisonTable() {
  const columns = pricing.comparison.columns.map((id) => getPlans().find((p) => p.id === id)!);
  const limitRows: [string, (p: Plan) => string][] = [
    ["Monthly price", (p) => money(p.priceMonthly ?? 0)],
    ["Video credits", (p) => (p.videoCredits.period === "once" ? `${p.videoCredits.amount} trial` : String(p.videoCredits.amount))],
    ["Storage", (p) => formatStorage(p.storageGB ?? 0)],
    ["Media analysis", (p) => formatAnalysis(p.analysisMinutes ?? 0) + (p.priceMonthly === 0 ? " trial" : "")],
    ["Brand profiles", (p) => String(p.brandProfiles)],
    ["Users", (p) => String(p.users)],
  ];
  const rows = [
    ...limitRows.map(([label, fn]) => [label, ...columns.map(fn)]),
    ...pricing.comparison.rows,
  ];
  return { columns, rows, highlight: pricing.comparison.columns.indexOf(pricing.recommendedPlan) };
}

export function addOnGroups() {
  const a = pricing.addOns;
  return [
    {
      title: "Extra video credits",
      tag: `LAST ${a.creditsExpiryDays} DAYS`,
      text: "Busy month? Add credits on top of your plan.",
      items: a.credits.map((c) => ({ qty: `${c.amount} credits`, price: money(c.price) })),
    },
    {
      title: "Extra storage",
      tag: "MONTHLY",
      text: "Keep more footage without moving up a plan.",
      items: a.storage.map((s) => ({ qty: formatStorage(s.gb), price: s.priceMonthly === null ? "Custom" : money(s.priceMonthly) })),
    },
  ];
}

export function pricingFaqs(): { q: string; a: string }[] {
  const video = pricing.wallets.find((w) => w.id === "video");
  const analysis = pricing.wallets.find((w) => w.id === "analysis");
  const months = 12 - pricing.annualDiscount.monthsFree;
  return [
    {
      q: "Do unused video credits roll over?",
      a: video && video.rolloverCycles > 0
        ? `Yes, for ${video.rolloverCycles === 1 ? "one billing cycle" : `${video.rolloverCycles} billing cycles`}. Unused credits carry into the next month, up to ${pricing.rollover.maxRollover}${pricing.rollover.consumeOldestFirst ? ", and the oldest credits are used first" : ""}. After that they expire.`
        : "No. Video credits reset each billing cycle.",
    },
    {
      q: "Do media analysis hours roll over?",
      a: analysis && analysis.rolloverCycles === 0
        ? "No. Analysis hours reset each month. They cover analysing and indexing new footage, so your existing library stays searchable either way."
        : "Yes, for one billing cycle.",
    },
    {
      q: "What counts towards my storage?",
      a: `Your original footage and finished videos. ${pricing.storageExclusions.join(" and ")} never count. You can add more storage without changing plans.`,
    },
    {
      q: "How do annual plans work?",
      a: `You pay for ${months} months and get twelve.${pricing.rollover.annualAllowancesMonthly ? " Your video credits still arrive monthly rather than all at once." : ""}`,
    },
    { q: "Do top-up credits expire?", a: `Purchased top-ups last ${pricing.addOns.creditsExpiryDays} days. [Confirm before launch.]` },
    {
      q: "What about premium AI features?",
      a: "Things like synthetic footage and premium AI generation use separate AI generation credits. You always see the cost before anything runs.",
    },
    {
      q: "Who owns the footage and the videos?",
      a: "You do. Your clips and exports stay yours, and we never share them without your permission. [Confirm wording with legal.]",
    },
  ];
}

export function gstNote(): string {
  if (pricing.gstIncluded === null) return "[Confirm: excluding or including GST.]";
  return pricing.gstIncluded ? "Including GST." : "Excluding GST.";
}
