"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import { completeOnboarding, requestPasswordReset, resendVerification, signIn, signUp, updatePassword, type FormState } from "@/app/(app)/(auth)/actions";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { FormMessage } from "./auth-card";

/* Auth and onboarding forms. Work without JavaScript too (server actions). */

function Messages({ state }: { state: FormState }) {
  if (state?.error) return <FormMessage tone="error">{state.error}</FormMessage>;
  if (state?.notice) return <FormMessage tone="notice">{state.notice}</FormMessage>;
  return null;
}

export function SignInForm({ next, banner }: { next: string; banner?: string }) {
  const [state, action, pending] = useActionState(signIn, undefined);
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      {banner && !state ? <FormMessage tone="notice">{banner}</FormMessage> : null}
      <Messages state={state} />
      <input type="hidden" name="next" value={next} />
      <Field label="Email">
        <Input name="email" type="email" autoComplete="email" required defaultValue={state?.values?.email} />
      </Field>
      <Field label="Password">
        <Input name="password" type="password" autoComplete="current-password" required />
      </Field>
      <div className="flex justify-end text-sm">
        <Link href="/forgot-password" className="text-link underline-offset-4 hover:underline">Forgot your password?</Link>
      </div>
      <Button type="submit" variant="primary" size="lg" loading={pending}>
        {pending ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}

export function SignUpForm({ plan }: { plan?: { id: string; billing: "monthly" | "annual" } }) {
  const [state, action, pending] = useActionState(signUp, undefined);
  if (state?.notice) return <FormMessage tone="notice">{state.notice}</FormMessage>;
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <Messages state={state} />
      {plan ? (
        <>
          <input type="hidden" name="plan" value={plan.id} />
          <input type="hidden" name="billing" value={plan.billing} />
        </>
      ) : null}
      <Field label="Your name" error={state?.fieldErrors?.name}>
        <Input name="name" autoComplete="name" required defaultValue={state?.values?.name} />
      </Field>
      <Field label="Work email" error={state?.fieldErrors?.email}>
        <Input name="email" type="email" autoComplete="email" required defaultValue={state?.values?.email} />
      </Field>
      <Field label="Password" hint="At least 8 characters." error={state?.fieldErrors?.password}>
        <Input name="password" type="password" autoComplete="new-password" required minLength={8} />
      </Field>
      <div className="flex flex-col gap-1.5">
        <label className="flex items-start gap-2.5 text-sm leading-relaxed">
          <input
            type="checkbox"
            name="terms"
            value="accepted"
            required
            aria-invalid={state?.fieldErrors?.terms ? true : undefined}
            aria-describedby={state?.fieldErrors?.terms ? "terms-error" : undefined}
            className="mt-1 size-4 shrink-0 accent-primary"
          />
          <span>
            I agree to the{" "}
            <Link href="/terms" target="_blank" className="text-link underline underline-offset-4">Terms of Service</Link> and{" "}
            <Link href="/privacy" target="_blank" className="text-link underline underline-offset-4">Privacy Policy</Link>.
          </span>
        </label>
        {state?.fieldErrors?.terms ? <p id="terms-error" className="text-xs font-medium text-danger">{state.fieldErrors.terms}</p> : null}
      </div>
      <Button type="submit" variant="primary" size="lg" loading={pending}>
        {pending ? "Creating your account…" : "Create account"}
      </Button>
      {plan ? null : <p className="text-xs leading-relaxed text-ink-muted">New accounts start on the Free plan. No card needed.</p>}
    </form>
  );
}

export function ForgotPasswordForm() {
  const [state, action, pending] = useActionState(requestPasswordReset, undefined);
  if (state?.notice) return <FormMessage tone="notice">{state.notice}</FormMessage>;
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <Messages state={state} />
      <Field label="Email" error={state?.fieldErrors?.email}>
        <Input name="email" type="email" autoComplete="email" required defaultValue={state?.values?.email} />
      </Field>
      <Button type="submit" variant="primary" size="lg" loading={pending}>
        {pending ? "Sending…" : "Send reset link"}
      </Button>
    </form>
  );
}

export function ResetPasswordForm() {
  const [state, action, pending] = useActionState(updatePassword, undefined);
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <Messages state={state} />
      <Field label="New password" hint="At least 8 characters." error={state?.fieldErrors?.password}>
        <Input name="password" type="password" autoComplete="new-password" required minLength={8} />
      </Field>
      <Button type="submit" variant="primary" size="lg" loading={pending}>
        {pending ? "Saving…" : "Save new password"}
      </Button>
    </form>
  );
}

export function OnboardingForm({ industries, defaultName }: { industries: readonly string[]; defaultName: string }) {
  const [state, action, pending] = useActionState(completeOnboarding, undefined);
  const [industry, setIndustry] = useState(state?.values?.industry ?? "");
  const fe = state?.fieldErrors ?? {};
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <Messages state={state} />
      <Field label="Your name" error={fe.display_name}>
        <Input name="display_name" autoComplete="name" defaultValue={state?.values?.display_name ?? defaultName} />
      </Field>
      <Field label="Business name" hint="This names your workspace and your first brand profile." error={fe.business_name}>
        <Input name="business_name" autoComplete="organization" required defaultValue={state?.values?.business_name} />
      </Field>
      <Field label="Industry" error={fe.industry}>
        <Select options={industries.map((i) => ({ value: i, label: i }))} value={industry} onValueChange={setIndustry} placeholder="Choose your industry" />
      </Field>
      <input type="hidden" name="industry" value={industry} />
      <Field label="Website (optional)" error={fe.website}>
        <Input name="website" type="url" inputMode="url" autoComplete="url" placeholder="yourbusiness.co.nz" defaultValue={state?.values?.website} />
      </Field>
      <Button type="submit" variant="action" size="lg" loading={pending}>
        {pending ? "Setting up your workspace…" : "Create workspace"}
      </Button>
    </form>
  );
}

/** Resend the confirmation link (/verify-email). Asks for the address only when we don't already know it. */
export function ResendVerificationForm({ email, cooldownSeconds }: { email: string | null; cooldownSeconds: number }) {
  const [until, setUntil] = useState(() => Date.now() + cooldownSeconds * 1000);
  const [now, setNow] = useState(() => Date.now());
  const [state, action, pending] = useActionState(async (prev: FormState, form: FormData) => {
    const r = await resendVerification(prev, form);
    if (r?.notice) {
      const t = Date.now();
      setNow(t);
      setUntil(t + 60_000);
    }
    return r;
  }, undefined);
  const left = Math.max(0, Math.ceil((until - now) / 1000));
  useEffect(() => {
    if (left <= 0) return;
    const t = setTimeout(() => setNow(Date.now()), 1000);
    return () => clearTimeout(t);
  }, [left, now]);
  return (
    <form action={action} className="flex flex-col gap-3" noValidate>
      <Messages state={state} />
      {email ? null : (
        <Field label="Email you signed up with" error={state?.fieldErrors?.email}>
          <Input name="email" type="email" autoComplete="email" required defaultValue={state?.values?.email} />
        </Field>
      )}
      <Button type="submit" variant="secondary" size="lg" loading={pending} disabled={left > 0}>
        {pending ? "Sending…" : left > 0 ? `Send a new link in ${left}s` : "Send a new link"}
      </Button>
    </form>
  );
}
