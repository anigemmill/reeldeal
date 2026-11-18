import { serverEnv } from "@/env/server";
import { PLATFORM_VERSION } from "../platform-version";
import { captureError, type ErrorContext } from "./sentry";

/** The process's error reporter, configured from the environment (off without SENTRY_DSN). */
export function reportError(err: unknown, ctx: ErrorContext): Promise<boolean> {
  return captureError(err, ctx, {
    dsn: serverEnv.SENTRY_DSN,
    environment: serverEnv.SENTRY_ENVIRONMENT ?? serverEnv.NODE_ENV,
    release: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) ?? PLATFORM_VERSION,
    sampleRate: serverEnv.SENTRY_SAMPLE_RATE,
  });
}

export const monitoringEnabled = () => Boolean(serverEnv.SENTRY_DSN);
