import type { Metadata } from "next";
import { OnboardingFlow } from "@/components/app/onboarding/onboarding-flow";

export const metadata: Metadata = { title: "Screen · Onboarding (invited)" };

/* The workspace step for someone who has an invitation waiting (sample data). */
export default function OnboardingInvitedReviewPage() {
  return <OnboardingFlow initialStep="workspace" invite={{ workspace: "Harbour Café", role: "an Editor", from: "Dev Patel" }} />;
}
