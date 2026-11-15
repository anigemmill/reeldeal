import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard, FormMessage } from "@/components/app/auth/auth-card";
import { SignUpForm } from "@/components/app/auth/auth-forms";
import { authConfigured } from "@/server/app/supabase";

export const metadata: Metadata = { title: "Create your account" };

export default function SignUpPage() {
  return (
    <AuthCard
      title="Start making"
      accent="videos."
      intro="Create your account, then set up your workspace and brand in under a minute."
      footer={<>Already have an account? <Link href="/sign-in" className="font-medium text-link underline-offset-4 hover:underline">Sign in</Link></>}
    >
      {authConfigured ? <SignUpForm /> : <FormMessage tone="error">Accounts aren&apos;t available on this server yet: Supabase Auth is not configured.</FormMessage>}
    </AuthCard>
  );
}
