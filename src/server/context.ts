import type { AiProvider } from "./ai/provider";
import type { Principal } from "./auth/principal";
import type { Db, Sql } from "./db/types";
import type { Logger } from "./log";
import type { Storage } from "./storage/types";

/** Everything a service needs, created once per process (src/server/platform.ts). */
export type Platform = {
  db: Db;
  storage: Storage;
  ai: AiProvider | null;
  log: Logger;
  /** HMAC secret for credit quotes (and local signed URLs). */
  signingSecret: string;
  signedUrlTtlSeconds: number;
  media: { ffmpeg: string; ffprobe: string };
  version: string;
};

/** A request on behalf of an authenticated principal. */
export type Ctx = Platform & { principal: Principal };

/** Run queries as the signed-in user (RLS applies). */
export const asUser = <T>(ctx: Ctx, fn: (sql: Sql) => Promise<T>) => ctx.db.asUser(ctx.principal.userId, fn);

export const num = (v: unknown): number | null => (v === null || v === undefined ? null : Number(v));
export const iso = (v: unknown): string | null => (v ? new Date(v as string).toISOString() : null);
