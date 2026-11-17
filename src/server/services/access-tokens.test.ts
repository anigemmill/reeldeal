import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createAccessToken, hashToken, MAX_ACTIVE_TOKENS, verifyAccessToken } from "../auth/tokens";
import { SCOPES, type MemberRole } from "../auth/principal";
import type { Ctx, Platform } from "../context";
import type { AppError } from "../errors";
import type { DemoData } from "../seed";
import { createTestPlatform } from "../testing";
import { createMyToken, listMyTokens, revokeMyToken } from "./access-tokens";

/* Settings → Access tokens: the service behind the screen, run as real users under RLS. */
let t: Awaited<ReturnType<typeof createTestPlatform>>;
let p: Platform;
let d: DemoData;
const code = async (pr: Promise<unknown>) => ((await pr.then(() => null, (e) => e)) as AppError | null)?.code ?? "ok";
const ctx = (userId: string, orgId: string, role: MemberRole, via: "session" | "pat" = "session"): Ctx => t.ctxAs({ userId, orgId, role, scopes: [...SCOPES], via });
const sys = <T>(q: string, params: unknown[] = []) => p.db.system((sql) => sql.query<T & Record<string, unknown>>(q, params));

beforeAll(async () => {
  t = await createTestPlatform({ seed: true, clips: 1 });
  p = t.p;
  d = t.demo;
}, 120_000);
afterAll(async () => p?.db.close());

describe("access tokens", () => {
  it("creates a token shown once: stored as a hash, bound to the workspace, read scope always included", async () => {
    const c = ctx(d.ids.ben, d.ids.orgA, "editor");
    const r = await createMyToken(c, { name: "Claude Desktop", scopes: ["mcp:write"], expires_in_days: 30 });
    expect(r.token).toMatch(/^rdl_pat_[A-Za-z0-9_-]{43}$/);
    expect(r.scopes).toEqual(["mcp:read", "mcp:write"]);
    expect(r.environment).toBe("development");
    const [row] = await sys<{ token_hash: string; org_id: string; environment: string }>("select token_hash, org_id, environment from public.api_tokens where id = $1", [r.id]);
    expect(row).toEqual({ token_hash: hashToken(r.token), org_id: d.ids.orgA, environment: "development" });
    const listed = await listMyTokens(c);
    expect(listed.find((x) => x.id === r.id)).toMatchObject({ name: "Claude Desktop", prefix: r.token.slice(0, 12), status: "active" });
    expect(JSON.stringify(listed)).not.toContain(r.token);
    expect(JSON.stringify(listed)).not.toContain(row.token_hash);
    const principal = await verifyAccessToken(p.db, r.token);
    expect(principal).toMatchObject({ userId: d.ids.ben, orgId: d.ids.orgA, role: "editor", via: "pat" });
  });

  it("requires an expiry from the allowed list and a name", async () => {
    const c = ctx(d.ids.ben, d.ids.orgA, "editor");
    expect(await code(createMyToken(c, { name: "x", scopes: ["mcp:read"], expires_in_days: 0 as never }))).toBe("invalid_input");
    expect(await code(createMyToken(c, { name: "x", scopes: ["mcp:read"], expires_in_days: 3650 as never }))).toBe("invalid_input");
    expect(await code(createMyToken(c, { name: " ", scopes: ["mcp:read"], expires_in_days: 7 }))).toBe("invalid_input");
  });

  it("viewers get read-only tokens, even if the session believes they are editors", async () => {
    expect(await code(createMyToken(ctx(d.ids.cleo, d.ids.orgA, "editor"), { name: "x", scopes: ["mcp:render"], expires_in_days: 7 }))).toBe("invalid_input");
    const ok = await createMyToken(ctx(d.ids.cleo, d.ids.orgA, "viewer"), { name: "read", scopes: ["mcp:read"], expires_in_days: 7 });
    expect(ok.scopes).toEqual(["mcp:read"]);
  });

  it("a token can't create tokens (no escalation from an MCP connection)", async () => {
    expect(await code(createMyToken(ctx(d.ids.ben, d.ids.orgA, "editor", "pat"), { name: "x", scopes: ["mcp:read"], expires_in_days: 7 }))).toBe("forbidden");
  });

  it("people see and revoke only their own tokens, in this workspace", async () => {
    const mine = await createMyToken(ctx(d.ids.aroha, d.ids.orgA, "owner"), { name: "owner's", scopes: ["mcp:read"], expires_in_days: 7 });
    expect((await listMyTokens(ctx(d.ids.ben, d.ids.orgA, "editor"))).some((x) => x.id === mine.id)).toBe(false);
    expect(await code(revokeMyToken(ctx(d.ids.ben, d.ids.orgA, "editor"), mine.id))).toBe("not_found");
    expect(await code(revokeMyToken(ctx(d.ids.dev, d.ids.orgB, "owner"), mine.id))).toBe("not_found");
    expect((await verifyAccessToken(p.db, mine.token)).userId).toBe(d.ids.aroha);
    // Nobody can widen scopes, change the workspace or read hashes through the database.
    const direct = (q: string) => p.db.asUser(d.ids.aroha, (sql) => sql.query(q)).then(() => "ALLOWED", (e: Error) => e.message);
    expect(await direct(`update public.api_tokens set scopes = array['mcp:render'] where id = '${mine.id}'`)).toMatch(/permission denied/);
    expect(await direct(`update public.api_tokens set environment = 'production' where id = '${mine.id}'`)).toMatch(/permission denied/);
    expect(await direct("select token_hash from public.api_tokens")).toMatch(/permission denied/);
  });

  it("revoked tokens stop working at once; revoking twice is harmless", async () => {
    const c = ctx(d.ids.aroha, d.ids.orgA, "owner");
    const r = await createMyToken(c, { name: "to revoke", scopes: ["mcp:read"], expires_in_days: 7 });
    await revokeMyToken(c, r.id);
    expect(await code(verifyAccessToken(p.db, r.token))).toBe("unauthenticated");
    await revokeMyToken(c, r.id);
    expect((await listMyTokens(c)).find((x) => x.id === r.id)?.status).toBe("revoked");
  });

  it("expired tokens stop working and show as expired", async () => {
    const c = ctx(d.ids.aroha, d.ids.orgA, "owner");
    const r = await createMyToken(c, { name: "short", scopes: ["mcp:read"], expires_in_days: 7 });
    await sys("update public.api_tokens set expires_at = now() - interval '1 second' where id = $1", [r.id]);
    expect(await code(verifyAccessToken(p.db, r.token))).toBe("unauthenticated");
    expect((await listMyTokens(c)).find((x) => x.id === r.id)?.status).toBe("expired");
  });

  it("a development token is refused by production, and the other way round", async () => {
    const dev = await createAccessToken(p.db, { userId: d.ids.aroha, orgId: d.ids.orgA, name: "dev", environment: "development", expiresInDays: 7 });
    const prod = await createAccessToken(p.db, { userId: d.ids.aroha, orgId: d.ids.orgA, name: "prod", environment: "production", expiresInDays: 7 });
    expect(await code(verifyAccessToken(p.db, dev.token, "production"))).toBe("unauthenticated");
    expect((await verifyAccessToken(p.db, prod.token, "production")).orgId).toBe(d.ids.orgA);
    expect(await code(verifyAccessToken(p.db, prod.token, "development"))).toBe("unauthenticated");
    expect(await code(verifyAccessToken(p.db, prod.token))).toBe("unauthenticated"); // tests run as development
  });

  it("caps active tokens per person and workspace", async () => {
    const c = ctx(d.ids.dev, d.ids.orgB, "owner");
    const existing = (await listMyTokens(c)).filter((x) => x.status === "active").length; // the demo data already has one
    for (let i = existing; i < MAX_ACTIVE_TOKENS; i++) await createMyToken(c, { name: `t${i}`, scopes: ["mcp:read"], expires_in_days: 7 });
    expect((await listMyTokens(c)).filter((x) => x.status === "active").length).toBe(MAX_ACTIVE_TOKENS);
    expect(await code(createMyToken(c, { name: "one more", scopes: ["mcp:read"], expires_in_days: 7 }))).toBe("conflict");
  });

  it("a member's tokens die with their membership", async () => {
    const r = await createMyToken(ctx(d.ids.cleo, d.ids.orgA, "viewer"), { name: "cleo", scopes: ["mcp:read"], expires_in_days: 7 });
    await sys("delete from public.memberships where org_id = $1 and user_id = $2", [d.ids.orgA, d.ids.cleo]);
    expect(await code(verifyAccessToken(p.db, r.token))).toBe("unauthenticated");
    expect((await sys("select 1 from public.api_tokens where id = $1", [r.id])).length).toBe(0);
  });
});
