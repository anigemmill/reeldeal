import type { Db } from "./types";

/*
  Which database login a hosted service must use (migration 20261117000001, docs/database-credentials.md):
    web     Next.js app and /api/mcp → reeldeal_web
    worker  FFmpeg worker           → reeldeal_worker
    admin   migrations and the owner's own scripts → the owner (postgres): no check

  A production web app or worker connected as the owner would bypass RLS for every trusted query
  (postgres has BYPASSRLS and CREATEROLE), so a mistake in DATABASE_URL is refused at start-up
  rather than discovered later. DATABASE_ROLE_CHECK=warn downgrades the refusal to a warning. It's
  meant only for the short window before the role passwords are set, and is reported by infra:check.
*/
export type ServiceKind = "web" | "worker" | "admin";
export const EXPECTED_DB_ROLE: Record<Exclude<ServiceKind, "admin">, string> = { web: "reeldeal_web", worker: "reeldeal_worker" };

export type RoleCheck = { ok: boolean; login: string; bypassesRls: boolean; superuser: boolean; expected: string | null; message: string };

/**
 * The login role of this connection (session_user, which Supabase's pooler maps from
 * "<role>.<project-ref>"), compared with what the service should use.
 */
export async function checkDatabaseRole(db: Db, service: ServiceKind): Promise<RoleCheck> {
  const [r] = await db.system((sql) =>
    sql.query<{ login: string; bypass: boolean; superuser: boolean }>(
      "select session_user::text as login, r.rolbypassrls as bypass, r.rolsuper as superuser from pg_roles r where r.rolname = session_user",
    ),
  );
  const login = r?.login ?? "unknown";
  const bypassesRls = Boolean(r?.bypass);
  const superuser = Boolean(r?.superuser);
  if (service === "admin") return { ok: true, login, bypassesRls, superuser, expected: null, message: `admin connection as ${login}` };
  const expected = EXPECTED_DB_ROLE[service];
  if (login === expected && !bypassesRls && !superuser) return { ok: true, login, bypassesRls, superuser, expected, message: `${service} connects as ${login} (restricted role)` };
  const why = login === expected ? `${login} has ${superuser ? "superuser" : "BYPASSRLS"}, which the restricted role must never have` : `connected as ${login}${bypassesRls ? " (bypasses RLS)" : ""}`;
  return { ok: false, login, bypassesRls, superuser, expected, message: `The ${service} service must connect as ${expected}, but ${why}. Fix DATABASE_URL (docs/database-credentials.md).` };
}

/**
 * Start-up rule. Only production is checked: local development and tests use the owner or an
 * embedded database on purpose. "warn" logs and continues; anything else refuses to start.
 */
export async function enforceDatabaseRole(db: Db, service: ServiceKind, opts: { production: boolean; mode: "enforce" | "warn"; warn: (msg: string, data?: Record<string, unknown>) => void }) {
  if (!opts.production || service === "admin" || db.driver !== "postgres") return null;
  const c = await checkDatabaseRole(db, service);
  if (c.ok) return c;
  if (opts.mode === "warn") {
    opts.warn("database role check failed (DATABASE_ROLE_CHECK=warn: continuing)", { service, login: c.login, expected: c.expected });
    return c;
  }
  throw new Error(c.message);
}
