import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";
import { getPlan } from "@/lib/pricing";
import type { MemberRole } from "../auth/principal";
import { asUser, iso, type Ctx, type Platform } from "../context";
import { AppError, invalid, parseInput } from "../errors";

/*
  Team management (Stage 5 backend; screens in src/components/app/settings/team-screen.tsx).
  Every rule lives in the database (migration 20261118000001, private.* functions run as the
  signed-in user); this module adds what the database can't know:
    - invitation tokens: 256-bit random, sent once in a link, stored as SHA-256 only
    - the plan's seat limit (config/pricing.json)
    - the typed confirmation for ownership transfer (the password is checked by the web
      action with Supabase Auth before this is called)
  and turns the database's refusals into plain messages.
*/
const INVITE_PREFIX = "rdl_inv_";
export const INVITE_FORMAT = /^rdl_inv_[A-Za-z0-9_-]{43}$/;
export const hashInviteToken = (token: string) => createHash("sha256").update(token).digest("hex");
/**
  The link someone receives. The token goes in the URL fragment (after "#"): browsers never send
  the fragment to a server, so it can't reach access logs, proxies, analytics or Referer headers.
  The /invite page reads it in the browser and posts it to a server action.
*/
export const inviteUrl = (base: string, token: string) => `${base}/invite#${token}`;

/** Map the membership functions' errors (SQLSTATE + message) to user-facing errors. */
function teamError(e: unknown): never {
  const err = e as { code?: string; message?: string };
  const m = err.message ?? "";
  const known: [RegExp, AppError][] = [
    [/already a member/, new AppError("conflict", "That person is already in this workspace.")],
    [/no seats left/, new AppError("conflict", "All seats on your plan are taken. Remove someone, revoke an invitation or upgrade.")],
    [/only the owner can invite administrators/, new AppError("forbidden", "Only the owner can invite administrators.")],
    [/ownership is transferred/, invalid("A workspace has one owner. Use Transfer ownership instead.")],
    [/cannot change your own role/, new AppError("forbidden", "You can't change your own role.")],
    [/use transfer ownership/, new AppError("forbidden", "The owner's role changes only through Transfer ownership.")],
    [/only the owner can (manage|remove) administrators/, new AppError("forbidden", "Only the owner can change or remove administrators.")],
    [/leave the workspace instead/, new AppError("forbidden", "To remove yourself, leave the workspace.")],
    [/the owner cannot be removed/, new AppError("forbidden", "The owner can't be removed. Ownership must be transferred first.")],
    [/transfer ownership before leaving/, new AppError("forbidden", "Transfer ownership before leaving: a workspace always has an owner.")],
    [/only the owner can transfer/, new AppError("forbidden", "Only the owner can transfer ownership.")],
    [/already own/, invalid("You already own this workspace.")],
    [/must be an administrator or editor/, invalid("Choose an administrator or editor as the new owner.")],
    [/must have a confirmed email/, invalid("The new owner needs to confirm their email address first.")],
    [/invitation expired/, invalid("This invitation has expired. Ask for a new one.")],
    [/invitation revoked/, invalid("This invitation was withdrawn. Ask for a new one.")],
    [/invitation already used/, invalid("This invitation has already been used.")],
    [/invitation not found/, new AppError("not_found", "This invitation isn't valid for your account. Sign in with the email address it was sent to.")],
    [/not a member|^not found$/, new AppError("not_found", "That person or invitation isn't in this workspace.")],
    [/not allowed|not signed in/, new AppError("forbidden", "Your role can't do that in this workspace.")],
  ];
  for (const [re, appErr] of known) if (re.test(m)) throw appErr;
  if (err.code === "23505") throw new AppError("conflict", "That already exists.");
  throw e;
}

const callAsUser = async <T>(p: Platform, userId: string, text: string, params: unknown[]) => {
  try {
    return await p.db.asUser(userId, (sql) => sql.query<T>(text, params));
  } catch (e) {
    teamError(e);
  }
};

export type TeamMember = { user_id: string; role: MemberRole; joined_at: string | null; email: string; display_name: string | null; last_sign_in_at: string | null; you: boolean };
export type PendingInvite = { id: string; email: string; role: Exclude<MemberRole, "owner">; invited_by: string | null; created_at: string | null; expires_at: string | null; expired: boolean };

/** Members, open invitations and seats for the current workspace. Members see the team; only admins see invitations. */
export async function getTeam(ctx: Ctx) {
  const members = (await callAsUser<Omit<TeamMember, "you">>(ctx, ctx.principal.userId, "select * from private.team_members($1)", [ctx.principal.orgId]))!;
  const [org] = await asUser(ctx, (sql) => sql.query<{ plan_id: string; name: string }>("select plan_id, name from public.organisations where id = $1", [ctx.principal.orgId]));
  // RLS returns no rows to non-admins: they simply don't see invitations.
  const invites = await asUser(ctx, (sql) =>
    sql.query<{ id: string; email: string; role: PendingInvite["role"]; invited_by: string | null; created_at: string; expires_at: string }>(
      `select id, email, role, invited_by, created_at, expires_at from public.invitations
        where org_id = $1 and accepted_at is null and revoked_at is null order by created_at desc`,
      [ctx.principal.orgId],
    ),
  );
  const now = Date.now();
  const open = invites.map((i) => ({ ...i, created_at: iso(i.created_at), expires_at: iso(i.expires_at), expired: new Date(i.expires_at).getTime() <= now }));
  const seats = getPlan(org.plan_id)?.users ?? null;
  return {
    workspace: org.name,
    my_role: ctx.principal.role,
    seats: { limit: seats, used: members.length + open.filter((i) => !i.expired).length },
    members: members.map((m) => ({ ...m, joined_at: iso(m.joined_at), last_sign_in_at: iso(m.last_sign_in_at), you: m.user_id === ctx.principal.userId })),
    invitations: open,
  };
}

const InviteInput = z.object({
  emails: z.array(z.string().trim().toLowerCase().pipe(z.email({ message: "Enter valid email addresses" }))).min(1).max(20),
  role: z.enum(["admin", "editor", "viewer"]),
});

/**
 * Create invitations. Returns each accept link ONCE (the token is not stored): the caller
 * emails it (Resend, when configured) or shows it to the admin to copy. Never logged.
 */
export async function inviteMembers(ctx: Ctx, raw: z.input<typeof InviteInput>, opts: { acceptUrlBase: string }) {
  const i = parseInput(InviteInput, raw);
  const [org] = await asUser(ctx, (sql) => sql.query<{ plan_id: string }>("select plan_id from public.organisations where id = $1", [ctx.principal.orgId]));
  if (!org) throw new AppError("not_found", "Workspace not available");
  const seatLimit = getPlan(org.plan_id)?.users ?? null;
  const results: { email: string; invitation_id?: string; accept_url?: string; error?: string }[] = [];
  for (const email of [...new Set(i.emails)]) {
    const token = INVITE_PREFIX + randomBytes(32).toString("base64url");
    try {
      const [row] = (await callAsUser<{ id: string }>(ctx, ctx.principal.userId, "select private.create_invitation($1, $2, $3, $4, $5) as id", [
        ctx.principal.orgId,
        email,
        i.role,
        hashInviteToken(token),
        seatLimit,
      ]))!;
      results.push({ email, invitation_id: row.id, accept_url: inviteUrl(opts.acceptUrlBase, token) });
    } catch (e) {
      if (e instanceof AppError && e.code !== "internal") results.push({ email, error: e.message });
      else throw e;
    }
  }
  return { invitations: results };
}

export async function revokeInvitation(ctx: Ctx, invitationId: string) {
  const id = parseInput(z.uuid(), invitationId);
  await callAsUser(ctx, ctx.principal.userId, "select private.revoke_invitation($1)", [id]);
  return { revoked: true };
}

/** Open invitations for this signed-in user's confirmed email (onboarding's "You've been invited"). */
export async function myInvitations(p: Platform, userId: string) {
  const rows = (await callAsUser<{ id: string; org_id: string; org_name: string; role: MemberRole; invited_by_name: string; expires_at: string }>(p, userId, "select * from private.my_invitations()", []))!;
  return rows.map((r) => ({ ...r, expires_at: iso(r.expires_at) }));
}

/** Accept by the emailed token (link) or by invitation id (onboarding). Returns the organisation joined. */
export async function acceptInvitation(p: Platform, userId: string, by: { token: string } | { invitationId: string }) {
  let hash: string | null = null;
  let id: string | null = null;
  if ("token" in by) {
    if (!INVITE_FORMAT.test(by.token)) throw new AppError("not_found", "This invitation link isn't valid.");
    hash = hashInviteToken(by.token);
  } else id = parseInput(z.uuid(), by.invitationId);
  const [row] = (await callAsUser<{ org_id: string }>(p, userId, "select private.accept_invitation($1, $2) as org_id", [hash, id]))!;
  return { org_id: row.org_id };
}

export type InvitationPreview =
  | { status: "open" | "expired" | "revoked" | "used" | "member"; org_name: string; role: Exclude<MemberRole, "owner">; invited_by_name: string; expires_at: string | null }
  | { status: "not_found" | "other_account" };

/** What the invitation page shows a signed-in visitor (details only when the invitation is for their confirmed address). */
export async function previewInvitation(p: Platform, userId: string, token: string): Promise<InvitationPreview> {
  if (!INVITE_FORMAT.test(token)) return { status: "not_found" };
  const [row] = (await callAsUser<{ status: string; org_name: string | null; role: string | null; invited_by_name: string | null; expires_at: string | null }>(
    p, userId, "select * from private.invitation_preview($1)", [hashInviteToken(token)],
  ))!;
  if (!row || row.status === "not_found" || row.status === "other_account") return { status: row?.status === "other_account" ? "other_account" : "not_found" };
  return { status: row.status as "open", org_name: row.org_name!, role: row.role as "editor", invited_by_name: row.invited_by_name!, expires_at: iso(row.expires_at) };
}

export async function changeMemberRole(ctx: Ctx, userId: string, role: string) {
  const target = parseInput(z.uuid(), userId);
  const r = parseInput(z.enum(["admin", "editor", "viewer", "owner"]), role);
  await callAsUser(ctx, ctx.principal.userId, "select private.change_member_role($1, $2, $3)", [ctx.principal.orgId, target, r]);
  return { changed: true };
}

export async function removeMember(ctx: Ctx, userId: string) {
  const target = parseInput(z.uuid(), userId);
  await callAsUser(ctx, ctx.principal.userId, "select private.remove_member($1, $2)", [ctx.principal.orgId, target]);
  return { removed: true };
}

export async function leaveWorkspace(ctx: Ctx) {
  await callAsUser(ctx, ctx.principal.userId, "select private.leave_workspace($1)", [ctx.principal.orgId]);
  return { left: true };
}

/**
 * Transfer ownership. `confirmName` must match the workspace name exactly; the web action
 * verifies the owner's password with Supabase Auth BEFORE calling this (passwordVerified).
 */
export async function transferOwnership(ctx: Ctx, input: { newOwnerId: string; confirmName: string; passwordVerified: boolean }) {
  const target = parseInput(z.uuid(), input.newOwnerId);
  if (!input.passwordVerified) throw new AppError("forbidden", "Confirm with your password to transfer ownership.");
  const [org] = await asUser(ctx, (sql) => sql.query<{ name: string }>("select name from public.organisations where id = $1", [ctx.principal.orgId]));
  if (!org || input.confirmName.trim() !== org.name) throw invalid("Type the workspace name exactly to confirm.");
  await callAsUser(ctx, ctx.principal.userId, "select private.transfer_ownership($1, $2)", [ctx.principal.orgId, target]);
  return { transferred: true };
}

/** Recent audit events for administrators (RLS returns nothing to others). */
export async function auditLog(ctx: Ctx, limit = 50) {
  const rows = await asUser(ctx, (sql) =>
    sql.query<{ action: string; actor_id: string | null; target_user_id: string | null; metadata: Record<string, unknown>; created_at: string }>(
      "select action, actor_id, target_user_id, metadata, created_at from public.audit_events where org_id = $1 order by created_at desc limit $2",
      [ctx.principal.orgId, Math.min(200, Math.max(1, limit))],
    ),
  );
  return rows.map((r) => ({ ...r, created_at: iso(r.created_at) }));
}
