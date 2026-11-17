import { createHmac } from "node:crypto";
import type { Platform } from "../context";

/*
  App-side limits on the unauthenticated auth actions (docs/auth.md, "Rate limits").

  Why here: the web app calls Supabase Auth from its own server, so Supabase sees a handful
  of server IP addresses, not each customer's. Its per-IP limits therefore throttle every
  customer together, while doing little against one attacker. These limits key on the
  CLIENT (the visitor's IP from the hosting platform's trusted header) and on the target
  email address, before Supabase is called. Supabase's own limits stay on as a backstop.

  Keys are HMACs (SIGNING_SECRET), so neither emails nor IPs are stored. Backed by a small
  Postgres table (migration 20261118000001): no extra service. If the database can't be
  reached the check fails open (and logs), leaving Supabase's limits as the protection,
  rather than locking every customer out.
*/
export type AuthAction = "sign_in" | "sign_up" | "password_reset" | "resend";

/** Attempts per window. Per-IP limits allow a busy office or campus behind one IP. */
export const AUTH_LIMITS: Record<AuthAction, { ip: [number, number]; email: [number, number] }> = {
  sign_in: { ip: [30, 300], email: [10, 900] }, // 30 / 5 min per IP; 10 / 15 min per account
  sign_up: { ip: [10, 3600], email: [3, 3600] },
  password_reset: { ip: [10, 3600], email: [3, 3600] },
  resend: { ip: [10, 3600], email: [5, 3600] },
};

export const isLoopback = (ip: string) => ip === "::1" || ip.startsWith("127.") || ip === "::ffff:127.0.0.1" || ip === "localhost";

export const keyFor = (secret: string, action: AuthAction, kind: "ip" | "email", value: string) =>
  `${action}:${kind}:${createHmac("sha256", secret).update(value.trim().toLowerCase()).digest("base64url").slice(0, 32)}`;

/** Count this attempt. Returns { ok: false } when any applicable limit is exceeded. */
export async function checkAuthRateLimit(p: Platform, action: AuthAction, who: { ip: string | null; email?: string | null }): Promise<{ ok: boolean; reason?: "ip" | "email" }> {
  const lim = AUTH_LIMITS[action];
  const checks: ["ip" | "email", string, [number, number]][] = [];
  // Loopback is local development and tests (production always has the visitor's address).
  if (who.ip && !isLoopback(who.ip)) checks.push(["ip", who.ip, lim.ip]);
  if (who.email) checks.push(["email", who.email, lim.email]);
  try {
    for (const [kind, value, [max, seconds]] of checks) {
      const [r] = await p.db.system((sql) => sql.query<{ ok: boolean }>("select private.rate_limit_hit($1, $2, $3) as ok", [keyFor(p.signingSecret, action, kind, value), max, seconds]));
      if (!r?.ok) return { ok: false, reason: kind };
    }
    return { ok: true };
  } catch (e) {
    p.log.warn("auth rate limit unavailable; relying on Supabase Auth limits", { action, error: (e as Error).message });
    return { ok: true };
  }
}

/**
 * The visitor's IP as reported by the hosting platform. On Vercel x-real-ip / x-forwarded-for are
 * set by the platform's edge, not the browser. Elsewhere, configure the proxy to set them.
 */
export function clientIp(h: { get(name: string): string | null }): string | null {
  const real = h.get("x-real-ip")?.trim();
  if (real) return real;
  const fwd = h.get("x-forwarded-for")?.split(",")[0]?.trim();
  return fwd || null;
}
