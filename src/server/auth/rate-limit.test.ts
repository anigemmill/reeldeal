import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Platform } from "../context";
import { createTestPlatform } from "../testing";
import { AUTH_LIMITS, checkAuthRateLimit, clientIp, keyFor } from "./rate-limit";

/* App-side auth rate limits (migration 20261118000001, private.rate_limit_hit). */
let p: Platform;
beforeAll(async () => {
  p = (await createTestPlatform({ seed: false })).p;
}, 60_000);
afterAll(async () => p?.db.close());

const hit = (action: Parameters<typeof checkAuthRateLimit>[1], ip: string | null, email?: string) => checkAuthRateLimit(p, action, { ip, email });

describe("auth rate limits", () => {
  it("limits sign-in attempts per account, whatever IP they come from", async () => {
    const [max] = AUTH_LIMITS.sign_in.email;
    for (let i = 0; i < max; i++) expect((await hit("sign_in", `203.0.113.${i}`, "victim@example.test")).ok).toBe(true);
    expect(await hit("sign_in", "198.51.100.7", "victim@example.test")).toEqual({ ok: false, reason: "email" });
    // Other accounts are unaffected.
    expect((await hit("sign_in", "198.51.100.7", "someone.else@example.test")).ok).toBe(true);
  });

  it("limits one visitor IP across many accounts (credential stuffing), not every customer", async () => {
    const [max] = AUTH_LIMITS.sign_in.ip;
    for (let i = 0; i < max; i++) expect((await hit("sign_in", "192.0.2.50", `user${i}@example.test`)).ok).toBe(true);
    expect(await hit("sign_in", "192.0.2.50", "user-next@example.test")).toEqual({ ok: false, reason: "ip" });
    expect((await hit("sign_in", "192.0.2.51", "user-next@example.test")).ok).toBe(true); // a different visitor is fine
  });

  it("keeps actions separate and resets after the window", async () => {
    const [max] = AUTH_LIMITS.password_reset.email;
    for (let i = 0; i < max; i++) await hit("password_reset", null, "reset-me@example.test");
    expect((await hit("password_reset", null, "reset-me@example.test")).ok).toBe(false);
    expect((await hit("sign_in", null, "reset-me@example.test")).ok).toBe(true);
    await p.db.system((sql) => sql.query("update private.rate_limits set window_start = now() - interval '2 hours' where key = $1", [keyFor(p.signingSecret, "password_reset", "email", "reset-me@example.test")]));
    expect((await hit("password_reset", null, "reset-me@example.test")).ok).toBe(true);
  });

  it("stores neither emails nor IP addresses, only keyed hashes", async () => {
    const rows = await p.db.system((sql) => sql.query<{ key: string }>("select key from private.rate_limits"));
    const all = rows.map((r) => r.key).join(" ");
    expect(all).not.toMatch(/@|example\.test|192\.0\.2|203\.0\.113/);
    expect(keyFor("secret-a", "sign_in", "email", "A@Example.test")).toBe(keyFor("secret-a", "sign_in", "email", " a@example.test "));
    expect(keyFor("secret-a", "sign_in", "email", "a@example.test")).not.toBe(keyFor("secret-b", "sign_in", "email", "a@example.test"));
  });

  it("skips the per-IP check for loopback (local development), still limits per email", async () => {
    const [ipMax] = AUTH_LIMITS.sign_up.ip;
    for (let i = 0; i < ipMax + 5; i++) expect((await hit("sign_up", "127.0.0.1", `local${i}@example.test`)).ok).toBe(true);
    const [emailMax] = AUTH_LIMITS.sign_up.email;
    for (let i = 0; i < emailMax; i++) await hit("sign_up", "::1", "same@example.test");
    expect((await hit("sign_up", "::1", "same@example.test")).ok).toBe(false);
  });

  it("fails open (Supabase's own limits remain) if the database can't be reached", async () => {
    const broken: Platform = { ...p, db: { ...p.db, system: async () => Promise.reject(new Error("connection refused")) }, log: { ...p.log, warn: () => {} } };
    expect(await checkAuthRateLimit(broken, "sign_in", { ip: "203.0.113.9", email: "x@example.test" })).toEqual({ ok: true });
  });

  it("reads the visitor IP from the platform's headers", () => {
    const h = (o: Record<string, string>) => ({ get: (k: string) => o[k] ?? null });
    expect(clientIp(h({ "x-real-ip": "203.0.113.4", "x-forwarded-for": "1.1.1.1" }))).toBe("203.0.113.4");
    expect(clientIp(h({ "x-forwarded-for": "198.51.100.2, 10.0.0.1" }))).toBe("198.51.100.2");
    expect(clientIp(h({}))).toBeNull();
  });

  it("users and anon can't touch the counters", async () => {
    const [r] = await p.db.system((sql) =>
      sql.query<{ a: boolean; b: boolean }>("select has_table_privilege('authenticated', 'private.rate_limits', 'select') as a, has_function_privilege('anon', 'private.rate_limit_hit(text, int, int)', 'execute') as b"),
    );
    expect(r).toEqual({ a: false, b: false });
  });
});

describe("abuse scenarios (sign-in counts failures only)", () => {
  const peek = (ip: string | null, email: string) => checkAuthRateLimit(p, "sign_in", { ip, email }, "peek");
  const fail = (ip: string | null, email: string) => checkAuthRateLimit(p, "sign_in", { ip, email }, "fail");

  it("a shared office IP: 200 successful sign-ins in a row are never slowed", async () => {
    for (let i = 0; i < 200; i++) expect((await peek("203.0.113.200", `staff${i % 40}@office.example`)).ok).toBe(true);
  });

  it("…and a few colleagues mistyping passwords don't lock the office out", async () => {
    for (let i = 0; i < 12; i++) await fail("203.0.113.201", `typo${i}@office.example`);
    expect((await peek("203.0.113.201", "careful@office.example")).ok).toBe(true);
  });

  it("repeated failed sign-ins on one account are stopped, from any IP", async () => {
    const [max] = AUTH_LIMITS.sign_in.email;
    for (let i = 0; i < max; i++) {
      expect((await peek(`198.51.100.${i}`, "target@example.test")).ok).toBe(true);
      await fail(`198.51.100.${i}`, "target@example.test");
    }
    expect(await peek("198.51.100.250", "target@example.test")).toEqual({ ok: false, reason: "email" });
  });

  it("one IP guessing across many accounts is stopped (credential stuffing)", async () => {
    const [max] = AUTH_LIMITS.sign_in.ip;
    for (let i = 0; i < max; i++) await fail("192.0.2.90", `stuffed${i}@example.test`);
    expect(await peek("192.0.2.90", "fresh@example.test")).toEqual({ ok: false, reason: "ip" });
  });

  it("peeking never counts", async () => {
    for (let i = 0; i < 50; i++) await peek("192.0.2.91", "peek@example.test");
    const [row] = await p.db.system((sql) => sql.query<{ n: number }>("select count(*)::int as n from private.rate_limits where key = $1", [keyFor(p.signingSecret, "sign_in", "email", "peek@example.test")]));
    expect(row.n).toBe(0);
  });

  it("sign-up abuse: one address can't be signed up over and over, one IP can't mass-register", async () => {
    const [perEmail] = AUTH_LIMITS.sign_up.email;
    for (let i = 0; i < perEmail; i++) expect((await hit("sign_up", `203.0.113.${100 + i}`, "spam-target@example.test")).ok).toBe(true);
    expect((await hit("sign_up", "203.0.113.150", "spam-target@example.test")).reason).toBe("email");
    const [perIp] = AUTH_LIMITS.sign_up.ip;
    for (let i = 0; i < perIp; i++) await hit("sign_up", "192.0.2.92", `bulk${i}@example.test`);
    expect((await hit("sign_up", "192.0.2.92", "bulk-next@example.test")).reason).toBe("ip");
  });

  it("reset and resend abuse are limited per address (no mailbox flooding)", async () => {
    for (const action of ["password_reset", "resend"] as const) {
      const [max] = AUTH_LIMITS[action].email;
      for (let i = 0; i < max; i++) expect((await hit(action, `198.51.100.${200 + i}`, `flood-${action}@example.test`)).ok).toBe(true);
      expect((await hit(action, "198.51.100.254", `flood-${action}@example.test`)).reason).toBe("email");
    }
  });
});
