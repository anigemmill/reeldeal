import { createReadStream } from "node:fs";
import { stat, writeFile } from "node:fs/promises";
import { AwsClient } from "aws4fetch";
import { assertKey, type SignedUrl, type Storage } from "./types";

/*
  Cloudflare R2 (S3-compatible), private bucket. Clients only ever receive SigV4
  presigned URLs with short expiry. Credentials stay on the server and should be an
  R2 API token scoped to this bucket with object read/write only.
  Note: presigned PUTs cannot enforce a size limit; uploads are checked with HEAD
  when the client completes them (services/media.ts) and rejected if too large.
*/
export function createR2Storage(cfg: { accountId: string; accessKeyId: string; secretAccessKey: string; bucket: string }): Storage {
  const client = new AwsClient({ accessKeyId: cfg.accessKeyId, secretAccessKey: cfg.secretAccessKey, service: "s3", region: "auto" });
  const objectUrl = (key: string) => {
    assertKey(key);
    return `https://${cfg.accountId}.r2.cloudflarestorage.com/${cfg.bucket}/${key.split("/").map(encodeURIComponent).join("/")}`;
  };
  const presign = async (method: "GET" | "PUT", key: string, ttl: number, query: Record<string, string> = {}, headers: Record<string, string> = {}): Promise<SignedUrl> => {
    const url = new URL(objectUrl(key));
    url.searchParams.set("X-Amz-Expires", String(ttl));
    for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v);
    const signed = await client.sign(new Request(url, { method, headers }), { aws: { signQuery: true, allHeaders: true } });
    return { url: signed.url, expiresAt: new Date(Date.now() + ttl * 1000).toISOString(), method };
  };

  return {
    driver: "r2",
    signedGetUrl: (key, { ttlSeconds, filename }) =>
      presign("GET", key, ttlSeconds, filename ? { "response-content-disposition": `attachment; filename="${filename.replace(/["\\\r\n]/g, "")}"` } : {}),
    signedPutUrl: (key, { ttlSeconds, contentType }) => presign("PUT", key, ttlSeconds, {}, { "content-type": contentType }),
    async putFile(key, localPath, contentType) {
      const size = (await stat(localPath)).size;
      const res = await client.fetch(objectUrl(key), {
        method: "PUT",
        // Never overwrite: keys are unique, and the conditional header guards against races.
        headers: { "content-type": contentType, "content-length": String(size), "if-none-match": "*" },
        body: createReadStream(localPath) as unknown as BodyInit,
        duplex: "half",
      } as RequestInit);
      if (!res.ok) throw new Error(`Storage write failed (${res.status})`);
      return { size };
    },
    async downloadToFile(key, localPath) {
      const res = await client.fetch(objectUrl(key));
      if (!res.ok) throw new Error(`Storage read failed (${res.status})`);
      await writeFile(localPath, Buffer.from(await res.arrayBuffer()));
    },
    async head(key) {
      const res = await client.fetch(objectUrl(key), { method: "HEAD" });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`Storage check failed (${res.status})`);
      return { size: Number(res.headers.get("content-length") ?? 0), contentType: res.headers.get("content-type") ?? undefined };
    },
  };
}
