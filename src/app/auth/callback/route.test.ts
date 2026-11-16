import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

/* Regression tests for /auth/callback: legitimate links still work; `next` can never leave the site. */
const auth = {
  exchangeCodeForSession: vi.fn<(code: string) => Promise<{ error: Error | null }>>(async () => ({ error: null })),
  verifyOtp: vi.fn<(args: { type: string; token_hash: string }) => Promise<{ error: Error | null }>>(async () => ({ error: null })),
};
vi.mock("@/server/app/supabase", () => ({ supabaseServer: async () => ({ auth }) }));

const { GET } = await import("./route");
const call = async (query: string) => {
  const res = await GET(new NextRequest(`https://app.reeldeal.test/auth/callback${query}`));
  return { status: res.status, location: res.headers.get("location") };
};

beforeEach(() => {
  auth.exchangeCodeForSession.mockClear().mockResolvedValue({ error: null });
  auth.verifyOtp.mockClear().mockResolvedValue({ error: null });
});

describe("/auth/callback", () => {
  it("sign-up confirmation (PKCE code) continues to onboarding", async () => {
    const r = await call("?code=abc&next=/onboarding");
    expect(auth.exchangeCodeForSession).toHaveBeenCalledWith("abc");
    expect(r.status).toBe(307);
    expect(r.location).toBe("https://app.reeldeal.test/onboarding");
  });

  it("password reset continues to the reset page", async () => {
    expect((await call("?code=abc&next=/reset-password")).location).toBe("https://app.reeldeal.test/reset-password");
  });

  it("token-hash links (email templates) are verified with their type", async () => {
    const r = await call("?token_hash=th&type=signup&next=/onboarding");
    expect(auth.verifyOtp).toHaveBeenCalledWith({ type: "signup", token_hash: "th" });
    expect(r.location).toBe("https://app.reeldeal.test/onboarding");
  });

  it("an unknown OTP type is not passed to Supabase", async () => {
    const r = await call("?token_hash=th&type=bogus&next=/onboarding");
    expect(auth.verifyOtp).not.toHaveBeenCalled();
    expect(r.location).toBe("https://app.reeldeal.test/sign-in?expired=1");
  });

  it("no next: the dashboard", async () => {
    expect((await call("?code=abc")).location).toBe("https://app.reeldeal.test/dashboard");
  });

  it.each(["/\\evil.com", "//evil.com", "https://evil.com", "/\t/evil.com", "/\\/evil.com"])("next=%s stays on the site", async (next) => {
    const r = await call(`?code=abc&next=${encodeURIComponent(next)}`);
    expect(new URL(r.location!).origin).toBe("https://app.reeldeal.test");
    expect(r.location).toBe("https://app.reeldeal.test/dashboard");
  });

  it("an expired or used link goes to sign-in, never to `next`", async () => {
    auth.exchangeCodeForSession.mockResolvedValue({ error: new Error("expired") });
    expect((await call("?code=old&next=/\\evil.com")).location).toBe("https://app.reeldeal.test/sign-in?expired=1");
  });

  it("an expired reset link shows the reset page's expired message", async () => {
    auth.exchangeCodeForSession.mockResolvedValue({ error: new Error("expired") });
    expect((await call("?code=old&next=/reset-password")).location).toBe("https://app.reeldeal.test/reset-password");
  });

  it("a request with no code or token is refused", async () => {
    expect((await call("?next=/dashboard")).location).toBe("https://app.reeldeal.test/sign-in?expired=1");
  });
});
