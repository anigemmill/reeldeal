/*
  Read-only readiness check for real infrastructure: npm run infra:check
  Reports what is configured and whether each service accepts the credentials.
  Changes nothing, creates nothing, and never prints a secret value.
*/
import { execFileSync } from "node:child_process";
import { serverEnv as env } from "../src/env/server";
import { publicEnv } from "../src/env/public";
import { pendingMigrations } from "../src/server/db/migrate";
import { createPostgresDb } from "../src/server/db/postgres";
import { createR2Storage } from "../src/server/storage/r2";

/** Every table and view Reeldeal's migrations create in public (anything else is reported). */
const EXPECTED_TABLES = [
  "organisations", "memberships", "api_tokens", "brand_profiles", "brand_profile_versions", "media_assets", "media_uploads", "media_analysis",
  "projects", "project_media", "video_briefs", "video_concepts", "storyboards", "jobs", "exports", "credit_transactions", "profiles",
  "invitations", "audit_events", "rate_limits", "user_preferences", "billing_accounts",
];
/** What the local stack (infra/local) runs, i.e. what the automated tests prove. */
const LOCAL_AUTH_VERSION = "v2.180.0";
const LOCAL_AUTH_SCHEMA = "20250904133000";

type Result = { area: string; status: "ok" | "missing" | "fail" | "warn"; detail: string };
const results: Result[] = [];
const add = (area: string, status: Result["status"], detail: string) => results.push({ area, status, detail });
const safe = (e: unknown) => String((e as Error).message ?? e).replace(/postgres(ql)?:\/\/[^\s]+/g, "postgres://…").slice(0, 160);

async function checkDatabase() {
  if (!env.DATABASE_URL) return add("Supabase database", "missing", "DATABASE_URL not set");
  const u = new URL(env.DATABASE_URL);
  const db = createPostgresDb(env.DATABASE_URL, { max: 1 });
  try {
    const [info] = await db.system((sql) =>
      sql.query<{ version: string; supabase_auth: boolean; role: string; bypass: boolean; member: boolean }>(
        `select current_setting('server_version') as version, to_regclass('auth.identities') is not null as supabase_auth, current_user as role,
                (select rolbypassrls from pg_roles where rolname = current_user) as bypass,
                pg_has_role(current_user, 'authenticated', 'member') as member`,
      ),
    );
    add("Supabase database", "ok", `connected to ${u.hostname}:${u.port || 5432} as ${info.role}, Postgres ${info.version}${u.port === "6543" ? " (transaction pooler)" : ""}`);
    add("Supabase Auth schema", info.supabase_auth ? "ok" : "warn", info.supabase_auth ? "auth.users managed by Supabase Auth" : "not a Supabase database (no auth.identities)");
    add("User-context role", info.member ? "ok" : "fail", info.member ? `${info.role} can switch to "authenticated" (RLS applies to every user request)` : `${info.role} cannot SET ROLE authenticated: use the project's postgres user`);
    const pending = await pendingMigrations(db);
    add("Migrations", pending.length ? "warn" : "ok", pending.length ? `${pending.length} pending: npm run db:migrate -- --plan, then --apply` : "all applied");
    if (!pending.length) {
      const [r] = await db.system((sql) =>
        sql.query<{ no_rls: number; anon: number; truncate: number }>(
          `select (select count(*)::int from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity) as no_rls,
                  (select count(*)::int from information_schema.role_table_grants where grantee = 'anon' and table_schema = 'public') as anon,
                  (select count(*)::int from information_schema.role_table_grants where grantee = 'authenticated' and table_schema = 'public' and privilege_type = 'TRUNCATE') as truncate`,
        ),
      );
      add("RLS and grants", r.no_rls || r.anon || r.truncate ? "fail" : "ok", `${r.no_rls} table(s) without RLS, ${r.anon} anon grant(s), ${r.truncate} TRUNCATE grant(s) to users`);
    }
    // Nothing unexpected exposed: tables we don't know about, functions anyone can call through the
    // Data API, access to the private schemas, and whether the restricted-roles migration is in place.
    const [x] = await db.system((sql) =>
      sql.query<{ unknown_tables: string[] | null; public_functions: string[] | null; private_usage: string[] | null; meta_rls: boolean | null; roles: number; auth_version: string | null }>(
        `select
           (select array_agg(c.relname order by c.relname) from pg_class c join pg_namespace n on n.oid = c.relnamespace
             where n.nspname = 'public' and c.relkind in ('r', 'v', 'm') and c.relname <> all($1::text[])) as unknown_tables,
           (select array_agg(p.proname order by p.proname) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
             where n.nspname = 'public' and (has_function_privilege('anon', p.oid, 'execute') or has_function_privilege('authenticated', p.oid, 'execute'))) as public_functions,
           (select array_agg(r || ' on ' || s) from unnest(array['anon', 'authenticated']) r, unnest(array['private', 'reeldeal_meta']) s
             where to_regnamespace(s) is not null and has_schema_privilege(r, s, 'usage') and not (r = 'authenticated' and s = 'private')) as private_usage,
           (select relrowsecurity from pg_class where oid = to_regclass('reeldeal_meta.migrations')) as meta_rls,
           (select count(*)::int from pg_roles where rolname in ('reeldeal_web', 'reeldeal_worker')) as roles,
           (select max(version)::text from auth.schema_migrations) as auth_version`,
        [EXPECTED_TABLES],
      ),
    );
    add("Unexpected tables", x.unknown_tables?.length ? "warn" : "ok", x.unknown_tables?.length ? `not created by Reeldeal migrations: ${x.unknown_tables.join(", ")}` : "only Reeldeal's own tables in public");
    add("Callable functions", x.public_functions?.length ? "warn" : "ok", x.public_functions?.length ? `public functions anon/authenticated can execute: ${x.public_functions.join(", ")}` : "no public functions callable by anon or signed-in users");
    add("Private schemas", x.private_usage?.length ? "fail" : "ok", x.private_usage?.length ? `unexpected access: ${x.private_usage.join(", ")}` : "anon has no access to private or reeldeal_meta; authenticated only uses private for policy checks");
    add("Restricted runtime roles", x.roles === 2 ? "ok" : "warn", x.roles === 2 ? "reeldeal_web and reeldeal_worker exist (migration 20261117000001 applied)" : "not created: migration 20261117000001 not applied (awaiting approval)");
    add("Auth schema version", "ok", `auth.schema_migrations latest ${x.auth_version ?? "unknown"} (local stack: ${LOCAL_AUTH_SCHEMA})`);
  } catch (e) {
    add("Supabase database", "fail", safe(e));
  } finally {
    await db.close();
  }
}

async function checkAuth() {
  const url = publicEnv.NEXT_PUBLIC_SUPABASE_URL;
  const key = publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return add("Supabase Auth API", "missing", "NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY not set");
  try {
    const health = await fetch(`${url}/auth/v1/health`, { headers: { apikey: key } });
    const h = health.ok ? ((await health.json()) as { version?: string }) : {};
    add("Supabase Auth API", health.ok ? "ok" : "fail", `health HTTP ${health.status}${h.version ? `, Supabase Auth ${h.version}` : ""}`);
    if (h.version) {
      const same = h.version === LOCAL_AUTH_VERSION;
      add("Auth version vs local", same ? "ok" : "warn", same ? `same as the local test stack (${LOCAL_AUTH_VERSION})` : `live ${h.version}, local tests ran on ${LOCAL_AUTH_VERSION}: re-run the account flows against this project (docs/auth.md, live test plan)`);
    }
    // Public settings endpoint: which sign-in methods are on and whether email confirmation is required (D10).
    const settings = await fetch(`${url}/auth/v1/settings`, { headers: { apikey: key } });
    if (settings.ok) {
      const st = (await settings.json()) as { external: Record<string, boolean>; disable_signup: boolean; mailer_autoconfirm: boolean };
      const providers = Object.entries(st.external).filter(([, on]) => on).map(([p]) => p);
      add("Email confirmation", st.mailer_autoconfirm ? "fail" : "ok", st.mailer_autoconfirm ? "OFF: new accounts are confirmed automatically (turn on Confirm email; D10)" : "required before sign-in (D10)");
      add("Sign-in methods", providers.every((p) => p === "email") ? "ok" : "warn", `enabled: ${providers.join(", ") || "none"}${st.disable_signup ? "; sign-ups disabled" : ""}`);
    } else add("Auth settings", "warn", `settings HTTP ${settings.status}`);
    add("Auth settings not readable here", "warn", "site URL, redirect URLs, SMTP, secure email change and rate limits are dashboard-only: check them against docs/email-resend.md section 6");
    const jwks = await fetch(`${url}/auth/v1/.well-known/jwks.json`, { headers: { apikey: key } });
    const keys = jwks.ok ? ((await jwks.json()) as { keys: unknown[] }).keys.length : 0;
    add("Supabase signing keys (JWKS)", keys ? "ok" : "warn", keys ? `${keys} public key(s)` : "no asymmetric keys published (enable JWT signing keys before OAuth)");
  } catch (e) {
    add("Supabase Auth API", "fail", safe(e));
  }
  if (env.SUPABASE_JWT_ISSUER && env.SUPABASE_JWKS_URL) add("Remote MCP OAuth", "ok", "resource server configured (authorisation server must also be enabled in Supabase)");
  else add("Remote MCP OAuth", "missing", "SUPABASE_JWT_ISSUER / SUPABASE_JWKS_URL not set: remote MCP stays development-only (expected for now)");
}

async function checkStorage() {
  if (!(env.R2_ACCOUNT_ID && env.R2_ACCESS_KEY_ID && env.R2_SECRET_ACCESS_KEY && env.R2_BUCKET)) return add("Cloudflare R2", "missing", "R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET not all set");
  const s = createR2Storage({ accountId: env.R2_ACCOUNT_ID, accessKeyId: env.R2_ACCESS_KEY_ID, secretAccessKey: env.R2_SECRET_ACCESS_KEY, bucket: env.R2_BUCKET, endpoint: env.R2_ENDPOINT, region: env.R2_REGION });
  try {
    // A HEAD on a key that cannot exist: 404 means the credentials and bucket are right.
    const missing = await s.head("org/00000000-0000-4000-8000-000000000000/media/readiness-check/original.mp4");
    add("Cloudflare R2", missing === null ? "ok" : "warn", `bucket "${env.R2_BUCKET}" reachable with these credentials (read-only check)`);
    const anon = await fetch(`${env.R2_ENDPOINT ?? `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`}/${env.R2_BUCKET}/org/00000000-0000-4000-8000-000000000000/media/x`);
    add("R2 bucket is private", anon.status === 400 || anon.status === 401 || anon.status === 403 ? "ok" : "fail", `unsigned request answered HTTP ${anon.status}`);
  } catch (e) {
    add("Cloudflare R2", "fail", safe(e));
  }
}

async function checkAi() {
  if (!env.OPENAI_API_KEY) return add("OpenAI", "missing", "OPENAI_API_KEY not set: AI tools are hidden");
  try {
    const res = await fetch(`${env.OPENAI_BASE_URL ?? "https://api.openai.com/v1"}/models`, { headers: { authorization: `Bearer ${env.OPENAI_API_KEY}` } });
    add("OpenAI", res.ok ? "ok" : "fail", `models endpoint HTTP ${res.status} (no tokens spent); model ${env.OPENAI_MODEL}`);
  } catch (e) {
    add("OpenAI", "fail", safe(e));
  }
}

function checkLocal() {
  add("SIGNING_SECRET", env.SIGNING_SECRET ? "ok" : "missing", env.SIGNING_SECRET ? `set (${env.SIGNING_SECRET.length} characters)` : "not set: required for quotes and signed links");
  for (const [name, bin] of [["FFmpeg", env.FFMPEG_PATH], ["FFprobe", env.FFPROBE_PATH]] as const) {
    try {
      const v = execFileSync(bin, ["-version"], { encoding: "utf8" }).split("\n")[0];
      add(name, "ok", v.slice(0, 60));
    } catch {
      add(name, "missing", `${bin} not found (needed on worker hosts only)`);
    }
  }
}

async function main() {
  checkLocal();
  await checkDatabase();
  await checkAuth();
  await checkStorage();
  await checkAi();
  const icon = { ok: "✓", missing: "–", fail: "✗", warn: "!" };
  const w = Math.max(...results.map((r) => r.area.length));
  for (const r of results) console.log(`${icon[r.status]} ${r.area.padEnd(w)}  ${r.detail}`);
  if (results.some((r) => r.status === "fail")) process.exitCode = 1;
}
main();
