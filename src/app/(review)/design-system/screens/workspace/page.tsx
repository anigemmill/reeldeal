import type { Metadata } from "next";
import { AppShell } from "@/components/app/app-shell";
import { WorkspaceScreen } from "@/components/app/settings/workspace-screen";
import { REVIEW_SETTINGS, SAMPLE_BILLING, SAMPLE_MEMBERS, SAMPLE_ORG, sampleSettingsNav } from "@/content/sample/settings";
import { INDUSTRIES } from "@/server/services/account";

export const metadata: Metadata = { title: "Screen · Workspace settings" };

export default function WorkspaceReviewPage() {
  const owner = SAMPLE_MEMBERS.find((m) => m.role === "owner")!;
  return (
    <AppShell nav={sampleSettingsNav()}>
      <WorkspaceScreen
        settingsItems={REVIEW_SETTINGS}
        data={{ myRole: "owner", org: SAMPLE_ORG, owner, planName: SAMPLE_BILLING.plan.name, brands: { used: SAMPLE_BILLING.usage.brandsUsed, limit: SAMPLE_BILLING.plan.brands }, brand: SAMPLE_ORG.brand, industries: INDUSTRIES }}
      />
    </AppShell>
  );
}
