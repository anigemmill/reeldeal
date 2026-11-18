"use server";

import { revalidatePath } from "next/cache";
import { publicEnv } from "@/env/public";
import type { FormState } from "@/app/(app)/(auth)/actions";
import { getPlatform } from "@/server/app/platform";
import { failure } from "@/server/app/result";
import { getSessionUser } from "@/server/app/session";
import { authConfigured, supabaseServer } from "@/server/app/supabase";
import { saveProfile } from "@/server/services/account";
import { verifyCurrentPassword } from "@/server/app/password-check";

/*
  Settings → Account. Every action re-verifies the signed-in user with Supabase Auth.
  - Email change uses Supabase's secure email change: a link goes to BOTH the current
    and the new address, and the change happens only when both are confirmed.
  - Password change checks the current password first. Supabase Auth v2.180 accepts
    `current_password` but does not verify it (found by the browser tests: a wrong
    current password changed the password), so the app verifies it itself with a
    throwaway, non-persisted sign-in whose session is revoked straight away. It still
    sends current_password, which newer Supabase Auth versions verify too.
    Other sessions are then signed out.
  Raw provider errors are mapped to plain messages and never logged with secrets.
*/
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const site = () => publicEnv.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

async function signedIn() {
  if (!authConfigured) return null;
  const user = await getSessionUser();
  return user && user.emailVerified ? user : null;
}
const ended: FormState = { error: "Your session has ended. Sign in again to continue." };

export async function updateDisplayName(_: FormState, form: FormData): Promise<FormState> {
  const user = await signedIn();
  if (!user) return ended;
  const name = str(form, "display_name");
  if (!name) return { fieldErrors: { display_name: "Enter your name." }, values: { display_name: name } };
  if (name.length > 120) return { fieldErrors: { display_name: "Use 120 characters or fewer." }, values: { display_name: name } };
  try {
    await saveProfile(await getPlatform(), user.id, name);
  } catch (e) {
    return { error: failure(e).error.message, values: { display_name: name } };
  }
  revalidatePath("/", "layout");
  return { notice: "Name saved.", values: { display_name: name } };
}

export async function requestEmailChange(_: FormState, form: FormData): Promise<FormState> {
  const user = await signedIn();
  if (!user) return ended;
  const email = str(form, "new_email").toLowerCase();
  if (!EMAIL_RE.test(email)) return { fieldErrors: { new_email: "Enter a valid email address." }, values: { new_email: email } };
  if (email === (user.email ?? "").toLowerCase()) return { fieldErrors: { new_email: "That's already your email address." }, values: { new_email: email } };
  const supabase = await supabaseServer();
  const { error } = await supabase.auth.updateUser({ email }, { emailRedirectTo: `${site()}/auth/callback?flow=email_change` });
  if (error) {
    if (error.code === "email_exists" || /already (been )?registered|already exists/i.test(error.message)) return { fieldErrors: { new_email: "That address belongs to another account." }, values: { new_email: email } };
    if (error.status === 429 || error.code?.startsWith("over_")) return { error: "Too many requests. Wait a minute and try again.", values: { new_email: email } };
    return { error: "We couldn't start the email change. Please try again.", values: { new_email: email } };
  }
  revalidatePath("/settings/account");
  return { notice: `Check both inboxes: we've sent a confirmation link to ${user.email} and to ${email}. Your email changes once both are confirmed.` };
}

export async function changePassword(_: FormState, form: FormData): Promise<FormState> {
  const user = await signedIn();
  if (!user) return ended;
  const current = String(form.get("current_password") ?? "");
  const next = String(form.get("new_password") ?? "");
  const confirm = String(form.get("confirm_password") ?? "");
  const fieldErrors: Record<string, string> = {};
  if (!current) fieldErrors.current_password = "Enter your current password.";
  if (next.length < 8) fieldErrors.new_password = "Use at least 8 characters.";
  else if (next === current) fieldErrors.new_password = "Choose a password you haven't used here.";
  if (confirm !== next) fieldErrors.confirm_password = "The passwords don't match.";
  if (Object.keys(fieldErrors).length) return { fieldErrors };
  const check = await verifyCurrentPassword(user.email ?? "", current);
  if (check === "wrong") return { fieldErrors: { current_password: "That isn't your current password." } };
  if (check === "limited") return { error: "Too many attempts. Wait a few minutes and try again." };
  if (check === "unavailable") return { error: "We couldn't check your password just now. Please try again." };
  const supabase = await supabaseServer();
  const { error } = await supabase.auth.updateUser({ password: next, current_password: current });
  if (error) {
    const code = error.code ?? "";
    if (code === "current_password_mismatch" || code === "current_password_required" || code === "invalid_credentials" || /current password/i.test(error.message)) {
      return { fieldErrors: { current_password: "That isn't your current password." } };
    }
    if (code === "weak_password") return { fieldErrors: { new_password: "Choose a stronger password." } };
    if (code === "same_password") return { fieldErrors: { new_password: "Choose a password you haven't used here." } };
    if (error.status === 429 || code.startsWith("over_")) return { error: "Too many attempts. Wait a minute and try again." };
    return { error: "We couldn't change your password. Please try again." };
  }
  // Anyone else holding an old session (another browser or device) is signed out.
  await supabase.auth.signOut({ scope: "others" });
  return { notice: "Password changed. Other browsers and devices have been signed out." };
}
