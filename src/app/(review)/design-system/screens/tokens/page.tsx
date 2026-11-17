import type { Metadata } from "next";
import { AppShell } from "@/components/app/app-shell";
import { TokensScreen } from "@/components/app/settings/tokens-screen";
import { REVIEW_SETTINGS, SAMPLE_NEW_TOKEN, SAMPLE_ORG, SAMPLE_TOKENS, sampleSettingsNav } from "@/content/sample/settings";

export const metadata: Metadata = { title: "Screen · Access tokens" };

/* ?dialog=create|created opens that dialog. */
export default function TokensReviewPage() {
  return (
    <AppShell nav={sampleSettingsNav()}>
      <TokensScreen settingsItems={REVIEW_SETTINGS} data={{ workspace: SAMPLE_ORG.name, myRole: "owner", tokens: SAMPLE_TOKENS, newToken: SAMPLE_NEW_TOKEN }} />
    </AppShell>
  );
}
