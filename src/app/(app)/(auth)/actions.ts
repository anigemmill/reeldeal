"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { publicEnv } from "@/env/public";
import { serverEnv } from "@/env/server";
import { getPlatform } from "@/server/app/platform";
import { failure } from "@/server/app/result";
import { ORG_COOKIE, getSessionUser } from "@/server/app/session";
import { authConfigured, supabaseServer } from "@/server/app/supabase";
import { createWorkspace } from "@/server/services/account";

/*
  Authentication with Supabase Auth (server-side, cookie sessions). Errors are
  mapped to plain messages; raw provider errors and tokens are never logged or returned.
*/
export type FormState = { error?: string; fieldErrors?: Record<string, string>; notice?: string; values?: Record<string, string> } | undefined;

const safeNext = (v: FormDataEntryValue | null) => {
  const s = typeof v === "string" ? v : "";
  return s.startsWith("/") && !s.startsWith("//") && !s.startsWith("/\\") ? s : "/dashboard";
};
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

export async function signIn(_: FormState, form: FormData): Promise<FormState> {
  if (!authConfigured) return notConfigured;
  const email = str(form, "email");
  const password = String(form.get("password") ?? "");
  if (!email || !password) return { error: "Enter your email and password.", values: { email } };
  const supabase = await supabaseServer();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
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
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fieldErrors.email = "Enter a valid email address.";
  if (password.length < 8) fieldErrors.password = "Use at least 8 characters.";
  if (Object.keys(fieldErrors).length) return { fieldErrors, values: { name, email } };
  const supabase = await supabaseServer();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: name }, emailRedirectTo: `${await siteUrl()}/auth/callback?next=/onboarding` },
  });
  if (error) return { error: authMessage(error), values: { name, email } };
  // Projects that require email confirmation return no session: say so instead of pretending.
  if (!data.session) return { notice: `Check ${email} for a link to confirm your account, then sign in.` };
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

export async function requestPasswordReset(_: FormState, form: FormData): Promise<FormState> {
  if (!authConfigured) return notConfigured;
  const email = str(form, "email");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { fieldErrors: { email: "Enter a valid email address." }, values: { email } };
  const supabase = await supabaseServer();
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${await siteUrl()}/auth/callback?next=/reset-password` });
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
