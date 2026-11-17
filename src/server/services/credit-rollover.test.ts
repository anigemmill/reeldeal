import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { SCOPES } from "../auth/principal";
import type { Ctx, Platform } from "../context";
import { createTestPlatform } from "../testing";
import { availableVideoCredits, ensureGrant, getUsage, nextPeriod } from "./usage";

/*
  Video-credit rollover (config/pricing.json: one billing cycle, capped at one month's allocation,
  oldest first). Needs migration 20261119000001. Periods are calendar months (UTC) until Stripe
  billing anchors exist. Starter = 5 credits a month, Creator = 20, Free = 2 once.
*/
let t: Awaited<ReturnType<typeof createTestPlatform>>;
let p: Platform;
const sys = <T>(q: string, params: unknown[] = []) => p.db.system((sql) => sql.query<T & Record<string, unknown>>(q, params));

async function newOrg(plan: string) {
  const orgId = randomUUID();
  const userId = randomUUID();
  await sys("insert into auth.users (id, email) values ($1, $2)", [userId, `${userId}@rollover.example`]);
  await sys("insert into public.organisations (id, name, slug, plan_id) values ($1, 'Rollover test', $2, $3)", [orgId, `ro-${orgId.slice(0, 8)}`, plan]);
  await sys("insert into public.memberships (org_id, user_id, role) values ($1, $2, 'owner')", [orgId, userId]);
  const ctx: Ctx = t.ctxAs({ userId, orgId, role: "owner", scopes: [...SCOPES], via: "session" });
  return { orgId, ctx };
}
const grant = (orgId: string, period: string) => p.db.system((sql) => ensureGrant(sql, orgId, period));
const spend = (orgId: string, period: string, n: number) =>
  sys("insert into public.credit_transactions (org_id, wallet, kind, amount, period, note) values ($1, 'video', 'charge', $2, $3, 'test render')", [orgId, -n, period]);
const balance = (orgId: string, plan: string, period: string) => p.db.system((sql) => availableVideoCredits(sql, orgId, plan, period));
const rows = (orgId: string) =>
  sys<{ kind: string; amount: number; period: string }>("select kind, amount, period from public.credit_transactions where org_id = $1 order by period, kind, amount", [orgId]);

beforeAll(async () => {
  t = await createTestPlatform({ seed: false });
  p = t.p;
}, 120_000);
afterAll(async () => p?.db.close());

describe("credit rollover", () => {
  it("month arithmetic crosses the year", () => {
    expect(nextPeriod("2026-11")).toBe("2026-12");
    expect(nextPeriod("2026-12")).toBe("2027-01");
  });

  it("unused credits carry into the next month, and a closed month nets to zero", async () => {
    const { orgId } = await newOrg("starter");
    await grant(orgId, "2026-10");
    await spend(orgId, "2026-10", 2); // 3 left
    await grant(orgId, "2026-11");
    expect(await balance(orgId, "starter", "2026-11")).toBe(8); // 5 new + 3 carried
    expect(await balance(orgId, "starter", "2026-10")).toBe(0);
    const [close] = await sys<{ balance: number; carried: number; expired: number }>("select balance, carried, expired from public.credit_period_closes where org_id = $1 and period = '2026-10'", [orgId]);
    expect(close).toMatchObject({ balance: 3, carried: 3, expired: 0 });
  });

  it("carried credits are spent first and expire after one month (never roll twice)", async () => {
    const { orgId } = await newOrg("starter");
    await grant(orgId, "2026-09"); // 5, none spent
    await grant(orgId, "2026-10"); // 5 + 5 carried = 10
    await spend(orgId, "2026-10", 4); // oldest first: 4 of the carried 5 used, 1 carried + 5 new left
    await grant(orgId, "2026-11");
    // October's own 5 carry; the 1 left from September expires.
    expect(await balance(orgId, "starter", "2026-11")).toBe(10);
    const [oct] = await sys<{ carried: number; expired: number }>("select carried, expired from public.credit_period_closes where org_id = $1 and period = '2026-10'", [orgId]);
    expect(oct).toMatchObject({ carried: 5, expired: 1 });
  });

  it("carry is capped at one month's allocation of the current plan (downgrade)", async () => {
    const { orgId } = await newOrg("creator");
    await grant(orgId, "2026-10"); // 20 unspent
    await sys("update public.organisations set plan_id = 'starter' where id = $1", [orgId]);
    await grant(orgId, "2026-11");
    expect(await balance(orgId, "starter", "2026-11")).toBe(10); // 5 new + 5 carried (cap), 15 expired
    const expiry = (await rows(orgId)).find((r) => r.kind === "expiry");
    expect(expiry).toMatchObject({ amount: -15, period: "2026-10" });
  });

  it("a skipped month: carried credits expire, nothing jumps two months", async () => {
    const { orgId } = await newOrg("starter");
    await grant(orgId, "2026-08"); // 5 unspent; nobody opens the app in September
    await grant(orgId, "2026-10");
    // August's 5 carried into September, which had no grant of its own, so they expired there.
    expect(await balance(orgId, "starter", "2026-10")).toBe(5);
    const closes = await sys<{ period: string; carried: number; expired: number }>("select period, carried, expired from public.credit_period_closes where org_id = $1 order by period", [orgId]);
    expect(closes).toEqual([
      { period: "2026-08", carried: 5, expired: 0 },
      { period: "2026-09", carried: 0, expired: 5 },
    ]);
  });

  it("repeated and concurrent processing never doubles a grant or a rollover", async () => {
    const { orgId } = await newOrg("starter");
    await grant(orgId, "2026-10");
    await Promise.all(Array.from({ length: 6 }, () => grant(orgId, "2026-11")));
    await grant(orgId, "2026-11");
    expect(await balance(orgId, "starter", "2026-11")).toBe(10);
    const r = await rows(orgId);
    expect(r.filter((x) => x.kind === "grant")).toHaveLength(2);
    expect(r.filter((x) => x.kind === "rollover")).toHaveLength(2); // one out, one in
    // The database refuses a second carry into the same month, even written by hand.
    const dup = await sys("insert into public.credit_transactions (org_id, wallet, kind, amount, period) values ($1, 'video', 'rollover', 5, '2026-11')", [orgId]).then(() => "ALLOWED", (e: Error) => e.message);
    expect(dup).toMatch(/unique|duplicate/i);
  });

  it("an overspent or empty month carries nothing and records no zero rows", async () => {
    const { orgId } = await newOrg("starter");
    await grant(orgId, "2026-10");
    await spend(orgId, "2026-10", 5);
    await grant(orgId, "2026-11");
    expect(await balance(orgId, "starter", "2026-11")).toBe(5);
    expect((await rows(orgId)).filter((x) => x.kind === "rollover" || x.kind === "expiry")).toHaveLength(0);
  });

  it("a hold placed last month and settled this month is counted once", async () => {
    const { orgId, ctx } = await newOrg("starter");
    const jobId = randomUUID();
    await sys("insert into public.jobs (id, org_id, kind, status, idempotency_key, input) values ($1, $2, 'render', 'running', $3, '{}')", [jobId, orgId, `t:${jobId}`]);
    await grant(orgId, "2026-10");
    await sys("insert into public.credit_transactions (org_id, wallet, kind, amount, period, job_id) values ($1, 'video', 'hold', -2, '2026-10', $2)", [orgId, jobId]);
    const now = new Date("2026-11-03T10:00:00Z");
    const before = await getUsage(ctx, now);
    expect(before.video_credits).toMatchObject({ available: 8, held_for_renders_in_progress: 2, carried_over: 3 }); // 5 + (5 - 2 held)
    // The render finishes in November: release and charge land in November and cancel out.
    await sys("insert into public.credit_transactions (org_id, wallet, kind, amount, period, job_id) values ($1, 'video', 'release', 2, '2026-11', $2), ($1, 'video', 'charge', -2, '2026-11', $2)", [orgId, jobId]);
    const after = await getUsage(ctx, now);
    expect(after.video_credits).toMatchObject({ available: 8, held_for_renders_in_progress: 0, used: 2 });
  });

  it("shows what carries forward and what will expire this month", async () => {
    const { orgId, ctx } = await newOrg("starter");
    await grant(orgId, "2026-10"); // 5 carry into November
    const u = await getUsage(ctx, new Date("2026-11-20T00:00:00Z"));
    expect(u.video_credits).toMatchObject({ available: 10, carried_over: 5, carries_forward_if_unused: 5, expires_at_period_end: 5 });
  });

  it("insufficient balance: carried credits count, but no more than the ledger holds", async () => {
    const { orgId } = await newOrg("starter");
    await grant(orgId, "2026-10");
    await spend(orgId, "2026-10", 5);
    await grant(orgId, "2026-11");
    await spend(orgId, "2026-11", 4);
    expect(await balance(orgId, "starter", "2026-11")).toBe(1);
  });

  it("one-off allowances (Free) never roll over or expire", async () => {
    const { orgId } = await newOrg("free");
    await grant(orgId, "2026-10");
    await grant(orgId, "2026-11");
    expect(await balance(orgId, "free", "2026-11")).toBe(2);
    expect((await rows(orgId)).map((r) => r.kind)).toEqual(["grant"]);
  });

  it("members can read their close history; nobody can write ledger rows from the client side", async () => {
    const { orgId, ctx } = await newOrg("starter");
    await grant(orgId, "2026-10");
    await grant(orgId, "2026-11");
    const mine = await p.db.asUser(ctx.principal.userId, (sql) => sql.query("select period from public.credit_period_closes where org_id = $1", [orgId]));
    expect(mine).toHaveLength(1);
    const other = await newOrg("starter");
    const theirs = await p.db.asUser(other.ctx.principal.userId, (sql) => sql.query("select period from public.credit_period_closes where org_id = $1", [orgId]));
    expect(theirs).toHaveLength(0);
    const write = await p.db
      .asUser(ctx.principal.userId, (sql) => sql.query("insert into public.credit_transactions (org_id, wallet, kind, amount, period) values ($1, 'video', 'rollover', 50, '2026-12')", [orgId]))
      .then(() => "ALLOWED", (e: Error) => e.message);
    expect(write).toMatch(/permission denied/);
  });
});
