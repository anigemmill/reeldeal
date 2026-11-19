import { describe, expect, it } from "vitest";
import { publicSchema, serverSchema } from "./schema";

describe("environment schema", () => {
  it("accepts an empty environment (Phase 1)", () => {
    expect(publicSchema.safeParse({}).success).toBe(true);
    expect(serverSchema.safeParse({}).success).toBe(true);
  });
  it("rejects a half-configured Supabase", () => {
    expect(publicSchema.safeParse({ NEXT_PUBLIC_SUPABASE_URL: "https://x.supabase.co" }).success).toBe(false);
  });
  it("refuses a secret or service-role key in the public (browser) Supabase key", () => {
    const jwt = (role: string) => ["e30", Buffer.from(JSON.stringify({ role, iss: "supabase" })).toString("base64url"), "sig"].join(".");
    const url = "https://jzshbaqfrrgsyiciuzfe.supabase.co";
    expect(publicSchema.safeParse({ NEXT_PUBLIC_SUPABASE_URL: url, NEXT_PUBLIC_SUPABASE_ANON_KEY: "sb_secret_abcdef" }).success).toBe(false);
    expect(publicSchema.safeParse({ NEXT_PUBLIC_SUPABASE_URL: url, NEXT_PUBLIC_SUPABASE_ANON_KEY: jwt("service_role") }).success).toBe(false);
    expect(publicSchema.safeParse({ NEXT_PUBLIC_SUPABASE_URL: url, NEXT_PUBLIC_SUPABASE_ANON_KEY: jwt("anon") }).success).toBe(true);
    expect(publicSchema.safeParse({ NEXT_PUBLIC_SUPABASE_URL: url, NEXT_PUBLIC_SUPABASE_ANON_KEY: "sb_publishable_abcdef" }).success).toBe(true);
  });
  it("defaults the production database role check to enforce", () => {
    expect(serverSchema.parse({}).DATABASE_ROLE_CHECK).toBe("enforce");
    expect(serverSchema.safeParse({ DATABASE_ROLE_CHECK: "off" }).success).toBe(false);
  });
  it("rejects a half-configured R2", () => {
    const r = serverSchema.safeParse({ R2_BUCKET: "media", R2_ACCOUNT_ID: "abc" });
    expect(r.success).toBe(false);
  });
  it("rejects malformed values", () => {
    expect(publicSchema.safeParse({ NEXT_PUBLIC_SITE_URL: "not a url" }).success).toBe(false);
    expect(serverSchema.safeParse({ R2_SIGNED_URL_TTL_SECONDS: "86400" }).success).toBe(false);
  });
  it("defaults the signed URL lifetime to 5 minutes", () => {
    expect(serverSchema.parse({}).R2_SIGNED_URL_TTL_SECONDS).toBe(300);
  });
});
