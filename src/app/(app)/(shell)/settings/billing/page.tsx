import type { Metadata } from "next";
import { Suspense } from "react";
import { PageLoading } from "@/components/app/page-loading";
import { BillingScreen } from "@/components/app/settings/billing-screen";
import { requireAppContext } from "@/server/app/session";
import { toBillingScreenData } from "@/server/app/settings-view";
import { getBillingOverview, getUsageHistory } from "@/server/services/billing";

export const metadata: Metadata = { title: "Usage and billing" };

/* Real figures only: plan from config/pricing.json, balances and history from the credit ledger. Stripe isn't connected. */
async function Billing() {
  const c = await requireAppContext("/settings/billing");
  const [overview, history] = await Promise.all([getBillingOverview(c.ctx), getUsageHistory(c.ctx, { limit: 50 })]);
  return <BillingScreen data={toBillingScreenData(overview, history.entries)} />;
}

export default function BillingPage() {
  return (
    <Suspense fallback={<PageLoading label="Loading usage and billing" />}>
      <Billing />
    </Suspense>
  );
}
