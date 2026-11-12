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
