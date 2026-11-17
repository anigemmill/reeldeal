"use server";

import { cookies } from "next/headers";
import { serverEnv } from "@/env/server";
import { getPlatform } from "@/server/app/platform";
import { failure, type ActionResult } from "@/server/app/result";
import { ORG_COOKIE, getSessionUser } from "@/server/app/session";
import { authConfigured } from "@/server/app/supabase";
import { acceptInvitation, previewInvitation, type InvitationPreview } from "@/server/services/team";

/*
  The /invite page. The token arrives in the POST body only (it lives in the URL fragment in the
  browser), is never logged, and is hashed before it reaches the database. Errors carry no token.
*/
export type InviteView = { signedIn: false } | { signedIn: true; email: string | null; verified: boolean; preview: InvitationPreview | null };

export async function loadInvitation(token: string): Promise<InviteView> {
  const user = authConfigured ? await getSessionUser() : null;
  if (!user) return { signedIn: false };
  if (!user.emailVerified) return { signedIn: true, email: user.email, verified: false, preview: null };
  try {
    return { signedIn: true, email: user.email, verified: true, preview: await previewInvitation(await getPlatform(), user.id, String(token)) };
  } catch {
    return { signedIn: true, email: user.email, verified: true, preview: { status: "not_found" } };
  }
}

export async function acceptInvitationAction(token: string): Promise<ActionResult<{ org_id: string }>> {
  return accept({ token: String(token) });
}

/** Onboarding's "Join" button: accept by id (the database still checks the confirmed email matches). */
export async function joinInvitedWorkspace(invitationId: string): Promise<ActionResult<{ org_id: string }>> {
  return accept({ invitationId: String(invitationId) });
}

async function accept(by: { token: string } | { invitationId: string }): Promise<ActionResult<{ org_id: string }>> {
  const user = authConfigured ? await getSessionUser() : null;
  if (!user) return { ok: false, error: { code: "unauthorised", message: "Sign in to accept this invitation." } };
  if (!user.emailVerified) return { ok: false, error: { code: "forbidden", message: "Confirm your email address first." } };
  try {
    const r = await acceptInvitation(await getPlatform(), user.id, by);
    // Open the workspace they just joined.
    (await cookies()).set(ORG_COOKIE, r.org_id, { httpOnly: true, sameSite: "lax", path: "/", secure: serverEnv.NODE_ENV === "production", maxAge: 60 * 60 * 24 * 365 });
    return { ok: true, data: r };
  } catch (e) {
    return failure(e);
  }
}
