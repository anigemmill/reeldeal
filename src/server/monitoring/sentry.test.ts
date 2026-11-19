import { describe, expect, it } from "vitest";
import { redact } from "../log";
import { buildEvent, captureError, parseDsn, safePath, scrub } from "./sentry";

const cfg = { dsn: "https://publickey123@o4500.ingest.example.io/4501", environment: "test", release: "0.1.0" };

describe("Sentry reporter", () => {
  it("is off without a DSN and never calls out", async () => {
    let called = false;
    const fake = (async () => ((called = true), new Response())) as unknown as typeof fetch;
    expect(await captureError(new Error("x"), { service: "web" }, { ...cfg, dsn: undefined }, { fetch: fake })).toBe(false);
    expect(called).toBe(false);
  });

  it("parses a DSN into the envelope endpoint and rejects bad ones", () => {
    expect(parseDsn(cfg.dsn)).toEqual({ endpoint: "https://o4500.ingest.example.io/api/4501/envelope/", key: "publickey123" });
    expect(parseDsn("http://k@host/1")).toBeNull();
    expect(parseDsn("https://host/1")).toBeNull();
    expect(parseDsn("not a url")).toBeNull();
  });

  it("scrubs tokens, keys and email addresses from messages, tags and context; drops unknown context", () => {
    const err = new Error(`invite rdl_inv_${"a".repeat(43)} for aroha@lodge.example failed with key sb_secret_abc and re_${"Q".repeat(20)} and rdl_pat_xyz`);
    const ev = buildEvent(err, { service: "web", tags: { route: "/invite", who: "ben@lodge.example" }, extra: { job_id: "j1", body: "secret form", password: "hunter2", route: "/settings/team" } }, cfg);
    const out = JSON.stringify(ev);
    for (const leak of ["rdl_inv_", "aroha@lodge.example", "ben@lodge.example", "sb_secret_abc", "re_QQQ", "rdl_pat_xyz", "secret form", "hunter2"]) expect(out).not.toContain(leak);
    expect(ev.extra).toEqual({ job_id: "j1", route: "/settings/team" });
    expect(ev.tags).toMatchObject({ service: "web", route: "/invite", who: "[email]" });
    expect(Object.keys(ev)).not.toContain("request");
    expect(Object.keys(ev)).not.toContain("user");
  });

  it("strips query strings and fragments from paths", () => {
    expect(safePath("/auth/callback?token_hash=abc&type=email")).toBe("/auth/callback");
    expect(safePath("/invite#rdl_inv_x")).toBe("/invite");
  });

  it("sends one envelope with the auth header, and swallows network errors", async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    const fake = (async (url: string, init: RequestInit) => (calls.push({ url, init }), new Response("{}"))) as unknown as typeof fetch;
    expect(await captureError(new Error("boom"), { service: "worker", tags: { job_kind: "render" } }, cfg, { fetch: fake })).toBe(true);
    expect(calls[0]!.url).toBe("https://o4500.ingest.example.io/api/4501/envelope/");
    expect((calls[0]!.init.headers as Record<string, string>)["x-sentry-auth"]).toContain("sentry_key=publickey123");
    const [, type, event] = String(calls[0]!.init.body).split("\n");
    expect(JSON.parse(type!)).toEqual({ type: "event" });
    expect(JSON.parse(event!).exception.values[0].value).toBe("boom");
    const down = (async () => { throw new Error("offline"); }) as unknown as typeof fetch;
    expect(await captureError(new Error("x"), { service: "web" }, cfg, { fetch: down })).toBe(false);
    expect(await captureError(new Error("x"), { service: "web" }, { ...cfg, sampleRate: 0.1 }, { fetch: fake, random: () => 0.5 })).toBe(false);
  });
});

describe("log redaction", () => {
  it("redacts invitation tokens and secret keys as well as access tokens", () => {
    const line = JSON.stringify(redact({ msg: `token rdl_inv_${"b".repeat(43)} key sb_secret_zzz resend re_${"k".repeat(24)} pat rdl_pat_abc`, nested: { password: "x" } }));
    for (const leak of ["rdl_inv_b", "sb_secret_zzz", "re_kkkk", "rdl_pat_abc"]) expect(line).not.toContain(leak);
    expect(line).toContain('"password":"[redacted]"');
    expect(scrub("mail me at a@b.co")).toBe("mail me at [email]");
  });
});
