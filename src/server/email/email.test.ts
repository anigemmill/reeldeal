import { describe, expect, it } from "vitest";
import { sendEmail } from "./resend";
import { invitationEmail } from "./templates";

const base = { to: "rangi@lodge.example", workspace: "Lakeside <Lodge>", inviter: "Aroha \"A\" Ngata", role: "editor" as const, acceptUrl: "https://app.example/invite#rdl_inv_" + "x".repeat(43), expiresAt: "2026-11-25T08:00:00Z", siteUrl: "https://app.example" };

describe("invitation email", () => {
  it("escapes every dynamic value and carries the link, address and expiry", () => {
    const e = invitationEmail(base);
    expect(e.html).not.toContain("<Lodge>");
    expect(e.html).toContain("Lakeside &lt;Lodge&gt;");
    expect(e.html).toContain("Aroha &quot;A&quot; Ngata");
    expect(e.html).toContain(base.acceptUrl);
    expect(e.html).toContain("only for rangi@lodge.example");
    expect(e.html).toMatch(/expires on <strong>25 November 2026/);
    expect(e.html).toContain('name="viewport"');
    expect(e.text).toContain(base.acceptUrl);
    expect(e.subject).toBe('Aroha "A" Ngata invited you to Lakeside <Lodge> on Reeldeal');
    expect(invitationEmail({ ...base, reminder: true }).subject).toMatch(/^Reminder: join/);
  });
});

describe("Resend sender", () => {
  const cfg = { apiKey: "re_test_key", from: "Reeldeal <team@mail.example>" };
  const content = { ...invitationEmail(base), to: base.to, idempotencyKey: "invitation:abc", tags: { kind: "invitation" } };

  it("sends nothing when not configured", async () => {
    let called = false;
    const r = await sendEmail({}, content, { fetch: (async () => ((called = true), new Response())) as typeof fetch });
    expect(r).toEqual({ sent: false, reason: "not_configured" });
    expect(called).toBe(false);
  });

  it("posts once with an idempotency key, and logs no address, link or body", async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    const logs: unknown[] = [];
    const fake = (async (url: string, init: RequestInit) => (calls.push({ url, init }), Response.json({ id: "em_1" }))) as unknown as typeof fetch;
    expect(await sendEmail(cfg, content, { fetch: fake, log: { warn: (...a) => logs.push(a) } })).toEqual({ sent: true, id: "em_1" });
    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toBe("https://api.resend.com/emails");
    expect((calls[0]!.init.headers as Record<string, string>)["idempotency-key"]).toBe("invitation:abc");
    const body = JSON.parse(String(calls[0]!.init.body));
    expect(body).toMatchObject({ from: cfg.from, to: [base.to], tags: [{ name: "kind", value: "invitation" }] });

    const failing = (async () => new Response("no", { status: 422 })) as unknown as typeof fetch;
    expect(await sendEmail(cfg, content, { fetch: failing, log: { warn: (...a) => logs.push(a) } })).toEqual({ sent: false, reason: "rejected" });
    const rate = (async () => new Response("slow", { status: 429 })) as unknown as typeof fetch;
    expect((await sendEmail(cfg, content, { fetch: rate })).sent).toBe(false);
    const down = (async () => { throw new Error("ECONNRESET"); }) as unknown as typeof fetch;
    expect(await sendEmail(cfg, content, { fetch: down, log: { warn: (...a) => logs.push(a) } })).toEqual({ sent: false, reason: "unavailable" });
    const logged = JSON.stringify(logs);
    expect(logged).not.toContain(base.to);
    expect(logged).not.toContain("rdl_inv_");
    expect(logged).not.toContain("re_test_key");
  });
});
