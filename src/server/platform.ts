import "server-only";
import { randomBytes } from "node:crypto";
import { serverEnv as env } from "@/env/server";
import { createOpenAiProvider } from "./ai/openai";
import type { Platform } from "./context";
import { createPgliteDb } from "./db/pglite";
import { migrate } from "./db/migrate";
import { createPostgresDb } from "./db/postgres";
import type { Db } from "./db/types";
import { createLogger, type Logger } from "./log";
import { createLocalStorage } from "./storage/local";
import { createR2Storage } from "./storage/r2";
import type { Storage } from "./storage/types";

export const PLATFORM_VERSION = "0.1.0";

/*
  Builds the platform from the validated server environment (src/env/schema.ts):
    database  DATABASE_URL → Postgres (Supabase in production); otherwise embedded PGlite (local only)
    storage   R2 when configured; otherwise local files with signed URLs (development)
    ai        OpenAI when OPENAI_API_KEY is set; otherwise AI tools report "not configured"
*/
export async function createPlatform(opts: { log?: Logger; db?: Db; autoMigrateEmbedded?: boolean } = {}): Promise<Platform> {
  const log = opts.log ?? createLogger(env.MCP_LOG_LEVEL);

  let signingSecret = env.SIGNING_SECRET;
  if (!signingSecret) {
    if (env.NODE_ENV === "production") throw new Error("SIGNING_SECRET is required in production");
    signingSecret = randomBytes(32).toString("base64url");
    log.warn("SIGNING_SECRET not set: using a temporary secret for this process (development only)");
  }

  let db = opts.db;
  if (!db) {
    if (env.DATABASE_URL) db = createPostgresDb(env.DATABASE_URL);
    else {
      if (env.NODE_ENV === "production") throw new Error("DATABASE_URL is required in production");
      const pg = await createPgliteDb(env.PGLITE_DIR);
      if (opts.autoMigrateEmbedded !== false) await migrate(pg, (sql) => pg.exec(sql), (m) => log.info("migration", { m }));
      db = pg;
    }
  }

  const useR2 = env.STORAGE_DRIVER === "r2" || (!env.STORAGE_DRIVER && env.R2_BUCKET);
  let storage: Storage;
  if (useR2 && env.R2_ACCOUNT_ID && env.R2_ACCESS_KEY_ID && env.R2_SECRET_ACCESS_KEY && env.R2_BUCKET) {
    storage = createR2Storage({ accountId: env.R2_ACCOUNT_ID, accessKeyId: env.R2_ACCESS_KEY_ID, secretAccessKey: env.R2_SECRET_ACCESS_KEY, bucket: env.R2_BUCKET });
  } else {
    if (env.NODE_ENV === "production") throw new Error("R2 storage is required in production");
    storage = createLocalStorage({ dir: env.LOCAL_STORAGE_DIR, baseUrl: env.LOCAL_MEDIA_BASE_URL ?? `http://localhost:${env.MCP_HTTP_PORT}/media`, secret: signingSecret });
  }

  const ai = env.OPENAI_API_KEY
    ? createOpenAiProvider({ apiKey: env.OPENAI_API_KEY, baseUrl: env.OPENAI_BASE_URL, model: env.OPENAI_MODEL, timeoutMs: env.OPENAI_TIMEOUT_MS })
    : null;

  return {
    db,
    storage,
    ai,
    log,
    signingSecret,
    signedUrlTtlSeconds: env.R2_SIGNED_URL_TTL_SECONDS,
    media: { ffmpeg: env.FFMPEG_PATH, ffprobe: env.FFPROBE_PATH },
    version: PLATFORM_VERSION,
  };
}

export { env as platformEnv };
