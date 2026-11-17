import type { Metadata } from "next";
import { AppShell } from "@/components/app/app-shell";
import { AccountScreen } from "@/components/app/settings/account-screen";
import { REVIEW_SETTINGS, SAMPLE_ACCOUNT, sampleSettingsNav } from "@/content/sample/settings";

export const metadata: Metadata = { title: "Screen · Account settings" };

/* The real Account screen (src/app/(app)/(shell)/settings/account) on sample data; nothing is submitted. */
export default function AccountReviewPage() {
  return (
    <AppShell nav={sampleSettingsNav()}>
      <AccountScreen preview data={SAMPLE_ACCOUNT} settingsItems={REVIEW_SETTINGS} />
    </AppShell>
  );
}
