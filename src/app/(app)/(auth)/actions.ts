"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { publicEnv } from "@/env/public";
import { parsePlanChoice } from "@/lib/pricing";
import { safeNextPath } from "@/lib/safe-redirect";
import { serverEnv } from "@/env/server";
import { getPlatform } from "@/server/app/platform";
import { failure } from "@/server/app/result";
import { RESEND_COOLDOWN_COOKIE, RESEND_COOLDOWN_SECONDS, VERIFY_EMAIL_COOKIE } from "@/server/app/auth-cookies";
import { ORG_COOKIE, getSessionUser } from "@/server/app/session";
import { authConfigured, supabaseServer } from "@/server/app/supabase";
import { checkAuthRateLimit, clientIp, type AuthAction } from "@/server/auth/rate-limit";
import { createWorkspace } from "@/server/services/account";

/*
  Authentication with Supabase Auth (server-side, cookie sessions). Errors are
  mapped to plain messages; raw provider errors and tokens are never logged or returned.
*/
export type FormState = { error?: string; fieldErrors?: Record<string, string>; notice?: string; values?: Record<string, string> } | undefined;

const safeNext = (v: FormDataEntryValue | null) => safeNextPath(v);
const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const siteUrl = async () => publicEnv.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

function authMessage(e: { message?: string; code?: string; status?: number }) {
  const code = e.code ?? "";
  const m = (e.message ?? "").toLowerCase();
  if (code === "invalid_credentials" || m.includes("invalid login")) return "That email and password don't match an account.";
  if (code === "user_already_exists" || m.includes("already registered")) return "An account with this email already exists. Sign in instead.";
  if (code === "email_not_confirmed" || m.includes("not confirmed")) return "Confirm your email address first: we sent you a link.";
  if (code === "weak_password" || m.includes("password should")) return "Choose a stronger password: at least 8 characters.";
  if (code.startsWith("over_") || e.status === 429) return "Too many attempts. Wait a minute and try again.";
  if (e.status && e.status >= 500) return "Sign-in is temporarily unavailable. Please try again shortly.";
  return "We couldn't complete that. Check the details and try again.";
}

const notConfigured = { error: "Accounts aren't available on this server yet: Supabase Auth is not configured." };

/** App-side limits per visitor IP and per email, before Supabase Auth is called (src/server/auth/rate-limit.ts). */
async function tooMany(action: AuthAction, email: string | null, mode: "hit" | "peek" | "fail" = "hit"): Promise<boolean> {
  const p = await getPlatform().catch(() => null);
  if (!p) return false; // no database: Supabase Auth's own limits still apply
  return !(await checkAuthRateLimit(p, action, { ip: clientIp(await headers()), email }, mode)).ok;
}
const slowDown = "Too many attempts. Wait a few minutes and try again.";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const cookieBase = () => ({ httpOnly: true, sameSite: "lax" as const, path: "/", secure: serverEnv.NODE_ENV === "production" });
const callbackUrl = async (flow: "signup" | "recovery" | "email_change") => `${await siteUrl()}/auth/callback?flow=${flow}`;
async function rememberPendingEmail(email: string) {
  (await cookies()).set(VERIFY_EMAIL_COOKIE, email, { ...cookieBase(), maxAge: 60 * 60 * 24 });
}

export async function signIn(_: FormState, form: FormData): Promise<FormState> {
  if (!authConfigured) return notConfigured;
  const email = str(form, "email");
  const password = String(form.get("password") ?? "");
  if (!email || !password) return { error: "Enter your email and password.", values: { email } };
  // Only failed sign-ins count (an office sharing one IP isn't slowed by successful ones).
  if (await tooMany("sign_in", email, "peek")) return { error: slowDown, values: { email } };
  const supabase = await supabaseServer();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error && (error.code === "invalid_credentials" || /invalid login/i.test(error.message))) await tooMany("sign_in", email, "fail");
  if (error && (error.code === "email_not_confirmed" || /not confirmed/i.test(error.message))) {
    await rememberPendingEmail(email);
    redirect("/verify-email?reason=unconfirmed");
  }
  if (error) return { error: authMessage(error), values: { email } };
  redirect(safeNext(form.get("next")));
}

export async function signUp(_: FormState, form: FormData): Promise<FormState> {
  if (!authConfigured) return notConfigured;
  const name = str(form, "name");
  const email = str(form, "email");
  const password = String(form.get("password") ?? "");
  const fieldErrors: Record<string, string> = {};
  if (!name) fieldErrors.name = "Enter your name.";
  if (!EMAIL_RE.test(email)) fieldErrors.email = "Enter a valid email address.";
  if (password.length < 8) fieldErrors.password = "Use at least 8 characters.";
  if (form.get("terms") !== "accepted") fieldErrors.terms = "Agree to the Terms of Service and Privacy Policy to continue.";
  if (Object.keys(fieldErrors).length) return { fieldErrors, values: { name, email } };
  if (await tooMany("sign_up", email)) return { error: slowDown, values: { name, email } };
  const choice = parsePlanChoice(form.get("plan"), form.get("billing"));
  const supabase = await supabaseServer();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    // The plan picked on the pricing page is kept on the account (it survives email confirmation).
    // It is a record of intent only: every workspace starts on Free until paid plans can be bought.
    options: { data: { full_name: name, ...(choice ? { selected_plan: choice.plan.id, selected_billing: choice.billing } : {}) }, emailRedirectTo: await callbackUrl("signup") },
  });
  if (error) return { error: authMessage(error), values: { name, email } };
  // Email confirmation required (D10): no session until the link is opened.
  // (An existing address gets the same answer, so sign-up can't be used to probe accounts.)
  if (!data.session || !data.user?.email_confirmed_at) {
    await rememberPendingEmail(email);
    (await cookies()).set(RESEND_COOLDOWN_COOKIE, String(Date.now()), { ...cookieBase(), maxAge: RESEND_COOLDOWN_SECONDS });
    redirect("/verify-email");
  }
  redirect("/onboarding");
}

export async function signOut() {
  if (authConfigured) {
    const supabase = await supabaseServer();
    await supabase.auth.signOut();
  }
  (await cookies()).delete(ORG_COOKIE);
  redirect("/sign-in?signed_out=1");
}

/** Ends every session for this account (all browsers and devices), then this one. */
export async function signOutEverywhere() {
  if (authConfigured) {
    const supabase = await supabaseServer();
    await supabase.auth.signOut({ scope: "global" });
  }
  (await cookies()).delete(ORG_COOKIE);
  redirect("/sign-in?signed_out=everywhere");
}

/**
 * Send the confirmation link again. Same reply whether or not an unconfirmed account
 * exists for the address; one request per minute per browser on top of Supabase's own limits.
 */
export async function resendVerification(_: FormState, form: FormData): Promise<FormState> {
  if (!authConfigured) return notConfigured;
  const store = await cookies();
  const user = await getSessionUser();
  const email = (user?.email ?? (str(form, "email") || store.get(VERIFY_EMAIL_COOKIE)?.value || "")).trim();
  if (!EMAIL_RE.test(email)) return { fieldErrors: { email: "Enter the email address you signed up with." }, values: { email } };
  if (user?.emailVerified) redirect("/onboarding?verified=already");
  const last = Number(store.get(RESEND_COOLDOWN_COOKIE)?.value ?? 0);
  const wait = Math.ceil((last + RESEND_COOLDOWN_SECONDS * 1000 - Date.now()) / 1000);
  if (wait > 0) return { error: `Please wait ${wait} seconds before sending another link.`, values: { email } };
  if (await tooMany("resend", email)) return { error: slowDown, values: { email } };
  const supabase = await supabaseServer();
  const { error } = await supabase.auth.resend({ type: "signup", email, options: { emailRedirectTo: await callbackUrl("signup") } });
  if (error && (error.status === 429 || error.code?.startsWith("over_"))) return { error: "We sent a link to this address less than a minute ago. Wait a moment, then try again.", values: { email } };
  if (error && (error.status ?? 0) >= 500) return { error: authMessage(error), values: { email } };
  store.set(RESEND_COOLDOWN_COOKIE, String(Date.now()), { ...cookieBase(), maxAge: RESEND_COOLDOWN_SECONDS });
  await rememberPendingEmail(email);
  return { notice: `We've sent a new confirmation link to ${email}. It can take a minute to arrive; check spam too.`, values: { email } };
}

export async function requestPasswordReset(_: FormState, form: FormData): Promise<FormState> {
  if (!authConfigured) return notConfigured;
  const email = str(form, "email");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { fieldErrors: { email: "Enter a valid email address." }, values: { email } };
  if (await tooMany("password_reset", email)) return { error: slowDown, values: { email } };
  const supabase = await supabaseServer();
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: await callbackUrl("recovery") });
  if (error && (error.status === 429 || (error.status ?? 0) >= 500)) return { error: authMessage(error), values: { email } };
  // Same answer whether or not the account exists, so emails can't be probed.
  return { notice: `If an account exists for ${email}, we've sent a link to reset the password.` };
}

export async function updatePassword(_: FormState, form: FormData): Promise<FormState> {
  if (!authConfigured) return notConfigured;
  const password = String(form.get("password") ?? "");
  if (password.length < 8) return { fieldErrors: { password: "Use at least 8 characters." } };
  if (!(await getSessionUser())) return { error: "This reset link has expired. Request a new one." };
  const supabase = await supabaseServer();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: authMessage(error) };
  redirect("/dashboard?password_updated=1");
}

export async function completeOnboarding(_: FormState, form: FormData): Promise<FormState> {
  const user = await getSessionUser();
  if (!user) redirect("/sign-in?expired=1&next=/onboarding");
  if (!user.emailVerified) redirect("/verify-email");
  const values = { business_name: str(form, "business_name"), industry: str(form, "industry"), website: str(form, "website"), display_name: str(form, "display_name") };
  try {
    const { org_id } = await createWorkspace(await getPlatform(), user.id, { ...values, display_name: values.display_name || undefined } as never);
    (await cookies()).set(ORG_COOKIE, org_id, { httpOnly: true, sameSite: "lax", path: "/", secure: serverEnv.NODE_ENV === "production", maxAge: 60 * 60 * 24 * 365 });
  } catch (e) {
    const f = failure(e).error;
    const issues = (f.details?.issues ?? []) as { field: string; message: string }[];
    if (issues.length) return { fieldErrors: Object.fromEntries(issues.map((i) => [i.field, i.message])), values };
    return { error: f.message, values };
  }
  redirect("/dashboard?welcome=1");
}
