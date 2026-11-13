import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AiProvider } from "./ai/provider";
import type { Principal } from "./auth/principal";
import { verifyAccessToken } from "./auth/tokens";
import type { Ctx, Platform } from "./context";
import { createTestDb } from "./db/test-harness";
import { silentLogger } from "./log";
import { seedDemoData } from "./seed";
import { createLocalStorage } from "./storage/local";

/** Test platform: in-memory Postgres (PGlite) with migrations, temp storage, optional mock AI. Tests only. */
export async function createTestPlatform(opts: { ai?: AiProvider | null; seed?: boolean; clips?: number } = {}) {
  const db = await createTestDb();
  const secret = "test-signing-secret-0123456789abcdef";
  const p: Platform = {
    db,
    storage: createLocalStorage({ dir: mkdtempSync(join(tmpdir(), "rd-test-storage-")), baseUrl: "http://localhost:3333/media", secret }),
    ai: opts.ai ?? null,
    log: silentLogger,
    signingSecret: secret,
    signedUrlTtlSeconds: 300,
    media: { ffmpeg: "ffmpeg", ffprobe: "ffprobe" },
    version: "test",
  };
  const demo = opts.seed === false ? null : await seedDemoData(p, { scale: 0.25, clips: opts.clips });
  const ctxFor = async (token: string): Promise<Ctx> => ({ ...p, principal: await verifyAccessToken(db, token) });
  const ctxAs = (principal: Principal): Ctx => ({ ...p, principal });
  return { p, demo: demo!, ctxFor, ctxAs };
}
