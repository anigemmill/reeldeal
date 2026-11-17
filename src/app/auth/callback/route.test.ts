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

const { GET } = await import("./route");
const ORIGIN = "https://app.reeldeal.test";
const call = async (query: string) => {
  const res = await GET(new NextRequest(`${ORIGIN}/auth/callback${query}`));
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
  it("token-hash link (custom email template) is verified with its type", async () => {
    const r = await call("?token_hash=th&type=email");
    expect(auth.verifyOtp).toHaveBeenCalledWith({ type: "email", token_hash: "th" });
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
    const r = await call("?token_hash=th&type=bogus&flow=signup");
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
    const r = await call("?token_hash=th&type=email_change");
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
