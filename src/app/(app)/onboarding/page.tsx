import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { AuthCard, FormMessage, PlanChoiceNote } from "@/components/app/auth/auth-card";
import { OnboardingForm } from "@/components/app/auth/auth-forms";
import { getPlan, parsePlanChoice } from "@/lib/pricing";
import { loadAppContext } from "@/server/app/session";
import { PendingInvitations, type PendingInvitation } from "@/components/app/auth/pending-invitations";
import { getPlatform } from "@/server/app/platform";
import { INDUSTRIES } from "@/server/services/account";
import { myInvitations } from "@/server/services/team";

/** Invitations for this confirmed address. Empty if the team migration (20261118000001) isn't applied yet. */
async function invitationsFor(userId: string): Promise<PendingInvitation[]> {
  try {
    return (await myInvitations(await getPlatform(), userId)).map((i) => ({ id: i.id, org_name: i.org_name, role: i.role, invited_by_name: i.invited_by_name }));
  } catch {
    return [];
  }
}

export const metadata: Metadata = { title: "Set up your workspace" };

async function Content({ searchParams }: PageProps<"/onboarding">) {
  const q = await searchParams;
  const c = await loadAppContext();
  if (!c) redirect("/sign-in?next=/onboarding");
  if ("unverified" in c) redirect("/verify-email");
  if ("ctx" in c) redirect("/dashboard");
  const choice = parsePlanChoice(c.user.selectedPlan, c.user.selectedBilling);
  const invited = await invitationsFor(c.user.id);
  return (
    <AuthCard title="Set up your" accent="workspace." intro="Your workspace holds your footage, brand and videos. Only people you invite can see it.">
      {q.verified === "1" ? <FormMessage tone="notice">Email confirmed. Welcome to Reeldeal.</FormMessage> : q.verified === "already" ? <FormMessage tone="notice">Your email is already confirmed.</FormMessage> : null}
      {invited.length ? <PendingInvitations invitations={invited} /> : null}
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
