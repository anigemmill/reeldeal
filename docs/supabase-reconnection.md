# Supabase: reconnecting to the Reeldeal project, plus a live-readiness checklist

Status at 2026-11-17. **Nothing in this document has been run against a live project.** Every check is
read-only. None creates users, changes settings or applies migrations.

## 1. Where things stand

**Confirmed by you (2026-11-17): the Reeldeal project reference is `jzshbaqfrrgsyiciuzfe`.** Every
check is pinned to it. `infra:check` and `scripts/compare-live-schema.sh` refuse any other project
before connecting.

| Item | State (2026-11-17, re-checked) |
|---|---|
| Project `jzshbaqfrrgsyiciuzfe` | **Exists and is reachable**: `https://jzshbaqfrrgsyiciuzfe.supabase.co/auth/v1/health` answers 401 "No API key", as it should without a key. Nothing else can be checked without access |
| Supabase connector | **Still signed in to a different organisation** (`hjdbuvhakmohyqdvuzkn`). It lists `accounts-dev` and an inactive Tokyo project, and refuses `jzshbaqfrrgsyiciuzfe` ("You do not have permission"). Neither of those projects is Reeldeal's, and neither was queried |
| `NEXT_PUBLIC_SUPABASE_URL`, publishable key, `DATABASE_URL`, `SUPABASE_ACCESS_TOKEN` | Not set in this environment |
| Last successful read-only view (earlier session, through the then-correct connector) | `reeldeal`, Sydney, Postgres 17; 7/7 migrations; empty tables; RLS on all 17 public tables |

## 2. What to provide to reconnect (pick A or B)

### A. Re-link the connector (recommended)

1. Go to https://claude.ai/customize/connectors → Supabase → Disconnect.
2. Connect again and sign in to the Supabase account that **owns `jzshbaqfrrgsyiciuzfe`**. If you
   use several Supabase accounts, check in supabase.com → Organisations which one lists that project
   first.
3. When Supabase asks which organisation to allow, choose only the one containing
   `jzshbaqfrrgsyiciuzfe`. Don't include an organisation that holds Findable.
4. **Start a new session** (connectors are read when a session starts) and ask me to run the
   verification. My first call will be `list_projects`, and I'll stop unless the reference matches
   `jzshbaqfrrgsyiciuzfe` exactly.

### B. Environment values (no connector)

Add these as environment variables or secrets for this cloud environment. Never paste them in chat.

| Name | Where to find it | Secret? | Used for |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Project Settings → API → Project URL (`https://jzshbaqfrrgsyiciuzfe.supabase.co`) | No | Auth health, public settings, JWKS |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Project Settings → API Keys → publishable key (`sb_publishable_…`) or legacy anon key | No (browser-safe, RLS applies) | Same |
| `DATABASE_URL` (optional) | Connect → Session pooler, user `postgres.jzshbaqfrrgsyiciuzfe`. **Read-only use only** in this stage | **Yes** | Migrations, RLS, grants, roles checks |
| `SUPABASE_ACCESS_TOKEN` (optional) | supabase.com → Account → Access Tokens. Create one with a short expiry and revoke it afterwards | **Yes** (account-wide) | The Management API GETs for auth configuration |

Never needed here: the **service-role / secret key**. Nothing in these checks uses it.

I'll verify these by name and length only. Values are never printed.

## 3. What I run once access exists (all read-only)

1. Connector: `list_projects` and `get_project`. The reference must equal `jzshbaqfrrgsyiciuzfe`;
   record the name, region, status, Postgres version and database host.
2. `list_migrations` and `list_tables`, plus the security and performance advisors.
3. `supabase/checks/live-readonly-verification.sql`: identity, both migration trackers, tables with
   RLS and row counts, exact customer-data counts, objects 1117/1118/1119 would create (expected
   absent), policies, unexpected grants and callable functions, default privileges, login and RLS
   bypass roles, the column inventory, the Auth schema version and extensions. SELECT only;
   tested on the local stack. Through `psql` it runs inside `begin read only … rollback`.
4. `npm run infra:check` (with the URL and publishable key, and optionally `DATABASE_URL` and
   `SUPABASE_ACCESS_TOKEN`).
5. `bash scripts/compare-live-schema.sh` (with `DATABASE_URL`): diffs the live columns and policies
   against the schema the 7 applied migrations produce. The baseline is built from the repo's own
   files on a scratch database (`supabase/checks/expected-20261116000003`). Any line it prints is a
   difference between the live project and the repo.

Not run without approval: migrations 1117, 1118, 1119; any write; auth setting changes; test users.

## 3b. Guard rails in `npm run infra:check`

- The Supabase URL must name `jzshbaqfrrgsyiciuzfe`. Any other project is reported as a failure, and
  the Auth checks don't run against it.
- `DATABASE_URL` must name the Reeldeal project in its host or pooler user name. Otherwise the check
  **doesn't connect at all** (tested with a made-up project ref: refused before connecting).
- `SUPABASE_ACCESS_TOKEN` is read only for that run, used for GET requests to the Reeldeal project
  only, and isn't part of the app's configuration.

## 4. Live-readiness checklist (read-only)

Run `npm run infra:check` with the values from section 2. Each line maps to a result:

| # | Check | Source | Expected |
|---|---|---|---|
| 1 | Project identity | URL ref; Management API project name | `reeldeal`, Sydney, ACTIVE_HEALTHY |
| 2 | Migrations | `reeldeal_meta.migrations` vs repo | 7 applied, 2 pending (1117, 1118: awaiting approval), plus 1119 if approved |
| 3 | Email confirmation | `/auth/v1/settings` (`mailer_autoconfirm`) | false (confirmation required, D10) |
| 4 | Secure email change | Management API | true (both addresses confirm) |
| 5 | Site URL | Management API | The app URL, not localhost (before launch) |
| 6 | Redirect URLs | Management API | Exact `…/auth/callback` URLs only, no wildcards |
| 7 | Providers | settings plus Management API | Email only (D1) |
| 8 | Custom SMTP | Management API (`smtp_host`) | Resend, once DNS is approved (currently expected: not set) |
| 9 | Auth rate limits and password length | Management API | Recorded; password at least 8 |
| 10 | Auth version | `/auth/v1/health` | Compared with local `v2.180.0`; if different, run the live account test plan (`docs/auth.md`) |
| 11 | Auth schema version | `auth.schema_migrations` | Recorded against local `20250904133000` |
| 12 | Database roles | `pg_roles` | `reeldeal_web` / `reeldeal_worker` absent until 1117 is applied |
| 13 | RLS on every public table | `pg_class.relrowsecurity` | 0 tables without RLS |
| 14 | Unexpected public permissions | `role_table_grants`; executable public functions; private schema usage | 0 anon grants, 0 TRUNCATE for users, no callable public functions, anon has no private usage |
| 15 | Unexpected tables | public tables vs `EXPECTED_TABLES` | None |
| 16 | JWT signing keys | JWKS | Recorded (needed before MCP OAuth) |

### Extra read-only SQL (if you run it in the SQL editor instead)

```sql
-- policies per table (expect every Reeldeal table listed, none "to public using (true)")
select tablename, policyname, roles, cmd, qual from pg_policies where schemaname = 'public' order by 1, 2;
-- default privileges that would grant future tables to anon
select defaclrole::regrole, defaclnamespace::regnamespace, defaclacl from pg_default_acl;
-- who can log in, bypass RLS, or is superuser
select rolname, rolcanlogin, rolbypassrls, rolsuper from pg_roles where rolname !~ '^pg_' order by 1;
-- row counts (expect 0 customer rows before the first pilot)
select relname, n_live_tup from pg_stat_user_tables where schemaname = 'public' order by 1;
```

## 5. Not done without your approval

- No live migrations (1117, 1118, 1119).
- No test customers or sign-ups on the live project. The live account test plan (`docs/auth.md`)
  needs your go-ahead and a test mailbox you own.
- No auth setting changes (SMTP, site URL, redirect URLs).
