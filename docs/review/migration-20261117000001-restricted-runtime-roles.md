# Migration review: restricted runtime roles (`20261117000001`)

> **Update 2026-11-18: APPLIED to the live project** (07:35:56 UTC). See `docs/review/migration-execution-record-2026-11-18.md`. The roles still have no passwords: `docs/database-credentials.md`. The review below is kept as approved.

**Status: prepared and tested locally. NOT applied to the live `reeldeal` project.** Applying it needs
your explicit approval (D2). This document covers what changes, the impact, how it was tested, how to
apply it, and how to roll it back. The complete SQL is at the end, verbatim.

## Why

Every service currently connects to Postgres as the owner (`postgres`). On Supabase that login has
`BYPASSRLS` and `CREATEROLE` (checked live, read-only). User requests already switch to
`authenticated`, so Row Level Security applies to them. But the trusted server code (`db.system()`:
about 30 call sites) runs with full owner rights inside an internet-facing process. One bug or injection
there could read or change any organisation's data. That is audit finding S2. This migration also
clears the Supabase advisor warning on `reeldeal_meta.migrations` (S9).

## What changes

**New roles.** Both are `NOLOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS`. They own
nothing, and nobody can connect as them until you set a password by hand.

| Role | Used by | Can act as a signed-in user? |
|---|---|---|
| `reeldeal_web` | Next.js app and `/api/mcp` | Yes (`grant authenticated to reeldeal_web`), and then all existing RLS policies apply exactly as today |
| `reeldeal_worker` | FFmpeg worker | No |

**`reeldeal_web`, acting as itself.** These are the only server-owned writes the web app makes.
Policy limits are in brackets.

| Table | Read | Write |
|---|---|---|
| organisations | ✓ | insert name, slug, plan_id (**plan must be `free`**) |
| memberships | ✓ | insert (**only the first member of a new workspace, as owner**) |
| api_tokens | ✓ (needed to verify tokens) | insert (not revoked); update `last_used_at`, `revoked_at` only |
| credit_transactions | ✓ | insert (**grants: video, positive; holds: negative only**) |
| jobs | ✓ | insert (**status `queued` only**) |
| media_uploads | ✓ | insert; update `completed_at` |
| media_assets | ✓ | update `status`, `size_bytes` (**status `uploaded`, `failed` or `analysing` only**) |
| projects | ✓ | update `status` (**`rendering` only**) |

Everything else is refused as itself, including:

- changing a plan, adding or changing members, charges, releases, refunds and adjustments
- writing analysis or exports, marking media ready or jobs succeeded, changing storage keys
- any DELETE or TRUNCATE
- `auth.users`, `profiles`, `reeldeal_meta`
- creating roles

**`reeldeal_worker`.**

| Table | Read | Write |
|---|---|---|
| organisations, brand_profiles, storyboards, media_analysis, exports | ✓ | analysis and exports: insert only |
| jobs | ✓ | update the run columns (status, stage, progress, result, error, lock, heartbeat, timings) |
| media_assets | ✓ | update status, duration, width, height, ai_tags |
| projects | ✓ | update status (**`completed` or `ready_to_render` only**) |
| credit_transactions | ✓ | insert (**charges: negative; releases: positive only**) |

No access to tokens, memberships, profiles or `auth.users`. It cannot grant credits, queue jobs,
delete anything or switch to `authenticated`.

**Helper access.** Both roles get usage on schemas `public` and `private`, and execute on the two helper
functions that generated columns and triggers call.

**`reeldeal_meta`.** Access is revoked from `public`, `anon` and `authenticated`, and RLS is enabled on
`reeldeal_meta.migrations`. The live check showed none of those roles had access to the schema anyway,
so this is explicit hardening. The owner bypasses RLS, so `npm run db:migrate` is unaffected.

**Unchanged:**

- every existing policy, grant, table and row
- the `authenticated` and `anon` roles
- Supabase Auth
- the owner login

**Code change shipped with it.** Workspace creation no longer reads `auth.users` (the web role can't).
The membership's foreign key to `auth.users` does the same check, and its failure maps to the same
"Your account was not found" message (`src/server/services/account.ts`).

## Impact

- **Right now: none.** Nothing is deployed and the project has no users or workspaces (checked live).
  Applying the migration only creates two roles that cannot log in, plus their grants and policies.
- **When services move to the roles** (a separate step, by changing `DATABASE_URL`):
  - The hosted app uses `reeldeal_web` and the hosted worker uses `reeldeal_worker`.
  - Your owner-only scripts keep the owner login on your own computer: `db:migrate`,
    `workspace:bootstrap`, `mcp:token`, `integration:live`, `dev:setup`, `infra:check`.
- **Risk: a missing grant would break one feature with "permission denied".** Mitigations:
  - the new test drives every server-owned path through the real services and the real worker as these roles
  - a deliberate mutation test (one grant removed) failed as expected
  - the full browser journey passed with the app and worker logged in as the roles
- **Future migrations:** a new server-written table or column needs grants for these roles in the same
  migration. `restricted-roles.test.ts` fails if one is missing on a tested path.

## How it was tested

These are all local results. Nothing below ran against the live project.

| Test | Database | Result |
|---|---|---|
| `npm test` (whole suite, incl. new `restricted-roles.test.ts`) | PGlite (embedded) | 210 passed, 10 skipped |
| Whole suite on Supabase's own image | `supabase/postgres:17.6.1.166` | 207 passed, 8 skipped |
| `src/server/db` incl. **real logins** as both roles | `supabase/postgres` | 50 passed |
| Mutation check: worker's `media_analysis` insert grant removed | PGlite | Journey test failed as expected; grant restored |
| Browser journey (`npm run test:e2e`) with **the app running as `reeldeal_web` and the worker as `reeldeal_worker`** | Local stack: `supabase/postgres` + Supabase Auth (GoTrue) + MinIO + mail catcher | 55 of 56 checks. The one failure is an axe `document-title` check on the media detail view; it passed in the run before, and is a timing flake unrelated to this change. 0 permission errors in either process log |

The real-login tests prove `reeldeal_web` can switch to `authenticated` and sees only its own workspace
under RLS, and that `reeldeal_worker` is refused (`permission denied to set role`).

Two Supabase-specific behaviours turned up during testing; both are handled:

1. On Supabase, `postgres` is not a superuser. Creating a role gives it **admin** over the role (so it can
   set the password) but not membership. That is correct for production. Do **not** revoke `postgres`'s
   grant on these roles: doing so removes its ability to manage them, and only Supabase support could
   restore it.
2. `SET ROLE` is checked against the *login* user. So "the worker cannot become `authenticated`" can only
   be proven with a real login, which the test does.

## How to apply (after your approval)

1. Plan, against the live project with your owner connection on your own computer (changes nothing):
   `npm run db:migrate -- --plan` should list exactly `20261117000001_restricted_runtime_roles.sql`.
2. Apply: `npm run db:migrate -- --apply`. Alternatively I can apply it with the Supabase tool, once you
   approve. Either way it runs in one transaction: all or nothing.
3. Check: `npm run infra:check` and the Supabase security advisor. Expect no `reeldeal_meta` warning, and
   `media_uploads` "no policy" also gone (it now has server-role policies).
4. Set the passwords: this happens only when we first deploy, not at apply time. In the Supabase SQL
   editor (or psql as `postgres`), using a generated password kept in your password manager or the
   host's secret store:
   `alter role reeldeal_web with login password '…';` and the same for `reeldeal_worker`.
5. Connection strings for the hosts, through the Supabase pooler:
   - user `reeldeal_web.jzshbaqfrrgsyiciuzfe`, port **6543** (transaction mode) for Vercel
   - user `reeldeal_worker.jzshbaqfrrgsyiciuzfe`, port 5432 for the worker

## How to roll back

- **Before any service uses the roles:** run
  `supabase/rollback/20261117000001_restricted_runtime_roles.down.sql` as the owner, in one transaction
  (`psql -1`). It:
  - drops the role-specific policies
  - revokes every grant
  - drops both roles
  - disables RLS on `reeldeal_meta.migrations`
  - removes the migration record

  It touches no customer data.

  Tested locally on the database that had just run the full browser journey (4 workspaces, 23 ledger
  rows): rollback → re-apply → rollback → re-apply. Each time it went cleanly to 0 roles and 0 policies
  and back to 2 and 33, and the data was identical throughout.

  Roles are shared by every database on a server. If any *other* database on the same server still uses
  them, `drop role` refuses and the whole rollback is undone (seen locally with leftover test databases).
  The live project has one database, so this does not apply there.
- **After services use the roles:** first point `DATABASE_URL` back at the owner login and restart the
  services, then run the rollback. While a session is still connected as a role, `drop role` fails and the
  whole rollback is undone, which is a safe failure.
- **Faster partial rollback, with no SQL:** switch `DATABASE_URL` back to the owner. The roles can stay in
  place unused.

## The migration (verbatim)

```sql
-- Restricted database roles for the running services (docs/production-plan.md, S2 and S9).
--
-- Today every service connects as the database owner (`postgres` on Supabase:
-- BYPASSRLS, CREATEROLE). User requests already switch to `authenticated` under RLS,
-- but trusted server work (db.system()) runs with full owner rights. After this
-- migration the hosted services can connect as:
--
--   reeldeal_web     Next.js app and /api/mcp. May switch to `authenticated` for user
--                    work (RLS applies) and, as itself, only do the few server-owned
--                    writes the web app needs: create a workspace (Free plan, first
--                    owner), the period's credit grant and render holds, queue jobs,
--                    track uploads, and verify/record personal access tokens.
--   reeldeal_worker  The FFmpeg worker. Claims and updates jobs; writes analysis,
--                    exports, charges and releases. No access to tokens, memberships,
--                    profiles or auth.
--
-- Neither role owns tables, bypasses RLS, can create roles, delete rows, read
-- auth.users, change a plan, or write another table. The owner connection stays
-- for migrations and the owner's own admin scripts only.
--
-- This migration is additive and changes no data. Both roles are created NOLOGIN:
-- nothing can connect as them until the owner sets a password by hand (never in git):
--   alter role reeldeal_web with login;    \password reeldeal_web
--   alter role reeldeal_worker with login; \password reeldeal_worker
-- Rollback: supabase/rollback/20261117000001_restricted_runtime_roles.down.sql

/* ------------------------------------------------------------------ roles */

do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'reeldeal_web') then
    create role reeldeal_web nologin noinherit nosuperuser nocreatedb nocreaterole nobypassrls;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'reeldeal_worker') then
    create role reeldeal_worker nologin noinherit nosuperuser nocreatedb nocreaterole nobypassrls;
  end if;
end $$;

-- The web role may SET ROLE authenticated for user requests (Db.asUser). NOINHERIT:
-- it does not get authenticated's privileges unless it actually switches.
grant authenticated to reeldeal_web;

grant usage on schema public to reeldeal_web, reeldeal_worker;
-- Generated columns and triggers on the tables below call these helpers.
grant usage on schema private to reeldeal_web, reeldeal_worker;
grant execute on function private.tags_text(text[]), private.set_updated_at() to reeldeal_web, reeldeal_worker;

/* -------------------------------------------------- reeldeal_web: grants */

grant select on public.organisations, public.memberships, public.api_tokens, public.credit_transactions,
  public.jobs, public.media_uploads, public.media_assets, public.projects to reeldeal_web;

grant insert (name, slug, plan_id) on public.organisations to reeldeal_web;
grant insert (org_id, user_id, role) on public.memberships to reeldeal_web;
grant insert (user_id, org_id, name, token_prefix, token_hash, scopes, expires_at) on public.api_tokens to reeldeal_web;
grant update (last_used_at, revoked_at) on public.api_tokens to reeldeal_web;
grant insert (org_id, wallet, kind, amount, period, job_id, note) on public.credit_transactions to reeldeal_web;
grant insert (org_id, kind, idempotency_key, input, project_id, media_id, created_by, credits_held, retry_of, attempt) on public.jobs to reeldeal_web;
grant insert (media_id, org_id, upload_id, part_size_bytes, part_count) on public.media_uploads to reeldeal_web;
grant update (completed_at) on public.media_uploads to reeldeal_web;
grant update (status, size_bytes) on public.media_assets to reeldeal_web;
grant update (status) on public.projects to reeldeal_web;

/* ------------------------------------------------ reeldeal_web: policies */

-- Reads: the server looks rows up by id it has already authorised in user context.
create policy "server web reads" on public.organisations for select to reeldeal_web using (true);
create policy "server web reads" on public.memberships for select to reeldeal_web using (true);
create policy "server web reads" on public.api_tokens for select to reeldeal_web using (true);
create policy "server web reads" on public.credit_transactions for select to reeldeal_web using (true);
create policy "server web reads" on public.jobs for select to reeldeal_web using (true);
create policy "server web reads" on public.media_uploads for select to reeldeal_web using (true);
create policy "server web reads" on public.media_assets for select to reeldeal_web using (true);
create policy "server web reads" on public.projects for select to reeldeal_web using (true);

-- New workspaces always start on Free; plans change only through billing (owner connection today).
create policy "server web creates free workspaces" on public.organisations for insert to reeldeal_web
  with check (plan_id = 'free');
-- The web app only ever adds the first member of a new workspace, as its owner.
-- Every other membership change will go through reviewed security-definer functions.
create policy "server web adds first owner" on public.memberships for insert to reeldeal_web
  with check (role = 'owner' and not exists (select 1 from public.memberships m where m.org_id = memberships.org_id));
create policy "server web creates tokens" on public.api_tokens for insert to reeldeal_web
  with check (revoked_at is null);
create policy "server web records token use" on public.api_tokens for update to reeldeal_web using (true) with check (true);
-- Grants (positive, video) and holds (negative). Charges, releases and refunds are the worker's.
create policy "server web grants and holds" on public.credit_transactions for insert to reeldeal_web
  with check ((kind = 'grant' and wallet = 'video' and amount > 0) or (kind = 'hold' and amount < 0));
create policy "server web queues jobs" on public.jobs for insert to reeldeal_web
  with check (status = 'queued');
create policy "server web tracks uploads" on public.media_uploads for insert to reeldeal_web with check (true);
create policy "server web completes uploads" on public.media_uploads for update to reeldeal_web using (true) with check (true);
-- Upload completion, abandoned uploads, and queuing analysis. 'ready' is the worker's.
create policy "server web sets upload status" on public.media_assets for update to reeldeal_web
  using (true) with check (status in ('uploaded', 'failed', 'analysing'));
create policy "server web marks rendering" on public.projects for update to reeldeal_web
  using (true) with check (status = 'rendering');

/* ----------------------------------------------- reeldeal_worker: grants */

grant select on public.organisations, public.brand_profiles, public.media_assets, public.projects,
  public.storyboards, public.jobs, public.credit_transactions, public.media_analysis, public.exports to reeldeal_worker;

grant update (status, stage, progress, result, error, attempt, claim_count, locked_by, started_at, heartbeat_at, finished_at)
  on public.jobs to reeldeal_worker;
grant update (status, duration_seconds, width, height, ai_tags) on public.media_assets to reeldeal_worker;
grant update (status) on public.projects to reeldeal_worker;
grant insert (org_id, media_id, job_id, technical, scenes, quality, ai) on public.media_analysis to reeldeal_worker;
grant insert (id, org_id, project_id, job_id, storyboard_id, format, status, storage_key, mime_type, size_bytes, duration_seconds, width, height)
  on public.exports to reeldeal_worker;
grant insert (org_id, wallet, kind, amount, period, job_id, note) on public.credit_transactions to reeldeal_worker;

/* --------------------------------------------- reeldeal_worker: policies */

do $$
declare t text;
begin
  foreach t in array array['organisations', 'brand_profiles', 'media_assets', 'projects', 'storyboards', 'jobs', 'credit_transactions', 'media_analysis', 'exports'] loop
    execute format('create policy "server worker reads" on public.%I for select to reeldeal_worker using (true)', t);
  end loop;
end $$;

create policy "server worker runs jobs" on public.jobs for update to reeldeal_worker using (true) with check (true);
create policy "server worker finishes media" on public.media_assets for update to reeldeal_worker using (true) with check (true);
-- Render outcome only; the web app sets 'rendering'.
create policy "server worker finishes projects" on public.projects for update to reeldeal_worker
  using (true) with check (status in ('completed', 'ready_to_render'));
create policy "server worker writes analysis" on public.media_analysis for insert to reeldeal_worker with check (true);
create policy "server worker writes exports" on public.exports for insert to reeldeal_worker with check (true);
-- Charges (negative) and releases (positive, returning a hold). Never grants.
create policy "server worker charges and releases" on public.credit_transactions for insert to reeldeal_worker
  with check ((kind = 'charge' and amount < 0) or (kind = 'release' and amount > 0));

/* ------------------------------------- migration bookkeeping (advisor S9) */

-- Not reachable today (verified live: anon and authenticated have no USAGE on the schema,
-- and it is not exposed through the Data API). This makes it explicit and silences the
-- Supabase advisor. The owner bypasses RLS, so npm run db:migrate keeps working.
revoke all on schema reeldeal_meta from public, anon, authenticated;
revoke all on all tables in schema reeldeal_meta from public, anon, authenticated;
alter table reeldeal_meta.migrations enable row level security;
```

## The rollback (verbatim, never applied automatically)

```sql
-- ROLLBACK for migrations/20261117000001_restricted_runtime_roles.sql. Never applied
-- automatically (this folder is not read by npm run db:migrate). Run by hand as the
-- owner, only with approval, after pointing every service back at the owner connection:
--   psql "$OWNER_DATABASE_URL" -v ON_ERROR_STOP=1 -1 -f supabase/rollback/20261117000001_restricted_runtime_roles.down.sql
-- It touches no customer data: it removes the two roles, their grants and policies,
-- and restores the previous (default) state of reeldeal_meta.

-- 1. Policies created for the two roles. -- reviewed: destructive (rollback only)
do $$
declare r record;
begin
  for r in select schemaname, tablename, policyname from pg_policies
            where schemaname = 'public' and (policyname like 'server web %' or policyname like 'server worker %') loop
    execute format('drop policy %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;
end $$;

-- 2. Every privilege held by the roles, then the roles themselves.
--    Fails safely (whole script rolls back with -1) if a session is still connected as either role.
revoke authenticated from reeldeal_web;
revoke all on all tables in schema public from reeldeal_web, reeldeal_worker;
revoke all on schema public, private from reeldeal_web, reeldeal_worker;
revoke all on function private.tags_text(text[]), private.set_updated_at() from reeldeal_web, reeldeal_worker;
drop role if exists reeldeal_web;
drop role if exists reeldeal_worker;

-- 3. reeldeal_meta back to how db:migrate created it (no RLS; no grants were ever given).
alter table reeldeal_meta.migrations disable row level security;

-- 4. Forget the migration so it can be applied again later.
delete from reeldeal_meta.migrations where name = '20261117000001_restricted_runtime_roles.sql';
-- If it was also applied through the Supabase dashboard or MCP, remove that record too:
-- delete from supabase_migrations.schema_migrations where name = 'restricted_runtime_roles';
```
