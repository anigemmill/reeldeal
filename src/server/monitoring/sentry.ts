import { randomUUID } from "node:crypto";
import { redact } from "../log";

/*
  Error reporting to Sentry (docs/monitoring.md). Prepared, OFF until SENTRY_DSN is set: no Sentry
  project exists yet and creating one needs approval. Dependency-free: one HTTPS POST of a Sentry
  "envelope" per event, so nothing is bundled into browser code and nothing loads unless enabled.

  What is sent: the error type, message and stack (file paths and function names), a few tags
  (service, route pattern, job kind) and safe numeric or id context.
  What is NEVER sent: request bodies, server-action arguments, cookies, headers, query strings,
  email addresses, tokens or keys. Everything passes the logger's redaction plus an email and
  token scrubber, and context keys are allow-listed.
*/
export type MonitorConfig = { dsn?: string; environment: string; release: string; sampleRate?: number };
export type ErrorContext = { service: "web" | "worker" | "mcp" | "browser"; tags?: Record<string, string | number | boolean | null | undefined>; extra?: Record<string, unknown> };

const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
// Our own token formats plus common key shapes (Supabase secret keys, Resend, Stripe, AWS, JWTs).
const TOKENS = /\b(rdl_(?:pat|inv)_[A-Za-z0-9_-]+|sb_secret_[A-Za-z0-9_-]+|re_[A-Za-z0-9_]{16,}|sk_(?:live|test)_[A-Za-z0-9]+|AKIA[A-Z0-9]{16}|eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)/g;
/** Context keys that may be sent. Anything else is dropped (no surprise payloads). */
const ALLOWED_EXTRA = new Set(["job_id", "attempt", "max_attempts", "retryable", "stage", "duration_ms", "digest", "route", "status", "org_id", "media_id", "project_id", "storyboard_id"]);

export function scrub(s: string): string {
  return String(redact(s)).replace(TOKENS, "[redacted]").replace(EMAIL, "[email]");
}

/** Route path without a query string or fragment (queries can carry ids, codes or tokens). */
export const safePath = (p: string | undefined) => (p ?? "").split(/[?#]/)[0]!.slice(0, 200);

export function parseDsn(dsn: string): { endpoint: string; key: string } | null {
  try {
    const u = new URL(dsn);
    const project = u.pathname.replace(/^\/+/, "");
    if (!u.username || !/^\d+$/.test(project) || u.protocol !== "https:") return null;
    return { endpoint: `${u.origin}/api/${project}/envelope/`, key: u.username };
  } catch {
    return null;
  }
}

function frames(stack: string | undefined) {
  return (stack ?? "")
    .split("\n")
    .slice(1, 30)
    .map((l) => /at (?:(.+?) \()?(.+?):(\d+):(\d+)\)?$/.exec(l.trim()))
    .filter((m): m is RegExpExecArray => Boolean(m))
    .map((m) => ({ function: m[1] ?? "?", filename: m[2]!.replace(/^.*?\/(src|node_modules|scripts)\//, "$1/"), lineno: Number(m[3]), colno: Number(m[4]), in_app: !m[2]!.includes("node_modules") }))
    .reverse(); // Sentry wants the innermost frame last
}

/** Build the event Sentry receives. Exported for tests: what you see here is everything that leaves. */
export function buildEvent(err: unknown, ctx: ErrorContext, cfg: MonitorConfig) {
  const e = err instanceof Error ? err : new Error(typeof err === "string" ? err : "Non-error thrown");
  const tags: Record<string, string> = { service: ctx.service };
  for (const [k, v] of Object.entries(ctx.tags ?? {})) if (v !== undefined && v !== null) tags[k.slice(0, 32)] = scrub(String(v)).slice(0, 200);
  const extra: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(ctx.extra ?? {})) if (ALLOWED_EXTRA.has(k) && (typeof v !== "object" || v === null)) extra[k] = typeof v === "string" ? scrub(v).slice(0, 300) : v;
  const digest = (err as { digest?: unknown })?.digest;
  if (typeof digest === "string") extra.digest = digest.slice(0, 100);
  return {
    event_id: randomUUID().replace(/-/g, ""),
    timestamp: Date.now() / 1000,
    platform: "node",
    level: "error",
    environment: cfg.environment,
    release: cfg.release,
    tags,
    extra,
    exception: { values: [{ type: e.name || "Error", value: scrub(e.message).slice(0, 1000), stacktrace: { frames: frames(e.stack) } }] },
    // No user, request, contexts.headers or breadcrumbs: they're where personal data leaks from.
  };
}

/** Report one error. Never throws and never blocks longer than 2 s. Returns whether it was sent. */
export async function captureError(err: unknown, ctx: ErrorContext, cfg: MonitorConfig, deps: { fetch?: typeof fetch; random?: () => number } = {}): Promise<boolean> {
  if (!cfg.dsn) return false;
  const target = parseDsn(cfg.dsn);
  if (!target) return false;
  if ((deps.random ?? Math.random)() > (cfg.sampleRate ?? 1)) return false;
  try {
    const event = buildEvent(err, ctx, cfg);
    const body = [JSON.stringify({ event_id: event.event_id, sent_at: new Date().toISOString() }), JSON.stringify({ type: "event" }), JSON.stringify(event)].join("\n");
    const res = await (deps.fetch ?? fetch)(target.endpoint, {
      method: "POST",
      headers: { "content-type": "application/x-sentry-envelope", "x-sentry-auth": `Sentry sentry_version=7, sentry_key=${target.key}, sentry_client=reeldeal/1.0` },
      body,
      signal: AbortSignal.timeout(2000),
    });
    return res.ok;
  } catch {
    return false;
  }
}
