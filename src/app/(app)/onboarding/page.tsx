import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { AuthCard, FormMessage, PlanChoiceNote } from "@/components/app/auth/auth-card";
import { OnboardingForm } from "@/components/app/auth/auth-forms";
import { getPlan, parsePlanChoice } from "@/lib/pricing";
import { loadAppContext } from "@/server/app/session";
import { INDUSTRIES } from "@/server/services/account";

export const metadata: Metadata = { title: "Set up your workspace" };

async function Content({ searchParams }: PageProps<"/onboarding">) {
  const q = await searchParams;
  const c = await loadAppContext();
  if (!c) redirect("/sign-in?next=/onboarding");
  if ("unverified" in c) redirect("/verify-email");
  if ("ctx" in c) redirect("/dashboard");
  const choice = parsePlanChoice(c.user.selectedPlan, c.user.selectedBilling);
  return (
    <AuthCard title="Set up your" accent="workspace." intro="Your workspace holds your footage, brand and videos. Only people you invite can see it.">
      {q.verified === "1" ? <FormMessage tone="notice">Email confirmed. Welcome to Reeldeal.</FormMessage> : q.verified === "already" ? <FormMessage tone="notice">Your email is already confirmed.</FormMessage> : null}
      {choice ? <PlanChoiceNote planName={choice.plan.name} billing={choice.billing} freeVideos={getPlan("free")?.videoCredits.amount ?? 0} /> : null}
      <OnboardingForm industries={INDUSTRIES} defaultName={c.user.name ?? ""} />
    </AuthCard>
  );
}

export default function Page(props: PageProps<"/onboarding">) {
  return (
    <Suspense fallback={null}>
      <Content {...props} />
    </Suspense>
  );
}
