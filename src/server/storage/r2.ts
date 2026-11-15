import { createReadStream, createWriteStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { ReadableStream as WebReadableStream } from "node:stream/web";
import { AwsClient } from "aws4fetch";
import { assertKey, StorageObjectMissing, type SignedUrl, type Storage, type UploadedPart } from "./types";

/*
  Cloudflare R2 (S3-compatible), private bucket. Clients only ever receive SigV4
  presigned URLs with short expiry. Credentials stay on the server and should be an
  R2 API token scoped to this bucket with Object Read & Write only.

  - Single uploads are presigned PUTs that carry `If-None-Match: *`, so an existing
    object (an original) can never be overwritten through an upload link.
  - Large files use multipart uploads: the server creates the upload, signs one URL
    per part, lists the parts itself on completion and completes the upload.
  - Presigned PUTs cannot enforce a size limit; completion checks the stored size.
  - `endpoint` defaults to https://<account>.r2.cloudflarestorage.com. Override it for
    an R2 jurisdiction endpoint (…eu.r2…) or a local S3-compatible server in tests.
*/
export type R2Config = { accountId: string; accessKeyId: string; secretAccessKey: string; bucket: string; endpoint?: string; region?: string };

export function createR2Storage(cfg: R2Config): Storage {
  const client = new AwsClient({ accessKeyId: cfg.accessKeyId, secretAccessKey: cfg.secretAccessKey, service: "s3", region: cfg.region ?? "auto" });
  const base = (cfg.endpoint ?? `https://${cfg.accountId}.r2.cloudflarestorage.com`).replace(/\/$/, "");
  const objectUrl = (key: string, query: Record<string, string> = {}) => {
    assertKey(key);
    const url = new URL(`${base}/${encodeURIComponent(cfg.bucket)}/${key.split("/").map(encodeURIComponent).join("/")}`);
    for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v);
    return url.toString();
  };
  const presign = async (method: "GET" | "PUT", key: string, ttl: number, query: Record<string, string> = {}, headers: Record<string, string> = {}): Promise<SignedUrl> => {
    const url = new URL(objectUrl(key, query));
    url.searchParams.set("X-Amz-Expires", String(ttl));
    const signed = await client.sign(new Request(url, { method, headers }), { aws: { signQuery: true, allHeaders: true } });
    return { url: signed.url, expiresAt: new Date(Date.now() + ttl * 1000).toISOString(), method };
  };
  const call = async (url: string, init: RequestInit, what: string) => {
    const res = await client.fetch(url, init);
    if (!res.ok) throw new Error(`Storage ${what} failed (${res.status})`);
    return res;
  };
  const xml = (text: string, tag: string) => [...text.matchAll(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, "g"))].map((m) => m[1]);

  return {
    driver: "r2",
    signedGetUrl: (key, { ttlSeconds, filename }) =>
      presign("GET", key, ttlSeconds, filename ? { "response-content-disposition": `attachment; filename="${filename.replace(/["\\\r\n]/g, "")}"` } : {}),
    signedPutUrl: (key, { ttlSeconds, contentType }) => presign("PUT", key, ttlSeconds, {}, { "content-type": contentType, "if-none-match": "*" }),
    uploadHeaders: (contentType) => ({ "content-type": contentType, "if-none-match": "*" }),
    async putFile(key, localPath, contentType) {
      const size = (await stat(localPath)).size;
      await call(
        objectUrl(key),
        {
          method: "PUT",
          // Never overwrite: keys are unique, and the conditional header guards against races.
          headers: { "content-type": contentType, "content-length": String(size), "if-none-match": "*" },
          body: createReadStream(localPath) as unknown as BodyInit,
          duplex: "half",
        } as RequestInit,
        "write",
      );
      return { size };
    },
    async downloadToFile(key, localPath) {
      // Streamed to disk: originals can be many gigabytes.
      const res = await client.fetch(objectUrl(key));
      if (res.status === 404) throw new StorageObjectMissing(key);
      if (!res.ok) throw new Error(`Storage read failed (${res.status})`);
      if (!res.body) throw new Error("Storage read returned no body");
      await pipeline(Readable.fromWeb(res.body as unknown as WebReadableStream), createWriteStream(localPath));
    },
    async head(key) {
      const res = await client.fetch(objectUrl(key), { method: "HEAD" });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`Storage check failed (${res.status})`);
      return { size: Number(res.headers.get("content-length") ?? 0), contentType: res.headers.get("content-type") ?? undefined };
    },
    multipart: {
      async create(key, contentType) {
        const res = await call(objectUrl(key, { uploads: "" }), { method: "POST", headers: { "content-type": contentType } }, "multipart create");
        const [uploadId] = xml(await res.text(), "UploadId");
        if (!uploadId) throw new Error("Storage multipart create returned no upload id");
        return { uploadId };
      },
      signPart: (key, uploadId, partNumber, ttlSeconds) =>
        presign("PUT", key, ttlSeconds, { partNumber: String(partNumber), uploadId }),
      async listParts(key, uploadId) {
        const parts: UploadedPart[] = [];
        let marker = "";
        for (;;) {
          const res = await call(objectUrl(key, { uploadId, "max-parts": "1000", ...(marker ? { "part-number-marker": marker } : {}) }), {}, "multipart list");
          const text = await res.text();
          for (const block of xml(text, "Part")) {
            parts.push({ partNumber: Number(xml(block, "PartNumber")[0]), etag: xml(block, "ETag")[0].replace(/&quot;/g, '"'), size: Number(xml(block, "Size")[0]) });
          }
          if (xml(text, "IsTruncated")[0] !== "true") break;
          marker = xml(text, "NextPartNumberMarker")[0];
        }
        return parts.sort((a, b) => a.partNumber - b.partNumber);
      },
      async complete(key, uploadId, parts) {
        const body = `<CompleteMultipartUpload>${parts.map((p) => `<Part><PartNumber>${p.partNumber}</PartNumber><ETag>${p.etag.replace(/"/g, "&quot;")}</ETag></Part>`).join("")}</CompleteMultipartUpload>`;
        const res = await call(objectUrl(key, { uploadId }), { method: "POST", headers: { "content-type": "application/xml" }, body }, "multipart complete");
        // S3 can report a failed completion inside a 200 response.
        const text = await res.text();
        if (/<Error>/.test(text)) throw new Error(`Storage multipart complete failed (${xml(text, "Code")[0] ?? "error"})`);
      },
      async abort(key, uploadId) {
        const res = await client.fetch(objectUrl(key, { uploadId }), { method: "DELETE" });
        if (!res.ok && res.status !== 404) throw new Error(`Storage multipart abort failed (${res.status})`);
      },
    },
  };
}
