import type { Metadata } from "next";
import { AppShell } from "@/components/app/app-shell";
import { BillingScreen } from "@/components/app/settings/billing-screen";
import { REVIEW_SETTINGS, SAMPLE_BILLING, SAMPLE_INVITES, SAMPLE_MEMBERS, sampleSettingsNav } from "@/content/sample/settings";
import { pricing } from "@/lib/pricing";

export const metadata: Metadata = { title: "Screen · Usage and billing" };

export default function BillingReviewPage() {
  return (
    <AppShell nav={sampleSettingsNav()}>
      <BillingScreen settingsItems={REVIEW_SETTINGS} data={{ ...SAMPLE_BILLING, currency: pricing.currency, usage: { ...SAMPLE_BILLING.usage, seatsUsed: SAMPLE_MEMBERS.length + SAMPLE_INVITES.length } }} />
    </AppShell>
  );
}
