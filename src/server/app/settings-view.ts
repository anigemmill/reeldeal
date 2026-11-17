import type { BillingData } from "@/components/app/settings/billing-screen";
import type { BillingOverview } from "../services/billing";

/*
  Shapes service results into the Stage 3 screens' props for the REAL pages (no sample data).
  Kept apart from the services so the rule is easy to check: nothing here invents a value.
  Missing billing details become empty values, and the screen shows "not set up yet".
*/
export function toBillingScreenData(o: BillingOverview, history: { at: string | null; wallet: string; kind: string; amount: number; note: string | null }[]): BillingData {
  const v = o.usage.video_credits;
  return {
    mode: "live",
    currency: o.currency,
    plan: {
      id: o.plan.id,
      name: o.plan.name,
      priceMonthly: o.plan.price_monthly,
      priceAnnual: o.plan.price_annual,
      users: o.plan.seats,
      brands: o.plan.brand_profiles,
      storageGB: o.plan.storage_gb,
      analysisMinutes: o.plan.analysis_minutes,
      videoCredits: o.plan.video_credits ?? 0,
    },
    videoCreditsOnce: o.plan.video_credits_period === "once",
    billing: o.billing.available ? { available: true } : { available: false, reason: o.billing.reason },
    interval: o.billing.available && o.billing.interval === "annual" ? "annual" : "monthly",
    status: o.billing.available ? (o.billing.status as BillingData["status"]) : "none",
    currentPeriodStart: (o.billing.available ? o.billing.current_period_start : null) ?? `${o.usage.period}-01T00:00:00Z`,
    renewsAt: o.billing.available ? o.billing.current_period_end : null,
    usage: {
      videoCreditsAvailable: v.available,
      videoCreditsHeld: v.held_for_renders_in_progress,
      videoCreditsUsed: v.used,
      analysisMinutesUsed: o.usage.analysis_minutes.used,
      storageGBUsed: o.usage.storage_gb.used,
      brandsUsed: o.usage.brand_profiles,
      seatsUsed: o.usage.seats,
    },
    // Billing details come from Stripe in the billing stage; until then they are empty, never sample values.
    billingEmail: o.billing.available ? (o.billing.billing_email ?? "") : "",
    billingName: "",
    taxNumber: "",
    address: "",
    paymentMethod: null,
    invoices: [],
    history: history.map((h) => ({ at: h.at ?? "", wallet: h.wallet, kind: h.kind, amount: h.amount, note: h.note ?? "" })),
  };
}
