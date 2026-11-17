import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { SCOPES, type MemberRole } from "../auth/principal";
import type { Ctx, Platform } from "../context";
import type { AppError } from "../errors";
import type { DemoData } from "../seed";
import { createTestPlatform } from "../testing";
import { createWorkspace } from "./account";
import { getBillingOverview, getUsageHistory } from "./billing";
import { createBrand } from "./brands";
import { inviteMembers } from "./team";
import { getOnboardingState, getPreferences, getWorkspaceSettings, saveOnboardingStep, savePreferences, setWorkspaceKind, updateWorkspaceDetails } from "./workspace-settings";

/*
  Backend for the Stage 3 screens: workspace settings, onboarding progress, preferences and
  usage/billing. Real data only, under RLS, as real users. Needs migration 20261118000001.
*/
let t: Awaited<ReturnType<typeof createTestPlatform>>;
let p: Platform;
let d: DemoData;
const code = async (pr: Promise<unknown>) => ((await pr.then(() => null, (e) => e)) as AppError | null)?.code ?? "ok";
const ctx = (userId: string, orgId: string, role: MemberRole): Ctx => t.ctxAs({ userId, orgId, role, scopes: [...SCOPES], via: "session" });
const sys = <T>(q: string, params: unknown[] = []) => p.db.system((sql) => sql.query<T & Record<string, unknown>>(q, params));
async function newUser(email: string) {
  const id = randomUUID();
  await sys("insert into auth.users (id, email) values ($1, $2)", [id, email]);
  return id;
}

beforeAll(async () => {
  t = await createTestPlatform({ seed: true, clips: 1 });
  p = t.p;
  d = t.demo;
}, 120_000);
afterAll(async () => p?.db.close());

describe("workspace settings", () => {
  it("members read their own workspace only", async () => {
    const s = await getWorkspaceSettings(ctx(d.ids.cleo, d.ids.orgA, "viewer"));
    expect(s.organisation.name).toBe("Lakeside Lodge");
    expect(s.owner?.email).toBe("aroha@lakeside.example");
    expect(s.brands.default?.name).toBe("Lakeside Lodge");
    expect(await code(getWorkspaceSettings(ctx(d.ids.cleo, d.ids.orgB, "owner")))).toBe("not_found");
  });

  it("administrators edit business details; editors and viewers can't, whatever the session claims", async () => {
    await updateWorkspaceDetails(ctx(d.ids.aroha, d.ids.orgA, "owner"), { legal_name: "Lakeside Lodge Ltd", industry: "Accommodation", website: "lakeside.example", default_formats: ["9:16", "1:1"] });
    const s = await getWorkspaceSettings(ctx(d.ids.aroha, d.ids.orgA, "owner"));
    expect(s.organisation).toMatchObject({ legal_name: "Lakeside Lodge Ltd", website: "https://lakeside.example", default_formats: ["9:16", "1:1"] });
    expect(await code(updateWorkspaceDetails(ctx(d.ids.ben, d.ids.orgA, "editor"), { phone: "123" }))).toBe("forbidden");
    expect(await code(updateWorkspaceDetails(ctx(d.ids.ben, d.ids.orgA, "admin"), { phone: "12345" }))).toBe("forbidden"); // RLS: the real role
    expect(await code(updateWorkspaceDetails(ctx(d.ids.aroha, d.ids.orgB, "admin"), { phone: "12345" }))).toBe("forbidden"); // another org
    expect(await code(updateWorkspaceDetails(ctx(d.ids.aroha, d.ids.orgA, "owner"), { website: "javascript:alert(1)" }))).toBe("invalid_input");
  });

  it("nobody can change the plan, credits or billing record from the client side", async () => {
    const direct = (q: string) => p.db.asUser(d.ids.aroha, (sql) => sql.query(q)).then(() => "ALLOWED", (e: Error) => e.message);
    expect(await direct(`update public.organisations set plan_id = 'agency' where id = '${d.ids.orgA}'`)).toMatch(/permission denied/);
    expect(await direct(`insert into public.credit_transactions (org_id, wallet, kind, amount, period) values ('${d.ids.orgA}', 'video', 'grant', 1000, '2026-11')`)).toMatch(/permission denied/);
    expect(await direct(`insert into public.billing_accounts (org_id, subscription_status) values ('${d.ids.orgA}', 'active')`)).toMatch(/permission denied/);
    expect(await direct(`update public.billing_accounts set plan_id = 'agency'`)).toMatch(/permission denied/);
  });
});

describe("usage and billing", () => {
  it("shows the real plan and ledger; billing unavailable without a subscription record", async () => {
    const o = await getBillingOverview(ctx(d.ids.aroha, d.ids.orgA, "owner"));
    expect(o.plan).toMatchObject({ id: "creator", name: "Creator", seats: 2 });
    expect(o.billing.available).toBe(false);
    expect(o.usage.video_credits.allowance).toBe(20);
    expect(o.usage.video_credits.available).toBe(20); // the monthly grant, from the ledger
    expect(o.usage.brand_profiles).toBe(1);
    const h = await getUsageHistory(ctx(d.ids.aroha, d.ids.orgA, "owner"));
    expect(h.entries[0]).toMatchObject({ wallet: "video", kind: "grant", amount: 20 });
  });

  it("only the owner sees subscription details once billing exists", async () => {
    await sys("insert into public.billing_accounts (org_id, subscription_status, plan_id, billing_interval, current_period_end, billing_email) values ($1, 'active', 'creator', 'monthly', now() + interval '20 days', 'accounts@lakeside.example')", [d.ids.orgA]);
    const owner = await getBillingOverview(ctx(d.ids.aroha, d.ids.orgA, "owner"));
    expect(owner.billing).toMatchObject({ available: true, status: "active", interval: "monthly", billing_email: "accounts@lakeside.example" });
    const editor = await getBillingOverview(ctx(d.ids.ben, d.ids.orgA, "editor"));
    expect(editor.billing).toEqual({ available: false, reason: "Only the workspace owner sees subscription and payment details." });
    const other = await getBillingOverview(ctx(d.ids.dev, d.ids.orgB, "owner"));
    expect(other.billing.available).toBe(false); // another org's record is invisible
  });

  it("pages through history and filters by wallet", async () => {
    for (let i = 0; i < 5; i++) await sys("insert into public.credit_transactions (org_id, wallet, kind, amount, period, note) values ($1, 'analysis', 'charge', -1, to_char(now(), 'YYYY-MM'), $2)", [d.ids.orgB, `clip ${i}`]);
    const c = ctx(d.ids.dev, d.ids.orgB, "owner");
    const first = await getUsageHistory(c, { wallet: "analysis", limit: 3 });
    expect(first.entries).toHaveLength(3);
    expect(first.entries.every((e) => e.wallet === "analysis")).toBe(true);
    expect(first.next_before).not.toBeNull();
    const rest = await getUsageHistory(c, { wallet: "analysis", limit: 3, before: first.next_before! });
    expect(rest.entries.length).toBeGreaterThan(0);
    expect((await getUsageHistory(ctx(d.ids.aroha, d.ids.orgA, "owner"), { wallet: "analysis" })).entries.some((e) => e.note?.startsWith("clip"))).toBe(false);
  });
});

describe("onboarding progress", () => {
  it("a new confirmed account starts at workspace creation; one with an invitation is offered to join", async () => {
    const fresh = await newUser("fresh@example.test");
    expect((await getOnboardingState(p, fresh)).stage).toBe("workspace");
    await inviteMembers(ctx(d.ids.aroha, d.ids.orgA, "owner"), { emails: ["invited.person@example.test"], role: "viewer" }, { acceptUrlBase: "https://x" }).catch(() => null);
    await sys("update public.organisations set plan_id = 'agency' where id = $1", [d.ids.orgA]);
    await inviteMembers(ctx(d.ids.aroha, d.ids.orgA, "owner"), { emails: ["invited.person@example.test"], role: "viewer" }, { acceptUrlBase: "https://x" });
    const invited = await newUser("invited.person@example.test");
    const s = await getOnboardingState(p, invited);
    expect(s.stage).toBe("invited");
    expect(s.invitations.map((i) => i.org_name)).toEqual(["Lakeside Lodge"]);
  });

  it("resumes where the owner left off after signing out, and only the owner is asked", async () => {
    const owner = await newUser("resume@example.test");
    const { org_id } = await createWorkspace(p, owner, { business_name: "Resume Tours", industry: "Tours and activities" });
    const c = ctx(owner, org_id, "owner");
    await setWorkspaceKind(c, "client");
    expect(await getOnboardingState(p, owner)).toMatchObject({ stage: "setup", next_step: "brand" });
    await saveOnboardingStep(c, "brand");
    // "Sign out and back in": state comes from the database, not the browser.
    expect(await getOnboardingState(p, owner)).toMatchObject({ stage: "setup", next_step: "assets" });
    await saveOnboardingStep(c, "brand"); // going back never loses progress
    expect((await getOnboardingState(p, owner)).next_step).toBe("assets");
    await saveOnboardingStep(c, "done"); // skip the rest
    expect((await getOnboardingState(p, owner)).stage).toBe("complete");
    const [org] = await sys<{ workspace_kind: string }>("select workspace_kind from public.organisations where id = $1", [org_id]);
    expect(org.workspace_kind).toBe("client");
    // A member who joined by invitation never sees owner setup.
    expect((await getOnboardingState(p, d.ids.ben)).stage).toBe("complete");
    expect(await code(saveOnboardingStep(ctx(d.ids.ben, d.ids.orgA, "editor"), "done"))).toBe("forbidden");
  });

  it("repeated or simultaneous submissions create one workspace", async () => {
    const u = await newUser("double-click@example.test");
    const runs = await Promise.all(Array.from({ length: 5 }, () => createWorkspace(p, u, { business_name: "Double Click Café", industry: "Food and drink" }).catch((e) => e)));
    const ids = new Set(runs.filter((r) => r && "org_id" in r).map((r) => r.org_id));
    expect(ids.size).toBe(1);
    const [{ n }] = await sys<{ n: number }>("select count(*)::int as n from public.memberships where user_id = $1", [u]);
    expect(n).toBe(1);
    const [{ b }] = await sys<{ b: number }>("select count(*)::int as b from public.brand_profiles where org_id = $1", [[...ids][0]]);
    expect(b).toBe(1);
  });
});

describe("plan limits under concurrency", () => {
  it("simultaneous brand creation can't exceed the plan's brand limit", async () => {
    // Harbour Café is on Starter (1 brand profile). Remove its brand, then race three creations.
    await sys("delete from public.brand_profiles where org_id = $1", [d.ids.orgB]);
    const c = ctx(d.ids.dev, d.ids.orgB, "owner");
    const results = await Promise.all([1, 2, 3].map((n) => createBrand(c, { name: `Race ${n}` }).then(() => "created", (e: AppError) => e.code)));
    expect(results.filter((r) => r === "created")).toHaveLength(1);
    expect(results.filter((r) => r === "conflict")).toHaveLength(2);
    const [{ n }] = await sys<{ n: number }>("select count(*)::int as n from public.brand_profiles where org_id = $1", [d.ids.orgB]);
    expect(n).toBe(1);
  });
});

describe("preferences", () => {
  it("are personal: saved for the signed-in person only", async () => {
    expect(await getPreferences(p, d.ids.ben)).toMatchObject({ palette: "crossroads", mode: "workspace" });
    await savePreferences(p, d.ids.ben, { mode: "studio", email_when_render_ready: false });
    expect(await getPreferences(p, d.ids.ben)).toMatchObject({ mode: "studio", email_when_render_ready: false });
    expect(await getPreferences(p, d.ids.cleo)).toMatchObject({ mode: "workspace" });
    expect(await code(savePreferences(p, d.ids.ben, { mode: "neon" as never }))).toBe("invalid_input");
    const [{ n }] = await sys<{ n: number }>("select count(*)::int as n from public.user_preferences");
    expect(n).toBe(1);
    const leak = await p.db.asUser(d.ids.cleo, (sql) => sql.query("select * from public.user_preferences"));
    expect(leak).toEqual([]);
  });
});
