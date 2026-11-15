import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { AuthCard } from "@/components/app/auth/auth-card";
import { OnboardingForm } from "@/components/app/auth/auth-forms";
import { loadAppContext } from "@/server/app/session";
import { INDUSTRIES } from "@/server/services/account";

export const metadata: Metadata = { title: "Set up your workspace" };

async function Content() {
  const c = await loadAppContext();
  if (!c) redirect("/sign-in?next=/onboarding");
  if ("ctx" in c) redirect("/dashboard");
  return (
    <AuthCard title="Set up your" accent="workspace." intro="Your workspace holds your footage, brand and videos. Only people you invite can see it.">
      <OnboardingForm industries={INDUSTRIES} defaultName={c.user.name ?? ""} />
    </AuthCard>
  );
}

export default function Page() {
  return (
    <Suspense fallback={null}>
      <Content />
    </Suspense>
  );
}
