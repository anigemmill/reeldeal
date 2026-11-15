import "server-only";
import { AppError, toAppError } from "../errors";
import type { Ctx } from "../context";
import { loadAppContext } from "./session";

/*
  Server actions return a plain result instead of throwing, so the browser always
  gets a safe, specific message (from AppError) and never a stack trace or internal
  detail. Business rules stay in src/server/services; this only adds the session.
*/
export type ActionError = { code: string; message: string; details?: Record<string, unknown> };
export type ActionResult<T> = { ok: true; data: T } | { ok: false; error: ActionError };

export function failure(e: unknown): { ok: false; error: ActionError } {
  const err = e instanceof AppError ? e : toAppError(e);
  if (err.code === "internal") {
    console.error("action failed", (e as Error)?.message);
    return { ok: false, error: { code: "internal", message: "Something went wrong on our side. Please try again." } };
  }
  return { ok: false, error: { code: err.code, message: err.message, details: (err as { details?: Record<string, unknown> }).details } };
}

/** Run a service call as the signed-in user in their current workspace. */
export async function withCtx<T>(fn: (ctx: Ctx) => Promise<T>): Promise<ActionResult<T>> {
  try {
    const c = await loadAppContext();
    if (!c) return { ok: false, error: { code: "unauthenticated", message: "Your session has ended. Sign in again to continue." } };
    if (!("ctx" in c)) return { ok: false, error: { code: "forbidden", message: "Create your workspace first." } };
    return { ok: true, data: await fn(c.ctx) };
  } catch (e) {
    return failure(e);
  }
}
