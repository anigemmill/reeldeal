import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard } from "@/components/app/auth/auth-card";
import { ForgotPasswordForm } from "@/components/app/auth/auth-forms";

export const metadata: Metadata = { title: "Reset your password" };

export default function ForgotPasswordPage() {
  return (
    <AuthCard title="Reset your" accent="password." intro="We'll email you a link to choose a new one." footer={<Link href="/sign-in" className="font-medium text-link underline-offset-4 hover:underline">Back to sign in</Link>}>
      <ForgotPasswordForm />
    </AuthCard>
  );
}
