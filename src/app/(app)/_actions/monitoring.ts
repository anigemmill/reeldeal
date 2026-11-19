"use server";

import { reportError } from "@/server/monitoring";

/*
  Browser errors caught by the app's error boundary. Bounded and scrubbed like server errors; a
  per-process budget stops a looping page from flooding Sentry. Off without SENTRY_DSN.
*/
let budget = { windowStart: 0, count: 0 };

export async function reportClientError(input: { message?: string; digest?: string; path?: string; name?: string }) {
  const now = Date.now();
  if (now - budget.windowStart > 60_000) budget = { windowStart: now, count: 0 };
  if (++budget.count > 30) return;
  const e = new Error(String(input?.message ?? "Browser error").slice(0, 500));
  e.name = String(input?.name ?? "BrowserError").slice(0, 60);
  await reportError(Object.assign(e, { digest: typeof input?.digest === "string" ? input.digest : undefined, stack: `${e.name}: ${e.message}` }), {
    service: "browser",
    extra: { route: String(input?.path ?? "").split(/[?#]/)[0]!.slice(0, 200) },
  });
}
