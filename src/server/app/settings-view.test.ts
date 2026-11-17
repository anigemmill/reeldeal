import { describe, expect, it } from "vitest";
import { SAMPLE_BILLING } from "@/content/sample/settings";
import type { BillingOverview } from "../services/billing";
import { toBillingScreenData } from "./settings-view";

/* The real billing page must never show sample values, and must say plainly when billing isn't set up. */
const overview = (billing: BillingOverview["billing"]): BillingOverview => ({
  currency: "NZD",
  plan: { id: "free", name: "Free", price_monthly: 0, price_annual: 0, video_credits: 2, video_credits_period: "once", analysis_minutes: 30, storage_gb: 5, brand_profiles: 1, seats: 1 },
  usage: {
    period: "2026-11",
    video_credits: { allowance: 2, allowance_period: "once", granted: 2, used: 1, held_for_renders_in_progress: 0, available: 1 },
    analysis_minutes: { allowance: 30, used: 4.5 },
    storage_gb: { allowance: 5, used: 0.42 },
    brand_profiles: 1,
    seats: 1,
    renders_this_month: 1,
    media_analysed_this_month: 3,
  },
  billing,
  notes: [],
});

describe("billing screen data (live)", () => {
  it("without billing: real usage, 'not set up', and no invented subscription, card, invoice or renewal", () => {
    const data = toBillingScreenData(overview({ available: false, reason: "Every workspace is on the Free plan until paid plans can be bought online." }), [
      { at: "2026-11-02T00:00:00Z", wallet: "video", kind: "grant", amount: 2, note: "Free plan allowance" },
    ]);
    expect(data).toMatchObject({ mode: "live", billing: { available: false }, status: "none", renewsAt: null, paymentMethod: null, invoices: [], billingEmail: "", videoCreditsOnce: true });
    expect(data.usage).toMatchObject({ videoCreditsAvailable: 1, videoCreditsUsed: 1, analysisMinutesUsed: 4.5, storageGBUsed: 0.42 });
    // Not one sample value anywhere.
    const json = JSON.stringify(data);
    for (const v of [SAMPLE_BILLING.billingEmail, SAMPLE_BILLING.billingName, SAMPLE_BILLING.paymentMethod.last4, SAMPLE_BILLING.invoices[0]!.id, SAMPLE_BILLING.history[0]!.note]) expect(json).not.toContain(v);
  });

  it("with billing: status, interval and period come from the billing record", () => {
    const data = toBillingScreenData(
      overview({ available: true, status: "active", interval: "annual", current_period_start: "2026-11-01T00:00:00.000Z", current_period_end: "2027-11-01T00:00:00.000Z", cancel_at_period_end: false, billing_email: "a@b.example" }),
      [],
    );
    expect(data).toMatchObject({ billing: { available: true }, status: "active", interval: "annual", renewsAt: "2027-11-01T00:00:00.000Z", billingEmail: "a@b.example", paymentMethod: null, invoices: [] });
  });
});
