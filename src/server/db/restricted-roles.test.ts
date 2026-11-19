import { randomUUID } from "node:crypto";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { serverEnv } from "@/env/server";
import { createAccessToken, revokeAccessToken, verifyAccessToken } from "../auth/tokens";
import type { Ctx, Platform } from "../context";
import { createWorkspace } from "../services/account";
import { cancelMediaUpload, completeMediaUpload, createMediaUpload, requestAnalysis } from "../services/media";
import { submitStoryboard } from "../services/projects";
import { createVideo, getRenderStatus } from "../services/render";
import { getUsage } from "../services/usage";
import { checkAuthRateLimit } from "../auth/rate-limit";
import { createMyToken, listMyTokens, revokeMyToken } from "../services/access-tokens";
import { getBillingOverview } from "../services/billing";
import { acceptInvitation, changeMemberRole, getTeam, inviteMembers, removeMember, revokeInvitation } from "../services/team";
import { getOnboardingState, getWorkspaceSettings, savePreferences, saveOnboardingStep, updateWorkspaceDetails } from "../services/workspace-settings";
import { checkDatabaseRole, enforceDatabaseRole } from "./role-guard";
import type { DemoData } from "../seed";
import { createTestPlatform } from "../testing";
import { createWorker } from "../workers/runner";
import { createPostgresDb } from "./postgres";
import { claimsFor, type Db } from "./types";

/*
  Migration 20261117000001: the hosted services run as reeldeal_web (Next.js, /api/mcp)
  and reeldeal_worker (FFmpeg worker) instead of the database owner. This runs the real
  services and the real worker with every trusted query switched to those roles, so a
  missing grant fails here, not in production. It also checks what each role must NOT do.
  Runs on PGlite (npm test) and on the supabase/postgres image (npm run test:supabase-local),
  where it also logs in as the role for real.
*/
type Role = "reeldeal_web" | "reeldeal_worker";

/** The same database, with trusted work (and, for the web role, user work) run as a restricted role. */
function asRole(db: Db, role: Role): Db {
  return {
    ...db,
    system: (fn) =>
      db.system(async (sql) => {
        await sql.query(`set local role ${role}`);
        return fn(sql);
      }),
    asUser: (userId, fn) =>
      db.system(async (sql) => {
        await sql.query(`set local role ${role}`);
        await sql.query("set local role authenticated");
        await sql.query("select set_config('request.jwt.claims', $1, true)", [claimsFor(userId)]);
        return fn(sql);
      }),
  };
}

let owner: Platform;
let web: Platform;
let worker: Platform;
let d: DemoData;
const ctxFor = async (token: string): Promise<Ctx> => ({ ...web, principal: await verifyAccessToken(web.db, token) });
/** Error message (or "ALLOWED") for a statement run directly as a role. */
const as = (role: Role, q: string, params: unknown[] = []) =>
  owner.db.system(async (sql) => {
    await sql.query(`set local role ${role}`);
    return sql.query(q, params);
  }).then(
    (rows) => (rows.length === 0 && /^\s*(update|delete)/i.test(q) ? "NO ROWS" : "ALLOWED"),
    (e: Error) => e.message,
  );
/** Refused by a missing privilege, by a policy, or (update/delete) no rows visible to the role. */
const REFUSED = /permission denied|row-level security|NO ROWS/;
const ownerQuery = <T>(q: string, params: unknown[] = []) => owner.db.system((sql) => sql.query<T & Record<string, unknown>>(q, params));

beforeAll(async () => {
  const t = await createTestPlatform({ seed: true, clips: 3 });
  owner = t.p;
  d = t.demo;
  // On the supabase/postgres image the owner (postgres) is not a superuser, so the
  // emulation below needs membership to SET ROLE. Test only: production services log
  // in as these roles directly and the owner is never a member.
  if (serverEnv.TEST_DATABASE_URL) await ownerQuery("grant reeldeal_web, reeldeal_worker to current_user");
  web = { ...owner, db: asRole(owner.db, "reeldeal_web") };
  worker = { ...owner, db: asRole(owner.db, "reeldeal_worker") };
}, 120_000);
afterAll(async () => {
  if (serverEnv.TEST_DATABASE_URL) await ownerQuery("revoke reeldeal_web, reeldeal_worker from current_user").catch(() => {});
  await owner?.db.close();
});

describe("the roles themselves", () => {
  it("exist, cannot log in until the owner sets a password, and bypass nothing", async () => {
    const roles = await ownerQuery<{ rolname: string; rolcanlogin: boolean; rolbypassrls: boolean; rolsuper: boolean; rolcreaterole: boolean; rolinherit: boolean }>(
      "select rolname, rolcanlogin, rolbypassrls, rolsuper, rolcreaterole, rolinherit from pg_roles where rolname in ('reeldeal_web', 'reeldeal_worker') order by rolname",
    );
    expect(roles.map((r) => r.rolname)).toEqual(["reeldeal_web", "reeldeal_worker"]);
    for (const r of roles) expect(r).toMatchObject({ rolbypassrls: false, rolsuper: false, rolcreaterole: false, rolinherit: false });
    if (!serverEnv.TEST_DATABASE_URL) for (const r of roles) expect(r.rolcanlogin).toBe(false);
  });

  it("only the web role may act as a signed-in user", async () => {
    const [m] = await ownerQuery<{ web: boolean; worker: boolean }>(
      "select pg_has_role('reeldeal_web', 'authenticated', 'MEMBER') as web, pg_has_role('reeldeal_worker', 'authenticated', 'MEMBER') as worker",
    );
    expect(m).toEqual({ web: true, worker: false });
  });

  it("own no tables", async () => {
    const owned = await ownerQuery("select c.relname from pg_class c join pg_roles r on r.oid = c.relowner where r.rolname in ('reeldeal_web', 'reeldeal_worker')");
    expect(owned).toEqual([]);
  });
});

describe("the whole journey works as reeldeal_web + reeldeal_worker", () => {
  let aroha: Ctx;
  beforeAll(async () => {
    aroha = await ctxFor(d.tokens.aroha_owner_full);
  });

  it("creates a workspace for a new user (Free plan, owner, trial grant, first brand)", async () => {
    const userId = randomUUID();
    await ownerQuery("insert into auth.users (id, email) values ($1, $2)", [userId, `new-${userId.slice(0, 8)}@example.test`]);
    const w = await createWorkspace(web, userId, { business_name: "Glacier Hut", industry: "Accommodation", website: "glacierhut.example" });
    const [row] = await ownerQuery<{ plan_id: string; role: string }>("select o.plan_id, m.role from public.organisations o join public.memberships m on m.org_id = o.id where o.id = $1", [w.org_id]);
    expect(row).toEqual({ plan_id: "free", role: "owner" });
    const ctx: Ctx = { ...web, principal: { userId, orgId: w.org_id, role: "owner", scopes: ["mcp:read", "mcp:write", "mcp:render"], via: "session" } };
    expect((await getUsage(ctx)).video_credits.available).toBeGreaterThan(0);
  });

  it("a missing account is still reported as signed out (foreign key, not a read of auth.users)", async () => {
    const err = await createWorkspace(web, randomUUID(), { business_name: "Ghost", industry: "Other" }).catch((e) => e);
    expect(err.code).toBe("unauthenticated");
  });

  it("creates, verifies and revokes personal access tokens", async () => {
    const tok = await createAccessToken(web.db, { userId: d.ids.ben, orgId: d.ids.orgA, name: "restricted role test" });
    expect((await verifyAccessToken(web.db, tok.token)).orgId).toBe(d.ids.orgA);
    await revokeAccessToken(web.db, tok.id);
    await expect(verifyAccessToken(web.db, tok.token)).rejects.toMatchObject({ code: "unauthenticated" });
  });

  it("uploads (start, complete, cancel) and queues analysis, which the worker finishes", async () => {
    const dir = mkdtempSync(join(tmpdir(), "rd-roles-"));
    const file = join(dir, "still.png");
    // 1×1 PNG
    writeFileSync(file, Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64"));
    const up = await createMediaUpload(aroha, { title: "Roles test still", filename: "still.png", content_type: "image/png", size_bytes: 68 });
    const [{ storage_key }] = await ownerQuery<{ storage_key: string }>("select storage_key from public.media_assets where id = $1", [up.media_id]);
    await owner.storage.putFile(storage_key, file, "image/png");
    expect((await completeMediaUpload(aroha, up.media_id)).status).toBe("uploaded");
    const job = await requestAnalysis(aroha, up.media_id);
    expect(job.status).toBe("queued");
    const w = createWorker(worker);
    let ran;
    while ((ran = await w.runOnce())) if (ran.id === job.job_id) break;
    expect(ran?.status).toBe("succeeded");
    const [m] = await ownerQuery<{ status: string; width: number }>("select status, width from public.media_assets where id = $1", [up.media_id]);
    expect(m).toEqual({ status: "ready", width: 1 });

    const abandoned = await createMediaUpload(aroha, { title: "Never finished", filename: "x.png", content_type: "image/png", size_bytes: 68 });
    await cancelMediaUpload(aroha, abandoned.media_id);
    const [a] = await ownerQuery<{ status: string }>("select status from public.media_assets where id = $1", [abandoned.media_id]);
    expect(a.status).toBe("failed");
  }, 60_000);

  it("quotes, holds credits, renders and charges once", async () => {
    const w = createWorker(worker, { render: { resolutionScale: 0.2, preset: "ultrafast" } });
    // Analyse two demo clips so they can be rendered.
    const clips = d.media.filter((m) => m.org === "a").slice(0, 2);
    for (const c of clips) await requestAnalysis(aroha, c.id);
    while (await w.runOnce()) {}
    const sb = await submitStoryboard(aroha, {
      project_id: d.ids.projectA,
      title: "Restricted roles",
      format: "9:16",
      scenes: [{ duration_seconds: 2, asset_id: clips[0].id, on_screen_text: "Hello" }, { duration_seconds: 2, on_screen_text: "Book direct" }],
    });
    const before = (await getUsage(aroha)).video_credits.available;
    const q = await createVideo(aroha, { project_id: d.ids.projectA, storyboard_id: sb.storyboard_id });
    if (q.status !== "confirmation_required") throw new Error("expected a quote");
    const go = await createVideo(aroha, { project_id: d.ids.projectA, storyboard_id: sb.storyboard_id, confirm: true, quote_token: q.quote.quote_token });
    if (go.status !== "queued") throw new Error("expected queued");
    const done = await w.runOnce();
    expect(done?.status).toBe("succeeded");
    expect((await getRenderStatus(aroha, go.job.job_id)).exports).toHaveLength(1);
    expect((await getUsage(aroha)).video_credits.available).toBe(before - 1);
  }, 180_000);
});

/* Mission 6: the customer services added with migrations 1118 and 1119 also run as the restricted web role. */
describe("team, onboarding, tokens, billing and rollover work as reeldeal_web", () => {
  let aroha: Ctx;
  beforeAll(async () => {
    aroha = { ...(await ctxFor(d.tokens.aroha_owner_full)), principal: { ...(await ctxFor(d.tokens.aroha_owner_full)).principal, via: "session" } };
  });

  it("invites, accepts, changes a role, removes and revokes", async () => {
    const newcomer = randomUUID();
    const email = `invitee-${newcomer.slice(0, 8)}@example.test`;
    await ownerQuery("insert into auth.users (id, email, email_confirmed_at) values ($1, $2, now())", [newcomer, email]);
    // The seeded workspace already fills its Creator seats; lend it more for this test (restored below).
    await ownerQuery("update public.organisations set plan_id = 'agency' where id = $1", [d.ids.orgA]);
    const r = await inviteMembers(aroha, { emails: [email, `other-${newcomer.slice(0, 6)}@example.test`], role: "viewer" }, { acceptUrlBase: "http://localhost:3000" });
    expect(r.invitations.map((i) => i.error ?? "ok")).toEqual(["ok", "ok"]);
    const token = r.invitations[0]!.accept_url!.split("#")[1]!;
    expect((await acceptInvitation(web, newcomer, { token })).org_id).toBe(d.ids.orgA);
    await changeMemberRole(aroha, newcomer, "editor");
    const team = await getTeam(aroha);
    expect(team.members.find((m) => m.user_id === newcomer)?.role).toBe("editor");
    await removeMember(aroha, newcomer);
    await revokeInvitation(aroha, r.invitations[1]!.invitation_id!);
    expect((await getTeam(aroha)).invitations.some((i) => i.id === r.invitations[1]!.invitation_id)).toBe(false);
    await ownerQuery("update public.organisations set plan_id = 'creator' where id = $1", [d.ids.orgA]);
  });

  it("saves onboarding progress, preferences and workspace details", async () => {
    await saveOnboardingStep(aroha, "brand");
    expect((await getOnboardingState(web, d.ids.aroha, d.ids.orgA)).stage).toBe("setup");
    await savePreferences(web, d.ids.aroha, { mode: "studio", email_when_render_ready: false });
    await updateWorkspaceDetails(aroha, { location: "Queenstown", default_formats: ["9:16", "1:1"] });
    expect((await getWorkspaceSettings(aroha)).organisation.location).toBe("Queenstown");
  });

  it("creates and revokes a personal access token from the web session", async () => {
    const t = await createMyToken(aroha, { name: "Roles test", scopes: ["mcp:read"], expires_in_days: 7 });
    expect(t.token).toMatch(/^rdl_pat_/);
    await revokeMyToken(aroha, t.id);
    expect((await listMyTokens(aroha)).find((x) => x.id === t.id)?.status).toBe("revoked");
  });

  it("counts auth rate limits (private.rate_limit_hit and peek)", async () => {
    const who = { ip: "203.0.113.9", email: `limit-${randomUUID().slice(0, 6)}@example.test` };
    expect(await checkAuthRateLimit(web, "password_reset", who, "hit")).toEqual({ ok: true });
    expect(await checkAuthRateLimit(web, "sign_in", who, "peek")).toEqual({ ok: true });
    const [n] = await ownerQuery<{ n: number }>("select count(*)::int as n from private.rate_limits");
    expect(n.n).toBeGreaterThan(0);
  });

  it("reads the billing overview and closes finished months (rollover) on a later visit", async () => {
    const o = await getBillingOverview(aroha);
    expect(o.plan.id).toBe("creator");
    const later = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth() + 2, 15));
    await getUsage(aroha, later);
    const closes = await ownerQuery<{ period: string }>("select period from public.credit_period_closes where org_id = $1", [d.ids.orgA]);
    expect(closes.length).toBeGreaterThan(0);
  });
});

describe("what reeldeal_web cannot do", () => {
  it.each([
    ["change a plan", "update public.organisations set plan_id = 'agency'"],
    ["create a paid workspace", "insert into public.organisations (name, slug, plan_id) values ('x', 'x-paid', 'agency')"],
    ["add a member to an existing workspace", "insert into public.memberships (org_id, user_id, role) select id, (select id from auth.users limit 1), 'admin' from public.organisations limit 1"],
    ["change a role", "update public.memberships set role = 'owner'"],
    ["remove a member", "delete from public.memberships"],
    ["charge credits", "insert into public.credit_transactions (org_id, wallet, kind, amount, period) select id, 'video', 'charge', -1, '2026-11' from public.organisations limit 1"],
    ["grant itself credits as an adjustment", "insert into public.credit_transactions (org_id, wallet, kind, amount, period) select id, 'video', 'adjustment', 100, '2026-11' from public.organisations limit 1"],
    ["delete ledger rows", "delete from public.credit_transactions"],
    ["widen a token's scopes", "update public.api_tokens set scopes = array['mcp:render']"],
    ["write analysis results", "insert into public.media_analysis (org_id, media_id, technical) select org_id, id, '{}' from public.media_assets limit 1"],
    ["write exports", "insert into public.exports (org_id, project_id, job_id, format, status) select org_id, project_id, id, '9:16', 'ready' from public.jobs where project_id is not null limit 1"],
    ["mark media ready", "update public.media_assets set status = 'ready'"],
    ["mark a job succeeded", "update public.jobs set status = 'succeeded'"],
    ["change a storage key", "update public.media_assets set storage_key = 'x'"],
    ["read auth.users", "select email from auth.users"],
    ["read profiles directly", "select * from public.profiles"],
    ["edit brands directly", "update public.brand_profiles set name = 'x'"],
    ["read migration history", "select * from reeldeal_meta.migrations"],
    ["create a role", "create role sneaky"],
    ["truncate", "truncate public.jobs"],
  ])("cannot %s", async (_what, q) => {
    expect(await as("reeldeal_web", q)).toMatch(REFUSED);
  });
});

describe("what reeldeal_worker cannot do", () => {
  it.each([
    ["read tokens", "select token_hash from public.api_tokens"],
    ["read memberships", "select * from public.memberships"],
    ["read profiles", "select * from public.profiles"],
    ["read auth.users", "select email from auth.users"],
    ["grant credits", "insert into public.credit_transactions (org_id, wallet, kind, amount, period) select id, 'video', 'grant', 100, '2026-11' from public.organisations limit 1"],
    ["change a plan", "update public.organisations set plan_id = 'agency'"],
    ["queue jobs", "insert into public.jobs (org_id, kind, idempotency_key) select id, 'render', 'x' from public.organisations limit 1"],
    ["delete media", "delete from public.media_assets"],
    ["change a storage key", "update public.media_assets set storage_key = 'x'"],
    ["edit storyboards", "update public.storyboards set title = 'x'"],
    ["truncate", "truncate public.credit_transactions"],
  ])("cannot %s", async (_what, q) => {
    // "Cannot act as a signed-in user" is not checked here: SET ROLE is checked against the
    // login (session) user, so only a real login can test it (pg_has_role above, and the
    // real-login test below).
    expect(await as("reeldeal_worker", q)).toMatch(REFUSED);
  });
});

describe("reeldeal_meta", () => {
  it("has RLS on and no access for anon or signed-in users", async () => {
    const [r] = await ownerQuery<{ rls: boolean; anon: boolean; auth: boolean }>(
      `select c.relrowsecurity as rls, has_schema_privilege('anon', 'reeldeal_meta', 'USAGE') as anon, has_schema_privilege('authenticated', 'reeldeal_meta', 'USAGE') as auth
         from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'reeldeal_meta' and c.relname = 'migrations'`,
    );
    expect(r).toEqual({ rls: true, anon: false, auth: false });
  });
});

/* Real logins (supabase/postgres image or any real server): the web role can SET ROLE authenticated, the worker cannot. */
describe.skipIf(!serverEnv.TEST_DATABASE_URL)("real logins as the restricted roles", () => {
  const password = `test-only-${randomUUID()}`;
  let database = "";
  const login = (role: Role) => {
    const u = new URL(serverEnv.TEST_DATABASE_URL!);
    u.pathname = `/${database}`;
    u.username = role;
    u.password = password;
    return postgres(u.toString(), { max: 1, prepare: false, onnotice: () => {} });
  };
  beforeAll(async () => {
    database = (await ownerQuery<{ db: string }>("select current_database() as db"))[0].db;
    for (const r of ["reeldeal_web", "reeldeal_worker"]) await ownerQuery(`alter role ${r} with login password '${password}'`);
  });
  afterAll(async () => {
    for (const r of ["reeldeal_web", "reeldeal_worker"]) await ownerQuery(`alter role ${r} with nologin password null`);
  });

  it("reeldeal_web logs in and can act as a signed-in user under RLS", async () => {
    const c = login("reeldeal_web");
    try {
      const rows = await c.begin(async (tx) => {
        await tx.unsafe("set local role authenticated");
        await tx.unsafe("select set_config('request.jwt.claims', $1, true)", [claimsFor(d.ids.dev)]);
        return tx.unsafe("select id from public.organisations");
      });
      expect(rows.map((r) => r.id)).toEqual([d.ids.orgB]);
    } finally {
      await c.end();
    }
  });

  it("the production role guard accepts each restricted role for its own service only", async () => {
    const asDb = (role: Role) => {
      const u = new URL(serverEnv.TEST_DATABASE_URL!);
      u.pathname = `/${database}`;
      u.username = role;
      u.password = password;
      return createPostgresDb(u.toString(), { max: 1 });
    };
    const webDb = asDb("reeldeal_web");
    const workerDb = asDb("reeldeal_worker");
    try {
      expect((await checkDatabaseRole(webDb, "web")).ok).toBe(true);
      expect((await checkDatabaseRole(workerDb, "worker")).ok).toBe(true);
      expect((await checkDatabaseRole(webDb, "worker")).ok).toBe(false);
      expect((await checkDatabaseRole(workerDb, "web")).ok).toBe(false);
      // The owner bypasses RLS: refused for both services in production, allowed for admin scripts.
      const ownerCheck = await checkDatabaseRole(owner.db, "web");
      expect(ownerCheck).toMatchObject({ ok: false, bypassesRls: true });
      expect(ownerCheck.message).toMatch(/must connect as reeldeal_web/);
      await expect(enforceDatabaseRole(owner.db, "web", { production: true, mode: "enforce", warn: () => {} })).rejects.toThrow(/reeldeal_web/);
      const warned: string[] = [];
      await enforceDatabaseRole(owner.db, "worker", { production: true, mode: "warn", warn: (m) => warned.push(m) });
      expect(warned).toHaveLength(1);
      expect(await enforceDatabaseRole(owner.db, "web", { production: false, mode: "enforce", warn: () => {} })).toBeNull();
      expect((await checkDatabaseRole(owner.db, "admin")).ok).toBe(true);
    } finally {
      await webDb.close();
      await workerDb.close();
    }
  });

  it("reeldeal_worker logs in and cannot become authenticated", async () => {
    const c = login("reeldeal_worker");
    try {
      const err = await c.unsafe("set role authenticated").then(() => "ALLOWED", (e: Error) => e.message);
      expect(err).toMatch(/permission denied/);
    } finally {
      await c.end();
    }
  });
});
