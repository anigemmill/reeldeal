import "server-only";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { cache } from "react";
import type { Ctx } from "../context";
import { getProfile, principalForSession, type Membership } from "../services/account";
import { getPlatform } from "./platform";
import { authConfigured, supabaseServer } from "./supabase";

export const ORG_COOKIE = "rd_org";

export type SessionUser = {
  id: string;
  email: string | null;
  name: string | null;
  /** Plan picked on the pricing page at sign-up (unvalidated; parse with parsePlanChoice). Not the workspace's plan. */
  selectedPlan: string | null;
  selectedBilling: string | null;
  /** True once the email address is confirmed (Supabase Auth email_confirmed_at). Required for onboarding and the app. */
  emailVerified: boolean;
  /** A requested email change still waiting for confirmation (secure email change: both addresses confirm). */
  pendingEmail: string | null;
  createdAt: string | null;
  lastSignInAt: string | null;
};

/**
 * The signed-in user, verified with Supabase Auth (getUser checks the token with the
 * auth server rather than trusting the cookie). Null when signed out or expired.
 */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  await connection(); // per-request data: never prerendered
  if (!authConfigured) return null;
  const supabase = await supabaseServer();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  const meta = (data.user.user_metadata ?? {}) as { full_name?: string; selected_plan?: unknown; selected_billing?: unknown };
  return {
    id: data.user.id,
    email: data.user.email ?? null,
    name: meta.full_name ?? null,
    selectedPlan: typeof meta.selected_plan === "string" ? meta.selected_plan : null,
    selectedBilling: typeof meta.selected_billing === "string" ? meta.selected_billing : null,
    emailVerified: Boolean(data.user.email_confirmed_at),
    pendingEmail: data.user.new_email ?? null,
    createdAt: data.user.created_at ?? null,
    lastSignInAt: data.user.last_sign_in_at ?? null,
  };
});

export type AppContext = { ctx: Ctx; user: SessionUser & { displayName: string | null }; memberships: Membership[] };

/** Context for a signed-in user with a workspace, or null (signed out / no workspace yet). */
export type UnverifiedContext = { user: SessionUser; memberships: []; unverified: true };

export const loadAppContext = cache(async (): Promise<AppContext | { user: SessionUser; memberships: [] } | UnverifiedContext | null> => {
  const user = await getSessionUser();
  if (!user) return null;
  // No workspace data for an unconfirmed address, whatever the project's confirmation setting (D10).
  if (!user.emailVerified) return { user, memberships: [], unverified: true };
  const p = await getPlatform();
  const preferred = (await cookies()).get(ORG_COOKIE)?.value ?? null;
  const s = await principalForSession(p, user.id, preferred);
  if (!s) return { user, memberships: [] };
  const profile = await getProfile(p, user.id);
  return { ctx: { ...p, principal: s.principal }, user: { ...user, displayName: profile.display_name ?? user.name }, memberships: s.memberships };
});

/** For pages: signed in, email confirmed, with a workspace; otherwise redirect to sign-in, verification or onboarding. */
export async function requireAppContext(next = "/dashboard"): Promise<AppContext> {
  const c = await loadAppContext();
  if (!c) redirect(`/sign-in?next=${encodeURIComponent(next)}`);
  if ("unverified" in c) redirect("/verify-email");
  if (!("ctx" in c)) redirect("/onboarding");
  return c;
}
