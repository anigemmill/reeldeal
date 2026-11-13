/*
  Private media storage. Object keys are namespaced by organisation:
    org/{org_id}/media/{media_id}/original.{ext}
    org/{org_id}/media/{media_id}/analysis/{job_id}/…
    org/{org_id}/exports/{export_id}.mp4
  Clients never see keys or permanent URLs, only short-lived signed URLs.
*/
export type SignedUrl = { url: string; expiresAt: string; method: "GET" | "PUT" };

export interface Storage {
  readonly driver: "local" | "r2";
  /** Signed download link (GET), valid for ttlSeconds. */
  signedGetUrl(key: string, opts: { ttlSeconds: number; filename?: string }): Promise<SignedUrl>;
  /** Signed upload link (PUT) for a new object. */
  signedPutUrl(key: string, opts: { ttlSeconds: number; contentType: string }): Promise<SignedUrl>;
  /** Server-side write of a new object (exports, thumbnails). Refuses to overwrite. */
  putFile(key: string, localPath: string, contentType: string): Promise<{ size: number }>;
  /** Server-side read to a local temp file (workers). */
  downloadToFile(key: string, localPath: string): Promise<void>;
  head(key: string): Promise<{ size: number; contentType?: string } | null>;
}

const KEY = /^org\/[0-9a-f-]{36}\/(media|exports)\/[A-Za-z0-9._/-]+$/;

/** Keys are built by the server; still validate so a bad key can never escape the org namespace. */
export function assertKey(key: string, orgId?: string) {
  if (!KEY.test(key) || key.includes("..") || key.includes("//")) throw new Error("Invalid storage key");
  if (orgId && !key.startsWith(`org/${orgId}/`)) throw new Error("Storage key belongs to another organisation");
}

export const mediaKey = (orgId: string, mediaId: string, ext: string) => `org/${orgId}/media/${mediaId}/original.${ext}`;
export const exportKey = (orgId: string, exportId: string, ext = "mp4") => `org/${orgId}/exports/${exportId}.${ext}`;
