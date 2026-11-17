import { MailCheck, TriangleAlert } from "lucide-react";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { Suspense } from "react";
import { AuthCard, FormMessage } from "@/components/app/auth/auth-card";
import { ResendVerificationForm } from "@/components/app/auth/auth-forms";
import { RESEND_COOLDOWN_COOKIE, RESEND_COOLDOWN_SECONDS, VERIFY_EMAIL_COOKIE } from "@/server/app/auth-cookies";
import { getSessionUser } from "@/server/app/session";
import { authConfigured } from "@/server/app/supabase";

export const metadata: Metadata = { title: "Confirm your email" };

/** Seconds until another confirmation email may be sent from this browser. */
function cooldownLeft(lastSentAt: number) {
  return Math.max(0, Math.ceil((lastSentAt + RESEND_COOLDOWN_SECONDS * 1000 - Date.now()) / 1000));
}

/*
  Email verification (D10). Reached after sign-up, after signing in with an unconfirmed
  address, from an expired or used link (/auth/callback), or from any app page while
  the address is unconfirmed (src/proxy.ts). Confirmed users are sent on to onboarding.
*/
async function Content({ searchParams }: PageProps<"/verify-email">) {
  const q = await searchParams;
  const store = await cookies();
  const user = await getSessionUser();
  const email = user?.email ?? store.get(VERIFY_EMAIL_COOKIE)?.value ?? null;
  const cooldown = cooldownLeft(Number(store.get(RESEND_COOLDOWN_COOKIE)?.value ?? 0));
  const invalid = q.link === "invalid";
  const footer = (
    <>
      Already confirmed? <Link href="/sign-in" className="font-medium text-link underline-offset-4 hover:underline">Sign in</Link>
      <span aria-hidden> · </span>
      Wrong address? <Link href="/sign-up" className="font-medium text-link underline-offset-4 hover:underline">Start again</Link>
    </>
  );

  if (!authConfigured) {
    return (
      <AuthCard title="Confirm your" accent="email.">
        <FormMessage tone="error">Accounts aren&apos;t available on this server yet: Supabase Auth is not configured.</FormMessage>
      </AuthCard>
    );
  }

  if (invalid) {
    return (
      <AuthCard
        title="This link has"
        accent="expired."
        intro="Confirmation links work once and only for a limited time. If you've already confirmed your email, sign in. Otherwise, send yourself a new link."
        footer={footer}
      >
        <StatusIcon tone="warning" />
        <ResendVerificationForm email={email} cooldownSeconds={cooldown} />
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Check your"
      accent="inbox."
      intro={
        email ? (
          <>
            We sent a confirmation link to <strong className="font-semibold text-ink">{email}</strong>. Open it to confirm your email and set up your workspace.
          </>
        ) : (
          "We sent you a confirmation link. Open it to confirm your email and set up your workspace."
        )
      }
      footer={footer}
    >
      {q.reason === "unconfirmed" ? <FormMessage tone="notice">Your email isn&apos;t confirmed yet. Use the link we sent, or send a new one.</FormMessage> : <StatusIcon tone="info" />}
      <ol className="flex flex-col gap-2.5 text-sm text-ink-muted">
        {["Open the email from Reeldeal. Check spam or promotions if it isn't there.", "Select Confirm my email.", "You'll come straight back here to set up your workspace."].map((s, i) => (
          <li key={s} className="flex gap-3">
            <span className="inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-surface-muted font-mono text-xs text-ink">{i + 1}</span>
            <span className="pt-0.5">{s}</span>
          </li>
        ))}
      </ol>
      <div className="flex flex-col gap-2 border-t border-line pt-5">
        <p className="text-sm text-ink-muted">Didn&apos;t get it?</p>
        <ResendVerificationForm email={email} cooldownSeconds={cooldown} />
      </div>
    </AuthCard>
  );
}

function StatusIcon({ tone }: { tone: "info" | "warning" }) {
  const Icon = tone === "info" ? MailCheck : TriangleAlert;
  return (
    <span aria-hidden className={tone === "info" ? "inline-flex size-12 items-center justify-center rounded-xl bg-tint text-on-tint" : "inline-flex size-12 items-center justify-center rounded-xl bg-warning/15 text-warning"}>
      <Icon className="size-6" strokeWidth={1.8} />
    </span>
  );
}

export default function Page(props: PageProps<"/verify-email">) {
  return (
    <Suspense fallback={null}>
      <Content {...props} />
    </Suspense>
  );
}
