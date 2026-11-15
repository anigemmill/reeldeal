import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { AuthCard, FormMessage } from "@/components/app/auth/auth-card";
import { ResetPasswordForm } from "@/components/app/auth/auth-forms";
import { getSessionUser } from "@/server/app/session";

export const metadata: Metadata = { title: "Choose a new password" };

/* Reached from the emailed link via /auth/callback, which signs the user in for this step. */
async function Content() {
  const user = await getSessionUser();
  return (
    <AuthCard title="Choose a new" accent="password.">
      {user ? (
        <ResetPasswordForm />
      ) : (
        <FormMessage tone="error">
          This reset link has expired or was already used. <Link href="/forgot-password" className="underline">Request a new one</Link>.
        </FormMessage>
      )}
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
