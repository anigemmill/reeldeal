"use server";

import { revalidatePath } from "next/cache";
import { publicEnv } from "@/env/public";
import { serverEnv } from "@/env/server";
import { verifyCurrentPassword } from "@/server/app/password-check";
import { failure, withCtx, type ActionResult } from "@/server/app/result";
import { loadAppContext } from "@/server/app/session";
import { takeInvitationBudget } from "@/server/auth/rate-limit";
import { emailConfigured, sendEmail } from "@/server/email/resend";
import { invitationEmail } from "@/server/email/templates";
import { createMyToken, revokeMyToken } from "@/server/services/access-tokens";
import { changeMemberRole, getTeam, inviteMembers, leaveWorkspace, removeMember, revokeInvitation, transferOwnership } from "@/server/services/team";
import { updateWorkspaceDetails } from "@/server/services/workspace-settings";
import { setAiMediaConsent } from "@/server/services/workspace";

/*
  Settings → Team, Workspace and Access tokens. Thin wrappers: every rule is in the services and
  the database (RLS, security-definer functions). These only add the session, emails and revalidation.
  Invitation links (tokens) are returned to the inviting admin only when email isn't configured,
  so they can copy them (U5). They are never logged.
*/
const site = () => publicEnv.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
const emailCfg = () => ({ apiKey: serverEnv.RESEND_API_KEY, from: serverEnv.EMAIL_FROM, replyTo: serverEnv.EMAIL_REPLY_TO });
const done = <T>(r: ActionResult<T>, ...paths: string[]) => {
  if (r.ok) for (const p of paths) revalidatePath(p);
  return r;
};

export type InviteOutcome = { email: string; link?: string; emailed?: boolean; error?: string };

/** Invite one or more addresses. Emails each link (Resend) when configured; otherwise returns the links to copy. */
export async function inviteAction(rawEmails: string, role: string): Promise<ActionResult<{ results: InviteOutcome[]; emailDelivery: boolean }>> {
  const c = await loadAppContext();
  if (!c || !("ctx" in c)) return { ok: false, error: { code: "unauthenticated", message: "Your session has ended. Sign in again to continue." } };
  const emails = [...new Set(String(rawEmails).split(/[\s,;]+/).map((e) => e.trim().toLowerCase()).filter(Boolean))];
  if (!emails.length) return { ok: false, error: { code: "invalid_input", message: "Enter at least one email address." } };
  if (emails.length > 20) return { ok: false, error: { code: "invalid_input", message: "Invite up to 20 people at a time." } };
  const valid = emails.filter((e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));
  const results: InviteOutcome[] = emails.filter((e) => !valid.includes(e)).map((email) => ({ email, error: "This isn't a valid email address." }));
  const delivery = emailConfigured(emailCfg());
  try {
    // A daily budget per workspace: each invitation can send an email from our domain.
    const allowed = valid.length ? await takeInvitationBudget(c.ctx, c.ctx.principal.orgId, valid.length) : 0;
    for (const email of valid.slice(allowed)) results.push({ email, error: "This workspace has sent a lot of invitations today. Try again tomorrow." });
    const toInvite = valid.slice(0, allowed);
    if (toInvite.length) {
      const r = await inviteMembers(c.ctx, { emails: toInvite, role: role as "editor" }, { acceptUrlBase: site() });
      const team = delivery ? await getTeam(c.ctx) : null;
      for (const i of r.invitations) {
        if (i.error || !i.accept_url) {
          results.push({ email: i.email, error: i.error ?? "Not invited." });
          continue;
        }
        if (!delivery) {
          results.push({ email: i.email, link: i.accept_url });
          continue;
        }
        const msg = invitationEmail({
          to: i.email,
          workspace: team!.workspace,
          inviter: c.user.displayName ?? c.user.email ?? "A teammate",
          role: role as "editor",
          acceptUrl: i.accept_url,
          expiresAt: team!.invitations.find((x) => x.id === i.invitation_id)?.expires_at ?? new Date(Date.now() + 7 * 864e5).toISOString(),
          siteUrl: site(),
        });
        // One send per invitation id: a retried action can't email the same invitation twice.
        const sent = await sendEmail(emailCfg(), { ...msg, to: i.email, idempotencyKey: `invitation:${i.invitation_id}`, tags: { kind: "invitation" } }, { log: c.ctx.log });
        results.push(sent.sent ? { email: i.email, emailed: true } : { email: i.email, link: i.accept_url, error: "Created, but the email didn't send. Copy the link and send it yourself." });
      }
    }
  } catch (e) {
    return failure(e);
  }
  revalidatePath("/settings/team");
  return { ok: true, data: { results, emailDelivery: delivery } };
}

export async function revokeInviteAction(invitationId: string) {
  return done(await withCtx((ctx) => revokeInvitation(ctx, String(invitationId))), "/settings/team");
}

/** "New link" / "Resend": revoke the open invitation and invite the same address again (the old link stops working). */
export async function renewInviteAction(invitationId: string): Promise<ActionResult<{ results: InviteOutcome[]; emailDelivery: boolean }>> {
  const team = await withCtx((ctx) => getTeam(ctx));
  if (!team.ok) return team;
  const inv = team.data.invitations.find((i) => i.id === String(invitationId));
  if (!inv) return { ok: false, error: { code: "not_found", message: "That invitation isn't open any more." } };
  const revoked = await withCtx((ctx) => revokeInvitation(ctx, inv.id));
  if (!revoked.ok) return revoked;
  return inviteAction(inv.email, inv.role);
}

export async function changeRoleAction(userId: string, role: string) {
  return done(await withCtx((ctx) => changeMemberRole(ctx, String(userId), String(role))), "/settings/team");
}

export async function removeMemberAction(userId: string) {
  return done(await withCtx((ctx) => removeMember(ctx, String(userId))), "/settings/team");
}

export async function leaveWorkspaceAction() {
  const r = await withCtx((ctx) => leaveWorkspace(ctx));
  if (r.ok) revalidatePath("/", "layout");
  return r;
}

/** Transfer ownership: typed workspace name plus the owner's current password (checked with Supabase Auth first). */
export async function transferOwnershipAction(newOwnerId: string, confirmName: string, password: string): Promise<ActionResult<{ transferred: true }>> {
  const c = await loadAppContext();
  if (!c || !("ctx" in c)) return { ok: false, error: { code: "unauthenticated", message: "Your session has ended. Sign in again to continue." } };
  if (!password) return { ok: false, error: { code: "invalid_input", message: "Enter your password to confirm." } };
  const check = await verifyCurrentPassword(c.user.email ?? "", String(password));
  if (check === "wrong") return { ok: false, error: { code: "forbidden", message: "That isn't your password." } };
  if (check === "limited") return { ok: false, error: { code: "rate_limited", message: "Too many attempts. Wait a few minutes and try again." } };
  if (check === "unavailable") return { ok: false, error: { code: "unavailable", message: "We couldn't check your password just now. Please try again." } };
  try {
    await transferOwnership(c.ctx, { newOwnerId: String(newOwnerId), confirmName: String(confirmName), passwordVerified: true });
  } catch (e) {
    return failure(e);
  }
  revalidatePath("/", "layout");
  return { ok: true, data: { transferred: true } };
}

export type WorkspaceDetailsInput = { name?: string; legal_name?: string; industry?: string; website?: string; location?: string; phone?: string; default_formats?: string[] };

export async function updateWorkspaceAction(input: WorkspaceDetailsInput) {
  const r = await withCtx((ctx) => updateWorkspaceDetails(ctx, input as never));
  if (r.ok) revalidatePath("/", "layout");
  return r;
}

export async function setAiConsentAction(enabled: boolean) {
  return done(await withCtx((ctx) => setAiMediaConsent(ctx, Boolean(enabled))), "/settings/workspace", "/library");
}

export async function createTokenAction(input: { name: string; scopes: string[]; expires_in_days: number }) {
  return done(await withCtx((ctx) => createMyToken(ctx, input as never)), "/settings/tokens");
}

export async function revokeTokenAction(tokenId: string) {
  return done(await withCtx((ctx) => revokeMyToken(ctx, String(tokenId))), "/settings/tokens");
}
