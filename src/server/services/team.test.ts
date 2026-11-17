import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createAccessToken, verifyAccessToken } from "../auth/tokens";
import { SCOPES, type MemberRole, type Principal } from "../auth/principal";
import type { Ctx, Platform } from "../context";
import type { AppError } from "../errors";
import type { DemoData } from "../seed";
import { createTestPlatform } from "../testing";
import { principalForSession } from "./account";
import { listProjects } from "./projects";
import {
  acceptInvitation,
  auditLog,
  changeMemberRole,
  getTeam,
  hashInviteToken,
  inviteMembers,
  leaveWorkspace,
  myInvitations,
  previewInvitation,
  removeMember,
  revokeInvitation,
  transferOwnership,
} from "./team";

/*
  Team permission model (migration 20261118000001 + services/team.ts), run as real users
  through the real database functions. Every rule from docs/team-permissions.md is a test.
  Runs on PGlite (npm test) and the supabase/postgres image (npm run test:supabase-local).
*/
let t: Awaited<ReturnType<typeof createTestPlatform>>;
let p: Platform;
let d: DemoData;
const BASE = "https://app.reeldeal.test";
const code = async (pr: Promise<unknown>) => ((await pr.then(() => null, (e) => e)) as AppError | null)?.code ?? "ok";
const sys = <T>(q: string, params: unknown[] = []) => p.db.system((sql) => sql.query<T & Record<string, unknown>>(q, params));
/** A context as the app would build it. The role here is only what the app believes; the database checks the real one. */
const ctx = (userId: string, orgId: string, role: MemberRole = "viewer"): Ctx => t.ctxAs({ userId, orgId, role, scopes: [...SCOPES], via: "session" } as Principal);
async function newUser(email: string, confirmed = true) {
  const id = randomUUID();
  await sys("insert into auth.users (id, email, email_confirmed_at) values ($1, $2, $3)", [id, email, confirmed ? new Date() : null]);
  return id;
}
const roleOf = async (orgId: string, userId: string) => (await sys<{ role: string }>("select role from public.memberships where org_id = $1 and user_id = $2", [orgId, userId]))[0]?.role ?? null;
const tokenOf = (url: string) => url.split("/invite#")[1]!;

let A: string, B: string; // organisations
let owner: string, editor: string, viewer: string, ownerB: string;
beforeAll(async () => {
  t = await createTestPlatform({ seed: true, clips: 1 });
  p = t.p;
  d = t.demo;
  A = d.ids.orgA;
  B = d.ids.orgB;
  owner = d.ids.aroha;
  editor = d.ids.ben;
  viewer = d.ids.cleo;
  ownerB = d.ids.dev;
  await sys("update public.organisations set plan_id = 'business' where id = $1", [A]); // 5 seats; the demo has 3 members
}, 120_000);
afterAll(async () => p?.db.close());

describe("invitations", () => {
  let adminId = "";
  it("the owner invites; the link carries a token that is stored only as a hash", async () => {
    const r = await inviteMembers(ctx(owner, A, "owner"), { emails: ["New.Admin@Example.test"], role: "admin" }, { acceptUrlBase: BASE });
    const inv = r.invitations[0]!;
    expect(inv.error).toBeUndefined();
    expect(inv.accept_url).toMatch(/^https:\/\/app\.reeldeal\.test\/invite#rdl_inv_[A-Za-z0-9_-]{43}$/);
    const [row] = await sys<{ email: string; token_hash: string; role: string }>("select email, token_hash, role from public.invitations where id = $1", [inv.invitation_id]);
    expect(row).toMatchObject({ email: "new.admin@example.test", role: "admin" });
    expect(row.token_hash).toBe(hashInviteToken(tokenOf(inv.accept_url!)));
    expect(row.token_hash).not.toContain("rdl_inv_");
    // The invitee signs up, confirms, and accepts with the link.
    adminId = await newUser("new.admin@example.test");
    expect(await acceptInvitation(p, adminId, { token: tokenOf(inv.accept_url!) })).toEqual({ org_id: A });
    expect(await roleOf(A, adminId)).toBe("admin");
  });

  it("administrators can invite editors and viewers, never administrators or owners", async () => {
    const as = ctx(adminId, A, "admin");
    expect((await inviteMembers(as, { emails: ["ed@example.test"], role: "editor" }, { acceptUrlBase: BASE })).invitations[0]!.error).toBeUndefined();
    expect((await inviteMembers(as, { emails: ["boss@example.test"], role: "admin" }, { acceptUrlBase: BASE })).invitations[0]!.error).toMatch(/Only the owner can invite administrators/);
    expect(await code(inviteMembers(as, { emails: ["x@example.test"], role: "owner" as never }, { acceptUrlBase: BASE }))).toBe("invalid_input");
  });

  it("editors and viewers cannot invite, even if the app believed they were admins", async () => {
    for (const u of [editor, viewer]) {
      const r = await inviteMembers(ctx(u, A, "admin"), { emails: ["sneaky@example.test"], role: "viewer" }, { acceptUrlBase: BASE });
      expect(r.invitations[0]!.error).toMatch(/can't do that/);
    }
  });

  it("cannot invite into another organisation", async () => {
    // RLS hides organisation B entirely, so this fails before reaching the invitation function.
    expect(await code(inviteMembers(ctx(owner, B, "owner"), { emails: ["intruder@example.test"], role: "editor" }, { acceptUrlBase: BASE }))).toBe("not_found");
    expect((await sys("select 1 from public.invitations where org_id = $1", [B])).length).toBe(0);
  });

  it("refuses existing members and enforces the plan's seats (members + open invitations)", async () => {
    expect((await inviteMembers(ctx(owner, A, "owner"), { emails: ["ben@lakeside.example"], role: "viewer" }, { acceptUrlBase: BASE })).invitations[0]!.error).toMatch(/already in this workspace/);
    // 4 members + 1 open invitation = 5 of 5 seats.
    const r = await inviteMembers(ctx(owner, A, "owner"), { emails: ["one-too-many@example.test"], role: "viewer" }, { acceptUrlBase: BASE });
    expect(r.invitations[0]!.error).toMatch(/All seats/);
    const team = await getTeam(ctx(owner, A, "owner"));
    expect(team.seats).toEqual({ limit: 5, used: 5 });
  });

  it("only the matching, confirmed account can accept; others get a uniform not found", async () => {
    await sys("update public.organisations set plan_id = 'agency' where id = $1", [A]); // 10 seats for the rest
    const r = await inviteMembers(ctx(owner, A, "owner"), { emails: ["invitee@example.test"], role: "viewer" }, { acceptUrlBase: BASE });
    const token = tokenOf(r.invitations[0]!.accept_url!);
    const stranger = await newUser("stranger@example.test");
    expect(await code(acceptInvitation(p, stranger, { token }))).toBe("not_found");
    const unconfirmed = await newUser("invitee@example.test", false);
    expect(await code(acceptInvitation(p, unconfirmed, { token }))).toBe("not_found");
    expect(await myInvitations(p, unconfirmed)).toEqual([]); // unconfirmed address: no invitations shown
    await sys("update auth.users set email_confirmed_at = now() where id = $1", [unconfirmed]);
    const mine = await myInvitations(p, unconfirmed);
    expect(mine.map((i) => [i.org_name, i.role])).toEqual([["Lakeside Lodge", "viewer"]]);
    expect(await acceptInvitation(p, unconfirmed, { invitationId: mine[0]!.id })).toEqual({ org_id: A });
    expect(await roleOf(A, unconfirmed)).toBe("viewer");
    // Single use: a second account can't reuse it; the same person repeating is harmless.
    expect(await code(acceptInvitation(p, stranger, { token }))).toBe("not_found");
    expect(await acceptInvitation(p, unconfirmed, { token })).toEqual({ org_id: A });
    expect(await myInvitations(p, unconfirmed)).toEqual([]);
  });

  it("expired and revoked invitations don't work; malformed tokens are rejected up front", async () => {
    const exp = await inviteMembers(ctx(owner, A, "owner"), { emails: ["late@example.test"], role: "viewer" }, { acceptUrlBase: BASE });
    await sys("update public.invitations set expires_at = now() - interval '1 minute' where id = $1", [exp.invitations[0]!.invitation_id]);
    const late = await newUser("late@example.test");
    expect(await code(acceptInvitation(p, late, { token: tokenOf(exp.invitations[0]!.accept_url!) }))).toBe("invalid_input");
    expect(await roleOf(A, late)).toBeNull();

    const rev = await inviteMembers(ctx(owner, A, "owner"), { emails: ["withdrawn@example.test"], role: "viewer" }, { acceptUrlBase: BASE });
    await revokeInvitation(ctx(owner, A, "owner"), rev.invitations[0]!.invitation_id!);
    const withdrawn = await newUser("withdrawn@example.test");
    expect(await code(acceptInvitation(p, withdrawn, { token: tokenOf(rev.invitations[0]!.accept_url!) }))).toBe("invalid_input");
    expect(await roleOf(A, withdrawn)).toBeNull();

    expect(await code(acceptInvitation(p, withdrawn, { token: "rdl_inv_short" }))).toBe("not_found");
    expect(await code(acceptInvitation(p, withdrawn, { token: "rdl_inv_" + "x".repeat(43) }))).toBe("not_found");
  });

  it("the invitation page preview shows details only to the invited, confirmed account", async () => {
    const r = await inviteMembers(ctx(owner, A, "owner"), { emails: ["preview@example.test"], role: "editor" }, { acceptUrlBase: BASE });
    const token = tokenOf(r.invitations[0]!.accept_url!);
    const stranger = await newUser("preview-stranger@example.test");
    expect(await previewInvitation(p, stranger, token)).toEqual({ status: "other_account" }); // no workspace name, role or inviter
    const unconfirmed = await newUser("preview@example.test", false);
    expect(await previewInvitation(p, unconfirmed, token)).toEqual({ status: "other_account" });
    await sys("update auth.users set email_confirmed_at = now() where id = $1", [unconfirmed]);
    expect(await previewInvitation(p, unconfirmed, token)).toMatchObject({ status: "open", org_name: "Lakeside Lodge", role: "editor" });
    await acceptInvitation(p, unconfirmed, { token });
    expect((await previewInvitation(p, unconfirmed, token)).status).toBe("member");
    expect(await previewInvitation(p, stranger, "rdl_inv_" + "y".repeat(43))).toEqual({ status: "not_found" });
    expect(await previewInvitation(p, stranger, "not-a-token")).toEqual({ status: "not_found" });
  });

  it("re-inviting replaces the old link (the first one stops working)", async () => {
    const first = await inviteMembers(ctx(owner, A, "owner"), { emails: ["twice@example.test"], role: "editor" }, { acceptUrlBase: BASE });
    const second = await inviteMembers(ctx(owner, A, "owner"), { emails: ["twice@example.test"], role: "viewer" }, { acceptUrlBase: BASE });
    const twice = await newUser("twice@example.test");
    expect(await code(acceptInvitation(p, twice, { token: tokenOf(first.invitations[0]!.accept_url!) }))).toBe("invalid_input");
    await acceptInvitation(p, twice, { token: tokenOf(second.invitations[0]!.accept_url!) });
    expect(await roleOf(A, twice)).toBe("viewer");
  });

  it("non-admins don't see invitations; nobody can read token hashes or write invitations directly", async () => {
    expect((await getTeam(ctx(viewer, A))).invitations).toEqual([]);
    expect((await getTeam(ctx(owner, A, "owner"))).invitations.length).toBeGreaterThan(0);
    const direct = (q: string) => p.db.asUser(owner, (sql) => sql.query(q)).then(() => "ALLOWED", (e: Error) => e.message);
    expect(await direct("select token_hash from public.invitations")).toMatch(/permission denied/);
    expect(await direct(`insert into public.invitations (org_id, email, role, token_hash) values ('${A}', 'x@example.test', 'admin', 'h')`)).toMatch(/permission denied/);
    expect(await direct("update public.invitations set expires_at = now() + interval '1 year'")).toMatch(/permission denied/);
  });
});

describe("roles", () => {
  let admin = "";
  beforeAll(async () => {
    admin = await newUser("role-admin@example.test");
    await sys("insert into public.memberships (org_id, user_id, role) values ($1, $2, 'admin')", [A, admin]);
  });

  it("nobody changes their own role, including the owner", async () => {
    for (const [u, r] of [[viewer, "viewer"], [editor, "editor"], [admin, "admin"], [owner, "owner"]] as const) {
      expect(await code(changeMemberRole(ctx(u, A, r), u, "admin"))).toBe("forbidden");
    }
    expect(await roleOf(A, viewer)).toBe("viewer");
  });

  it("users cannot elevate themselves by writing memberships directly", async () => {
    const err = await p.db.asUser(viewer, (sql) => sql.query(`update public.memberships set role = 'owner' where user_id = '${viewer}'`)).then(() => "ALLOWED", (e: Error) => e.message);
    expect(err).toMatch(/permission denied/);
    const ins = await p.db.asUser(viewer, (sql) => sql.query(`insert into public.memberships (org_id, user_id, role) values ('${B}', '${viewer}', 'owner')`)).then(() => "ALLOWED", (e: Error) => e.message);
    expect(ins).toMatch(/permission denied/);
  });

  it("editors and viewers cannot change anyone's role, whatever the app believes", async () => {
    expect(await code(changeMemberRole(ctx(editor, A, "owner"), viewer, "editor"))).toBe("forbidden");
    expect(await code(changeMemberRole(ctx(viewer, A, "owner"), editor, "viewer"))).toBe("forbidden");
  });

  it("administrators manage editors and viewers only, and can't create administrators", async () => {
    await changeMemberRole(ctx(admin, A, "admin"), viewer, "editor");
    expect(await roleOf(A, viewer)).toBe("editor");
    await changeMemberRole(ctx(admin, A, "admin"), viewer, "viewer");
    expect(await code(changeMemberRole(ctx(admin, A, "admin"), viewer, "admin"))).toBe("forbidden");
    expect(await code(changeMemberRole(ctx(admin, A, "admin"), owner, "viewer"))).toBe("forbidden");
  });

  it("nobody can make someone owner by a role change: ownership is only transferred", async () => {
    expect(await code(changeMemberRole(ctx(owner, A, "owner"), admin, "owner"))).toBe("forbidden");
    expect(await roleOf(A, admin)).toBe("admin");
  });

  it("the owner manages administrators", async () => {
    await changeMemberRole(ctx(owner, A, "owner"), admin, "editor");
    expect(await roleOf(A, admin)).toBe("editor");
    await changeMemberRole(ctx(owner, A, "owner"), admin, "admin");
  });

  it("can't touch another organisation's members", async () => {
    expect(await code(changeMemberRole(ctx(owner, A, "owner"), ownerB, "viewer"))).toBe("not_found");
    expect(await code(changeMemberRole(ctx(owner, B, "owner"), ownerB, "viewer"))).toBe("forbidden");
    expect(await roleOf(B, ownerB)).toBe("owner");
  });
});

describe("removal and leaving", () => {
  it("removed members lose access immediately: session, tokens and data", async () => {
    const gone = await newUser("leaving-soon@example.test");
    await sys("insert into public.memberships (org_id, user_id, role) values ($1, $2, 'editor')", [A, gone]);
    const tok = await createAccessToken(p.db, { userId: gone, orgId: A, name: "laptop" });
    expect((await verifyAccessToken(p.db, tok.token)).orgId).toBe(A);
    expect((await listProjects(ctx(gone, A, "editor"))).projects.length).toBeGreaterThan(0);

    await removeMember(ctx(owner, A, "owner"), gone);
    expect(await principalForSession(p, gone, A)).toBeNull();
    expect(await code(verifyAccessToken(p.db, tok.token))).toBe("unauthenticated");
    expect((await listProjects(ctx(gone, A, "editor"))).projects).toEqual([]); // a stale context sees nothing (RLS)
  });

  it("the owner can't be removed; admins can't remove admins; nobody removes themselves", async () => {
    const admin2 = await newUser("admin-two@example.test");
    const admin3 = await newUser("admin-three@example.test");
    await sys("insert into public.memberships (org_id, user_id, role) values ($1, $2, 'admin'), ($1, $3, 'admin')", [A, admin2, admin3]);
    expect(await code(removeMember(ctx(admin2, A, "admin"), owner))).toBe("forbidden");
    expect(await code(removeMember(ctx(admin2, A, "admin"), admin3))).toBe("forbidden");
    expect(await code(removeMember(ctx(admin2, A, "admin"), admin2))).toBe("forbidden");
    expect(await code(removeMember(ctx(editor, A, "admin"), viewer))).toBe("forbidden");
    await removeMember(ctx(owner, A, "owner"), admin3);
    expect(await roleOf(A, admin3)).toBeNull();
  });

  it("members can leave; the owner must transfer first", async () => {
    const leaver = await newUser("leaver@example.test");
    await sys("insert into public.memberships (org_id, user_id, role) values ($1, $2, 'viewer')", [A, leaver]);
    await leaveWorkspace(ctx(leaver, A));
    expect(await roleOf(A, leaver)).toBeNull();
    expect(await code(leaveWorkspace(ctx(owner, A, "owner")))).toBe("forbidden");
  });
});

describe("ownership transfer", () => {
  let heir = "", unconfirmedHeir = "";
  beforeAll(async () => {
    heir = await newUser("heir@example.test");
    unconfirmedHeir = await newUser("not-yet@example.test", false);
    await sys("insert into public.memberships (org_id, user_id, role) values ($1, $2, 'admin'), ($1, $3, 'editor')", [A, heir, unconfirmedHeir]);
  });

  it("needs the owner's password and the exact workspace name", async () => {
    expect(await code(transferOwnership(ctx(owner, A, "owner"), { newOwnerId: heir, confirmName: "Lakeside Lodge", passwordVerified: false }))).toBe("forbidden");
    expect(await code(transferOwnership(ctx(owner, A, "owner"), { newOwnerId: heir, confirmName: "lakeside lodge", passwordVerified: true }))).toBe("invalid_input");
  });

  it("administrators can't take ownership, and nobody else can give it", async () => {
    expect(await code(transferOwnership(ctx(heir, A, "owner"), { newOwnerId: heir, confirmName: "Lakeside Lodge", passwordVerified: true }))).toBe("forbidden");
    expect(await code(transferOwnership(ctx(editor, A, "owner"), { newOwnerId: heir, confirmName: "Lakeside Lodge", passwordVerified: true }))).toBe("forbidden");
    expect(await roleOf(A, owner)).toBe("owner");
  });

  it("the new owner must be a confirmed administrator or editor of this workspace", async () => {
    const yes = { confirmName: "Lakeside Lodge", passwordVerified: true };
    expect(await code(transferOwnership(ctx(owner, A, "owner"), { newOwnerId: viewer, ...yes }))).toBe("invalid_input");
    expect(await code(transferOwnership(ctx(owner, A, "owner"), { newOwnerId: unconfirmedHeir, ...yes }))).toBe("invalid_input");
    expect(await code(transferOwnership(ctx(owner, A, "owner"), { newOwnerId: ownerB, ...yes }))).toBe("not_found");
  });

  it("transfers: one owner afterwards, the old owner becomes an administrator, all audited", async () => {
    await transferOwnership(ctx(owner, A, "owner"), { newOwnerId: heir, confirmName: "Lakeside Lodge", passwordVerified: true });
    expect(await roleOf(A, heir)).toBe("owner");
    expect(await roleOf(A, owner)).toBe("admin");
    expect((await sys("select 1 from public.memberships where org_id = $1 and role = 'owner'", [A])).length).toBe(1);
    // The old owner (now admin) can't take it back or change the new owner.
    expect(await code(changeMemberRole(ctx(owner, A, "admin"), heir, "admin"))).toBe("forbidden");
    const log = await auditLog(ctx(heir, A, "owner"));
    expect(log.map((e) => e.action)).toEqual(expect.arrayContaining(["ownership.transferred", "member.removed", "member.role_changed", "member.joined", "invitation.created", "invitation.revoked"]));
    expect(await auditLog(ctx(editor, A))).toEqual([]); // non-admins see no audit log
  });

  it("the database itself forbids a second owner", async () => {
    const err = await sys("update public.memberships set role = 'owner' where org_id = $1 and user_id = $2", [A, editor]).then(() => "ALLOWED", (e: Error) => e.message);
    expect(err).toMatch(/memberships_one_owner|duplicate key/);
  });
});

describe("exposure", () => {
  it("anon can't reach the membership functions; signed-in users can't write the audit log", async () => {
    const [r] = await sys<{ anon_usage: boolean; anon_exec: boolean; auth_audit: boolean }>(
      `select has_schema_privilege('anon', 'private', 'usage') as anon_usage,
              has_function_privilege('anon', 'private.accept_invitation(text, uuid)', 'execute') as anon_exec,
              has_function_privilege('authenticated', 'private.audit(uuid, text, uuid, jsonb)', 'execute') as auth_audit`,
    );
    expect(r).toEqual({ anon_usage: false, anon_exec: false, auth_audit: false });
    const err = await p.db.asUser(owner, (sql) => sql.query(`insert into public.audit_events (org_id, action) values ('${A}', 'fake.event')`)).then(() => "ALLOWED", (e: Error) => e.message);
    expect(err).toMatch(/permission denied/);
  });
});
