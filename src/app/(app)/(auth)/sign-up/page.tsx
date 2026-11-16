import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { AuthCard, FormMessage, PlanChoiceNote } from "@/components/app/auth/auth-card";
import { SignUpForm } from "@/components/app/auth/auth-forms";
import { getPlan, parsePlanChoice } from "@/lib/pricing";
import { authConfigured } from "@/server/app/supabase";

export const metadata: Metadata = { title: "Create your account" };

/* ?plan=…&billing=… comes from the plan buttons on /pricing and the homepage (src/lib/pricing/links.ts). */
async function Content({ searchParams }: PageProps<"/sign-up">) {
  const q = await searchParams;
  const choice = parsePlanChoice(q.plan, q.billing);
  const freeVideos = getPlan("free")?.videoCredits.amount ?? 0;
  return (
    <AuthCard
      title="Start making"
      accent="videos."
      intro="Create your account, then set up your workspace and brand in under a minute."
      footer={<>Already have an account? <Link href="/sign-in" className="font-medium text-link underline-offset-4 hover:underline">Sign in</Link></>}
    >
      {choice ? <PlanChoiceNote planName={choice.plan.name} billing={choice.billing} freeVideos={freeVideos} changeHref="/pricing" /> : null}
      {authConfigured ? (
        <SignUpForm plan={choice ? { id: choice.plan.id, billing: choice.billing } : undefined} />
      ) : (
        <FormMessage tone="error">Accounts aren&apos;t available on this server yet: Supabase Auth is not configured.</FormMessage>
      )}
    </AuthCard>
  );
}

export default function SignUpPage(props: PageProps<"/sign-up">) {
  return (
    <Suspense fallback={null}>
      <Content {...props} />
    </Suspense>
  );
}
