import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

/* /auth/callback: every emailed-link flow lands on the right screen; `next` can never leave the site. */
type User = { email_confirmed_at: string | null; new_email?: string | null } | null;
const auth = {
  exchangeCodeForSession: vi.fn<(code: string) => Promise<{ error: Error | null }>>(async () => ({ error: null })),
  verifyOtp: vi.fn<(args: { type: string; token_hash: string }) => Promise<{ error: Error | null }>>(async () => ({ error: null })),
  getUser: vi.fn<() => Promise<{ data: { user: User } }>>(async () => ({ data: { user: null } })),
};
vi.mock("@/server/app/supabase", () => ({ supabaseServer: async () => ({ auth }) }));

const { GET, POST } = await import("./route");
const ORIGIN = "https://app.reeldeal.test";
const call = async (query: string) => {
  const res = await GET(new NextRequest(`${ORIGIN}/auth/callback${query}`));
  return { status: res.status, location: res.headers.get("location") };
};
/** The Confirm button on /confirm-link: a form post back to the callback. */
const confirm = async (fields: Record<string, string>, origin: string | null = ORIGIN) => {
  const headers = new Headers();
  if (origin) headers.set("origin", origin);
  const res = await POST(new NextRequest(`${ORIGIN}/auth/callback`, { method: "POST", body: new URLSearchParams(fields), headers }));
  return { status: res.status, location: res.headers.get("location") };
};
const at = (path: string) => `${ORIGIN}${path}`;
const expired = () => auth.exchangeCodeForSession.mockResolvedValue({ error: new Error("expired") });

beforeEach(() => {
  auth.exchangeCodeForSession.mockClear().mockResolvedValue({ error: null });
  auth.verifyOtp.mockClear().mockResolvedValue({ error: null });
  auth.getUser.mockClear().mockResolvedValue({ data: { user: null } });
});

describe("sign-up confirmation", () => {
  it("PKCE link: confirmed, continues to onboarding", async () => {
    const r = await call("?flow=signup&code=abc");
    expect(auth.exchangeCodeForSession).toHaveBeenCalledWith("abc");
    expect(r.status).toBe(307);
    expect(r.location).toBe(at("/onboarding?verified=1"));
  });
  it("token-hash link (custom email template) is verified with its type, once Confirm is pressed", async () => {
    const r = await confirm({ token_hash: "th", type: "email", flow: "signup" });
    expect(auth.verifyOtp).toHaveBeenCalledWith({ type: "email", token_hash: "th" });
    expect(r.status).toBe(303);
    expect(r.location).toBe(at("/onboarding?verified=1"));
  });
  it("links sent before flows existed (next=/onboarding) still work", async () => {
    expect((await call("?code=abc&next=/onboarding")).location).toBe(at("/onboarding?verified=1"));
  });
  it("expired or used link, signed out: verification screen with a new-link option", async () => {
    expired();
    expect((await call("?flow=signup&code=old")).location).toBe(at("/verify-email?link=invalid"));
  });
  it("used link, already confirmed and signed in: onboarding says it's already confirmed", async () => {
    expired();
    auth.getUser.mockResolvedValue({ data: { user: { email_confirmed_at: "2026-11-17T00:00:00Z" } } });
    expect((await call("?flow=signup&code=old")).location).toBe(at("/onboarding?verified=already"));
  });
  it("Supabase error redirect (no code, error_code=otp_expired)", async () => {
    expect((await call("?flow=signup&error=access_denied&error_code=otp_expired")).location).toBe(at("/verify-email?link=invalid"));
  });
  it("an unknown OTP type is never passed to Supabase", async () => {
    const r = await confirm({ token_hash: "th", type: "bogus", flow: "signup" });
    expect(auth.verifyOtp).not.toHaveBeenCalled();
    expect(r.location).toBe(at("/verify-email?link=invalid"));
  });
});

describe("password reset", () => {
  it("continues to the reset page", async () => {
    expect((await call("?flow=recovery&code=abc")).location).toBe(at("/reset-password"));
    expect((await call("?code=abc&next=/reset-password")).location).toBe(at("/reset-password"));
  });
  it("an expired reset link shows the reset page's expired message", async () => {
    expired();
    expect((await call("?flow=recovery&code=old")).location).toBe(at("/reset-password"));
  });
});

describe("email change", () => {
  it("confirmed", async () => {
    expect((await call("?flow=email_change&code=abc")).location).toBe(at("/settings/account?email=confirmed"));
  });
  it("token-hash link while the other address is still unconfirmed", async () => {
    auth.getUser.mockResolvedValue({ data: { user: { email_confirmed_at: "x", new_email: "new@example.test" } } });
    const r = await confirm({ token_hash: "th", type: "email_change", flow: "email_change" });
    expect(auth.verifyOtp).toHaveBeenCalledWith({ type: "email_change", token_hash: "th" });
    expect(r.location).toBe(at("/settings/account?email=one_confirmed"));
  });
  it("first of the two confirmations (Supabase sends a message, no code)", async () => {
    expect((await call("?flow=email_change&message=Confirmation+link+accepted")).location).toBe(at("/settings/account?email=one_confirmed"));
  });
  it("expired link while signed in", async () => {
    expired();
    auth.getUser.mockResolvedValue({ data: { user: { email_confirmed_at: "x" } } });
    expect((await call("?flow=email_change&code=old")).location).toBe(at("/settings/account?email=link_invalid"));
  });
  it("expired link while signed out", async () => {
    expired();
    expect((await call("?flow=email_change&code=old")).location).toBe(at("/sign-in?expired=1&next=/settings/account"));
  });
});

describe("redirect safety", () => {
  it("no next: the dashboard", async () => {
    expect((await call("?code=abc")).location).toBe(at("/dashboard"));
  });
  it.each(["/\\evil.com", "//evil.com", "https://evil.com", "/\t/evil.com", "/\\/evil.com"])("next=%s stays on the site", async (next) => {
    const r = await call(`?code=abc&next=${encodeURIComponent(next)}`);
    expect(new URL(r.location!).origin).toBe(ORIGIN);
    expect(r.location).toBe(at("/dashboard"));
  });
  it("an unknown flow is ignored, and a failed link never follows next", async () => {
    expired();
    expect((await call("?flow=evil&code=old&next=/\\evil.com")).location).toBe(at("/sign-in?expired=1"));
  });
  it("a request with no code or token is refused", async () => {
    expect((await call("?next=/dashboard")).location).toBe(at("/sign-in?expired=1"));
  });
});

describe("link scanners (work email opens every link before the person does)", () => {
  it.each([
    ["?token_hash=th&type=email", "signup"],
    ["?token_hash=th&type=recovery", "recovery"],
    ["?token_hash=th&type=email_change", "email_change"],
  ])("opening %s uses nothing up: it shows the Confirm page", async (query, flow) => {
    const r = await call(query);
    expect(auth.verifyOtp).not.toHaveBeenCalled();
    expect(auth.exchangeCodeForSession).not.toHaveBeenCalled();
    const to = new URL(r.location!);
    expect(to.origin).toBe(ORIGIN);
    expect(to.pathname).toBe("/confirm-link");
    expect(to.searchParams.get("token_hash")).toBe("th");
    expect(to.searchParams.get("flow")).toBe(flow);
  });
  it("opening the link twice (scanner, then person) still leaves it usable", async () => {
    await call("?token_hash=th&type=email");
    await call("?token_hash=th&type=email");
    expect(auth.verifyOtp).not.toHaveBeenCalled();
    expect((await confirm({ token_hash: "th", type: "email", flow: "signup" })).location).toBe(at("/onboarding?verified=1"));
    expect(auth.verifyOtp).toHaveBeenCalledTimes(1);
  });
  it("the Confirm page keeps next, made safe", async () => {
    const to = new URL((await call(`?token_hash=th&type=email&next=${encodeURIComponent("//evil.com")}`)).location!);
    expect(to.searchParams.get("next")).toBe("/dashboard");
  });
  it("a post from another site is refused (login CSRF)", async () => {
    const r = await confirm({ token_hash: "th", type: "email", flow: "signup" }, "https://evil.example");
    expect(r.status).toBe(403);
    expect(auth.verifyOtp).not.toHaveBeenCalled();
  });
  it("an expired token on Confirm goes to the expired screen", async () => {
    auth.verifyOtp.mockResolvedValue({ error: new Error("expired") });
    expect((await confirm({ token_hash: "old", type: "email", flow: "signup" })).location).toBe(at("/verify-email?link=invalid"));
  });
  it("a reset link continues to the reset page after Confirm", async () => {
    expect((await confirm({ token_hash: "th", type: "recovery", flow: "recovery" })).location).toBe(at("/reset-password"));
  });
});
