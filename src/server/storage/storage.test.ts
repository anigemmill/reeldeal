import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createLocalStorage } from "./local";
import { createR2Storage } from "./r2";
import { assertKey, mediaKey } from "./types";

const ORG = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";

describe("storage keys", () => {
  it("only allows org-namespaced keys", () => {
    expect(() => assertKey(mediaKey(ORG, "m1", "mp4"))).not.toThrow();
    expect(() => assertKey("org/../etc/passwd")).toThrow();
    expect(() => assertKey(`org/${ORG}/media/../../x`)).toThrow();
    expect(() => assertKey(mediaKey(ORG, "m1", "mp4"), OTHER)).toThrow(/another organisation/);
  });
});

describe("local storage", () => {
  const dir = mkdtempSync(join(tmpdir(), "rd-storage-"));
  const s = createLocalStorage({ dir, baseUrl: "http://localhost:3333/media", secret: "x".repeat(32) });

  it("signs URLs that expire and cannot be altered", async () => {
    const key = mediaKey(ORG, "m1", "mp4");
    const { url, expiresAt } = await s.signedGetUrl(key, { ttlSeconds: 60, filename: "clip.mp4" });
    const u = new URL(url);
    expect(new Date(expiresAt).getTime()).toBeGreaterThan(Date.now());
    const k = decodeURIComponent(u.pathname.replace("/media/", ""));
    expect(s.verify("GET", k, u.searchParams.get("exp")!, u.searchParams.get("sig")!, "clip.mp4")).toBe(true);
    expect(s.verify("GET", mediaKey(OTHER, "m1", "mp4"), u.searchParams.get("exp")!, u.searchParams.get("sig")!, "clip.mp4")).toBe(false);
    expect(s.verify("PUT", k, u.searchParams.get("exp")!, u.searchParams.get("sig")!, "clip.mp4")).toBe(false);
    expect(s.verify("GET", k, String(Math.floor(Date.now() / 1000) - 1), u.searchParams.get("sig")!, "clip.mp4")).toBe(false);
  });

  it("never overwrites an existing object", async () => {
    const src = join(dir, "src.bin");
    writeFileSync(src, "a");
    const key = mediaKey(ORG, "m2", "mp4");
    await s.putFile(key, src, "video/mp4");
    await expect(s.putFile(key, src, "video/mp4")).rejects.toThrow();
  });
});

describe("R2 presigned URLs", () => {
  const r2 = createR2Storage({ accountId: "acc123", accessKeyId: "AKIDEXAMPLE", secretAccessKey: "test-secret-not-real", bucket: "media" });
  it("are SigV4 query-signed, short-lived and contain no secret", async () => {
    const { url } = await r2.signedGetUrl(mediaKey(ORG, "m1", "mp4"), { ttlSeconds: 300, filename: "clip.mp4" });
    const u = new URL(url);
    expect(u.host).toBe("acc123.r2.cloudflarestorage.com");
    expect(u.pathname).toBe(`/media/org/${ORG}/media/m1/original.mp4`);
    expect(u.searchParams.get("X-Amz-Expires")).toBe("300");
    expect(u.searchParams.get("X-Amz-Signature")).toMatch(/^[0-9a-f]{64}$/);
    expect(url).not.toContain("test-secret-not-real");
  });
});
