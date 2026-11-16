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
  };
});

export type AppContext = { ctx: Ctx; user: SessionUser & { displayName: string | null }; memberships: Membership[] };

/** Context for a signed-in user with a workspace, or null (signed out / no workspace yet). */
export const loadAppContext = cache(async (): Promise<AppContext | { user: SessionUser; memberships: [] } | null> => {
  const user = await getSessionUser();
  if (!user) return null;
  const p = await getPlatform();
  const preferred = (await cookies()).get(ORG_COOKIE)?.value ?? null;
  const s = await principalForSession(p, user.id, preferred);
  if (!s) return { user, memberships: [] };
  const profile = await getProfile(p, user.id);
  return { ctx: { ...p, principal: s.principal }, user: { ...user, displayName: profile.display_name ?? user.name }, memberships: s.memberships };
});

/** For pages: signed in with a workspace, or redirect to sign-in / onboarding. */
export async function requireAppContext(next = "/dashboard"): Promise<AppContext> {
  const c = await loadAppContext();
  if (!c) redirect(`/sign-in?next=${encodeURIComponent(next)}`);
  if (!("ctx" in c)) redirect("/onboarding");
  return c;
}
