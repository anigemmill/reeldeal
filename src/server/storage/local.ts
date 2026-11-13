import { createHmac, timingSafeEqual } from "node:crypto";
import { copyFile, mkdir, open, stat } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { assertKey, type SignedUrl, type Storage } from "./types";

/*
  Development storage on the local filesystem. Signed URLs are HMAC tokens checked
  by the dev media route (src/mcp/http-server.ts), with the same expiry semantics as R2.
*/
export function createLocalStorage(opts: { dir: string; baseUrl: string; secret: string }): Storage & {
  verify(method: "GET" | "PUT", key: string, exp: string, sig: string, extra?: string): boolean;
  pathFor(key: string): string;
} {
  const root = resolve(opts.dir);
  const pathFor = (key: string) => {
    assertKey(key);
    const p = resolve(join(root, key));
    if (!p.startsWith(root + "/")) throw new Error("Invalid storage key");
    return p;
  };
  const sign = (method: string, key: string, exp: number, extra = "") =>
    createHmac("sha256", opts.secret).update(`${method}\n${key}\n${exp}\n${extra}`).digest("base64url");
  const build = (method: "GET" | "PUT", key: string, ttl: number, extra = "", params: Record<string, string> = {}): SignedUrl => {
    assertKey(key);
    const exp = Math.floor(Date.now() / 1000) + ttl;
    const q = new URLSearchParams({ ...params, exp: String(exp), sig: sign(method, key, exp, extra) });
    return { url: `${opts.baseUrl.replace(/\/$/, "")}/${key}?${q}`, expiresAt: new Date(exp * 1000).toISOString(), method };
  };

  return {
    driver: "local",
    pathFor,
    async signedGetUrl(key, { ttlSeconds, filename }) {
      return build("GET", key, ttlSeconds, filename ?? "", filename ? { filename } : {});
    },
    async signedPutUrl(key, { ttlSeconds, contentType }) {
      return build("PUT", key, ttlSeconds, contentType, { ct: contentType });
    },
    verify(method, key, exp, sig, extra = "") {
      try {
        assertKey(key);
      } catch {
        return false;
      }
      const e = Number(exp);
      if (!Number.isFinite(e) || e < Date.now() / 1000) return false;
      const expected = Buffer.from(sign(method, key, e, extra));
      const given = Buffer.from(sig);
      return expected.length === given.length && timingSafeEqual(expected, given);
    },
    async putFile(key, localPath) {
      const dest = pathFor(key);
      await mkdir(dirname(dest), { recursive: true });
      const fh = await open(dest, "wx"); // fails if it exists: never overwrite
      await fh.close();
      await copyFile(localPath, dest);
      return { size: (await stat(dest)).size };
    },
    async downloadToFile(key, localPath) {
      await copyFile(pathFor(key), localPath);
    },
    async head(key) {
      try {
        const s = await stat(pathFor(key));
        return { size: s.size };
      } catch {
        return null;
      }
    },
  };
}
