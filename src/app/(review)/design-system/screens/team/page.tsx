import type { Metadata } from "next";
import { AppShell } from "@/components/app/app-shell";
import { TeamScreen } from "@/components/app/settings/team-screen";
import { REVIEW_SETTINGS, SAMPLE_BILLING, SAMPLE_INVITES, SAMPLE_MEMBERS, SAMPLE_ORG, sampleSettingsNav } from "@/content/sample/settings";

export const metadata: Metadata = { title: "Screen · Team" };

/* ?dialog=invite|transfer opens that dialog. */
export default function TeamReviewPage() {
  return (
    <AppShell nav={sampleSettingsNav()}>
      <TeamScreen settingsItems={REVIEW_SETTINGS} data={{ workspace: SAMPLE_ORG.name, myRole: "owner", seats: SAMPLE_BILLING.plan.users, members: SAMPLE_MEMBERS, invites: SAMPLE_INVITES }} />
    </AppShell>
  );
}
