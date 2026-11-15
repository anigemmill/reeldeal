import { randomBytes, randomUUID } from "node:crypto";
import { mkdtempSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Ctx } from "../context";
import { completeMediaUpload, createMediaUpload, getMediaAnalysis, requestAnalysis } from "../services/media";
import { createTestPlatform } from "../testing";
import { createWorker } from "../workers/runner";
import { createR2Storage } from "./r2";
import { mediaKey } from "./types";

/*
  R2 driver against a real S3-compatible server (SigV4 checks, multipart, conditional
  PUT). Runs only when TEST_S3_ENDPOINT is set, e.g. with the local stack:
    npm run stack:up && npm run test:storage
  Against real R2, set TEST_S3_ENDPOINT to https://<account>.r2.cloudflarestorage.com
  and a throwaway test bucket. Skipped (not passed) otherwise.
*/
const env = process.env;
const endpoint = env.TEST_S3_ENDPOINT;
const cfg = {
  accountId: env.TEST_S3_ACCOUNT_ID ?? "local",
  accessKeyId: env.TEST_S3_ACCESS_KEY_ID ?? "localdevaccesskey",
  secretAccessKey: env.TEST_S3_SECRET_ACCESS_KEY ?? "local-dev-only-secret-key",
  bucket: env.TEST_S3_BUCKET ?? "reeldeal-media",
  endpoint,
};
const orgA = randomUUID();
const orgB = randomUUID();
const dir = mkdtempSync(join(tmpdir(), "rd-s3-"));

describe.skipIf(!endpoint)("R2 storage driver on an S3-compatible server", () => {
  const s = createR2Storage(cfg);

  it("uploads through a signed PUT and never overwrites an existing object", async () => {
    const key = mediaKey(orgA, randomUUID(), "mp4");
    const put = await s.signedPutUrl(key, { ttlSeconds: 120, contentType: "video/mp4" });
    expect((await fetch(put.url, { method: "PUT", headers: s.uploadHeaders!("video/mp4"), body: "original" })).status).toBe(200);
    expect((await fetch(put.url, { method: "PUT", headers: s.uploadHeaders!("video/mp4"), body: "replaced" })).status).toBe(412);
    expect((await s.head(key))?.size).toBe("original".length);
    // Server-side writes are conditional too.
    writeFileSync(join(dir, "x"), "replaced");
    await expect(s.putFile(key, join(dir, "x"), "video/mp4")).rejects.toThrow(/412/);
  });

  it("rejects uploads that drop the signed headers, and tampered or expired links", async () => {
    const key = mediaKey(orgA, randomUUID(), "mp4");
    const put = await s.signedPutUrl(key, { ttlSeconds: 120, contentType: "video/mp4" });
    // Dropping the If-None-Match header breaks the signature (S3 answers 400 or 403).
    expect((await fetch(put.url, { method: "PUT", headers: { "content-type": "video/mp4" }, body: "x" })).status).toBeGreaterThanOrEqual(400);
    // The signature covers the key: the same link cannot write into another organisation.
    const other = put.url.replace(`org/${orgA}/`, `org/${orgB}/`);
    expect((await fetch(other, { method: "PUT", headers: s.uploadHeaders!("video/mp4"), body: "x" })).status).toBe(403);
    expect(await s.head(key)).toBeNull();

    await fetch(put.url, { method: "PUT", headers: s.uploadHeaders!("video/mp4"), body: "data" });
    const get = await s.signedGetUrl(key, { ttlSeconds: 1, filename: "clip.mp4" });
    const ok = await fetch(get.url);
    expect(ok.status).toBe(200);
    expect(ok.headers.get("content-disposition")).toContain("clip.mp4");
    expect(await ok.text()).toBe("data");
    expect((await fetch(get.url.replace(/X-Amz-Signature=[0-9a-f]+/, "X-Amz-Signature=" + "0".repeat(64)))).status).toBe(403);
    await new Promise((r) => setTimeout(r, 2100));
    expect((await fetch(get.url)).status).toBe(403);
    // No anonymous access to the bucket (MinIO answers 403; R2 answers 400 "InvalidArgument: Authorization").
    expect([400, 403]).toContain((await fetch(`${endpoint}/${cfg.bucket}/${key}`)).status);
  });

  it("streams a multipart upload and downloads it back intact", async () => {
    const key = mediaKey(orgA, randomUUID(), "mp4");
    const part = 5 * 1024 * 1024;
    const data = randomBytes(part * 2 + 1234);
    const { uploadId } = await s.multipart!.create(key, "video/mp4");
    for (const n of [2, 1, 3]) {
      const url = (await s.multipart!.signPart(key, uploadId, n, 300)).url;
      const res = await fetch(url, { method: "PUT", body: data.subarray((n - 1) * part, n * part) });
      expect(res.status).toBe(200);
    }
    const parts = await s.multipart!.listParts(key, uploadId);
    expect(parts.map((p) => [p.partNumber, p.size])).toEqual([[1, part], [2, part], [3, 1234]]);
    await s.multipart!.complete(key, uploadId, parts);
    expect((await s.head(key))?.size).toBe(data.length);
    await s.downloadToFile(key, join(dir, "back"));
    expect(readFileSync(join(dir, "back")).equals(data)).toBe(true);
  });
});

describe.skipIf(!endpoint)("large uploads through the media service on S3-compatible storage", () => {
  let t: Awaited<ReturnType<typeof createTestPlatform>>;
  let aroha: Ctx, dev: Ctx;
  let file: string;
  beforeAll(async () => {
    t = await createTestPlatform({ storage: createR2Storage(cfg), clips: 1 });
    aroha = await t.ctxFor(t.demo.tokens.aroha_owner_full);
    dev = await t.ctxFor(t.demo.tokens.dev_harbour_full);
    // ~150 MB real H.264 footage (synthetic test pattern, noise and a high bitrate so it crosses the multipart threshold).
    file = join(dir, "large.mp4");
    const { execFileSync } = await import("node:child_process");
    execFileSync("ffmpeg", ["-v", "error", "-f", "lavfi", "-i", "testsrc2=size=1920x1080:rate=30:duration=12", "-f", "lavfi", "-i", "sine=frequency=440:duration=12",
      "-vf", "noise=alls=40:allf=t+u", "-c:v", "libx264", "-preset", "ultrafast", "-b:v", "100M", "-maxrate", "100M", "-bufsize", "100M", "-c:a", "aac", "-shortest", "-y", file]);
  }, 300_000);
  afterAll(async () => t?.p.db.close());

  it("plans a multipart upload, reports missing parts with fresh URLs, then completes", async () => {
    const size = statSync(file).size;
    expect(size).toBeGreaterThan(100 * 1024 * 1024);
    const up = (await createMediaUpload(aroha, { title: "Large lake footage", filename: "large.mp4", content_type: "video/mp4", size_bytes: size })) as {
      media_id: string; upload: { method: string; part_size_bytes: number; part_count: number; parts: { part_number: number; url: string; byte_start: number; byte_end_inclusive: number }[] };
    };
    expect(up.upload.method).toBe("multipart");
    expect(up.upload.part_count).toBe(Math.ceil(size / up.upload.part_size_bytes));
    const bytes = readFileSync(file);
    const send = (p: { url: string; byte_start: number; byte_end_inclusive: number }) =>
      fetch(p.url, { method: "PUT", body: bytes.subarray(p.byte_start, p.byte_end_inclusive + 1) }).then((r) => expect(r.status).toBe(200));

    // Upload all but the first part; completion must not succeed.
    await Promise.all(up.upload.parts.slice(1).map(send));
    // Another organisation cannot complete (or even see) the upload.
    expect(((await completeMediaUpload(dev, up.media_id).catch((e) => e)) as { code: string }).code).toBe("not_found");
    const partial = (await completeMediaUpload(aroha, up.media_id)) as { status: string; missing_parts: { part_number: number; url: string; byte_start: number; byte_end_inclusive: number }[] };
    expect(partial.status).toBe("awaiting_upload");
    expect(partial.missing_parts.map((p) => p.part_number)).toEqual([1]);
    await send(partial.missing_parts[0]);

    const done = (await completeMediaUpload(aroha, up.media_id)) as { status: string; size_bytes: number };
    expect(done).toMatchObject({ status: "uploaded", size_bytes: size });
    expect(((await completeMediaUpload(aroha, up.media_id).catch((e) => e)) as { code: string }).code).toBe("conflict");

    // The worker streams the original from storage and analyses it.
    await requestAnalysis(aroha, up.media_id);
    const worker = createWorker(t.p, { workerId: "s3-test" });
    while (await worker.runOnce()) {}
    const a = (await getMediaAnalysis(aroha, up.media_id)) as unknown as { status: string; analysis: { technical: { width: number; height: number; duration_seconds: number } } };
    expect(a.status).toBe("analysed");
    expect(a.analysis.technical).toMatchObject({ width: 1920, height: 1080 });
    expect(a.analysis.technical.duration_seconds).toBeCloseTo(12, 0);
  }, 300_000);

  it("uses a single conditional PUT below the multipart threshold", async () => {
    const up = (await createMediaUpload(aroha, { title: "Small", filename: "s.mp4", content_type: "video/mp4", size_bytes: 1000 })) as { upload: { method: string; headers: Record<string, string> } };
    expect(up.upload.method).toBe("PUT");
    expect(up.upload.headers).toMatchObject({ "if-none-match": "*" });
  });
});
