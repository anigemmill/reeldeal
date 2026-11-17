import type { Metadata } from "next";
import { OnboardingFlow } from "@/components/app/onboarding/onboarding-flow";

export const metadata: Metadata = { title: "Screen · Onboarding" };

/* Onboarding design (sample data). ?step=account|verify|workspace|business|brand|assets|preferences|done; ?invite=1 shows the invitation variant. */
export default function OnboardingReviewPage() {
  return <OnboardingFlow />;
}
