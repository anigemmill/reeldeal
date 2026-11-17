import type { Metadata } from "next";
import { AppShell } from "@/components/app/app-shell";
import { BillingScreen } from "@/components/app/settings/billing-screen";
import { REVIEW_SETTINGS, sampleSettingsNav } from "@/content/sample/settings";
import { toBillingScreenData } from "@/server/app/settings-view";
import { pricing, getPlan } from "@/lib/pricing";

export const metadata: Metadata = { title: "Screen · Usage and billing (Free, billing not set up)" };

/*
  What a REAL Free workspace sees before billing exists: the live mapping (toBillingScreenData)
  fed with example usage figures. Review page only; the numbers below are examples.
*/
export default function BillingFreeReviewPage() {
  const free = getPlan("free")!;
  const data = toBillingScreenData(
    {
      currency: pricing.currency,
      plan: { id: free.id, name: free.name, price_monthly: free.priceMonthly, price_annual: free.priceAnnual, video_credits: free.videoCredits.amount, video_credits_period: free.videoCredits.period, analysis_minutes: free.analysisMinutes ?? null, storage_gb: free.storageGB ?? null, brand_profiles: free.brandProfiles ?? null, seats: free.users ?? null },
      usage: {
        period: "2026-11",
        video_credits: { allowance: 2, allowance_period: "once", granted: 2, used: 1, held_for_renders_in_progress: 0, available: 1 },
        analysis_minutes: { allowance: free.analysisMinutes ?? null, used: 6.5 },
        storage_gb: { allowance: free.storageGB ?? null, used: 0.38 },
        brand_profiles: 1,
        seats: 1,
        renders_this_month: 1,
        media_analysed_this_month: 4,
      },
      billing: { available: false, reason: "Every workspace is on the Free plan until paid plans can be bought online." },
      notes: [],
    },
    [
      { at: "2026-11-16T22:41:00Z", wallet: "video", kind: "charge", amount: -1, note: "Render of Summer mornings · 9:16" },
      { at: "2026-11-16T22:38:00Z", wallet: "video", kind: "release", amount: 1, note: "Render succeeded: hold released" },
      { at: "2026-11-16T22:35:00Z", wallet: "video", kind: "hold", amount: -1, note: "Hold for render of Summer mornings" },
      { at: "2026-11-14T03:12:00Z", wallet: "analysis", kind: "charge", amount: -7, note: "Analysis of lake_morning.mp4 (7 min)" },
      { at: "2026-11-02T00:00:00Z", wallet: "video", kind: "grant", amount: 2, note: "Free plan allowance" },
    ],
  );
  return (
    <AppShell nav={sampleSettingsNav()}>
      <BillingScreen settingsItems={REVIEW_SETTINGS} data={data} />
    </AppShell>
  );
}
