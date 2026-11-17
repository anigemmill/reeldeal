import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { AuthCard, FormMessage } from "@/components/app/auth/auth-card";
import { SignInForm } from "@/components/app/auth/auth-forms";
import { safeNextPath } from "@/lib/safe-redirect";
import { authConfigured } from "@/server/app/supabase";

export const metadata: Metadata = { title: "Sign in" };

async function Content({ searchParams }: PageProps<"/sign-in">) {
  const q = await searchParams;
  const next = safeNextPath(q.next);
  const banner = q.expired
    ? "Your session ended. Sign in again to pick up where you left off."
    : q.signed_out === "everywhere"
      ? "You're signed out on every device and browser."
      : q.signed_out
        ? "You're signed out."
        : q.reset ? "Password updated. Sign in with your new password." : undefined;
  return (
    <AuthCard title="Welcome" accent="back." footer={<>New to Reeldeal? <Link href="/sign-up" className="font-medium text-link underline-offset-4 hover:underline">Create an account</Link></>}>
      {authConfigured ? <SignInForm next={next} banner={banner} /> : <FormMessage tone="error">Accounts aren&apos;t available on this server yet: Supabase Auth is not configured.</FormMessage>}
    </AuthCard>
  );
}

export default function Page(props: PageProps<"/sign-in">) {
  return (
    <Suspense fallback={null}>
      <Content {...props} />
    </Suspense>
  );
}
