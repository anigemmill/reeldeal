# Migration approval pack: `20261117000001`, `20261118000001` (and `20261119000001`)

> **Update 2026-11-18: all three migrations (1117, 1118, 1119) are APPLIED to the live project**, approved by the owner and applied in that order between 07:35 and 07:50 UTC, with every post-check passing. The execution record, with times, tracker rows and check results, is `docs/review/migration-execution-record-2026-11-18.md`. The text below is the pack as approved, kept unchanged.

**Status at 2026-11-17: none of these migrations is applied to the live `reeldeal` project
(`jzshbaqfrrgsyiciuzfe`).** This pack is everything needed to decide. Each migration is approved
separately. The detailed reviews are still in `docs/review/migration-20261117000001-…` and
`…-20261118000001-…`. This pack supersedes their SQL appendices: 1118 gained two read-only helper
functions in this round, and 1119 is new.

| # | Migration | Purpose | Requested now? |
|---|---|---|---|
| 1 | `20261117000001_restricted_runtime_roles` | Least-privilege database logins for the web app and worker (audit S2, advisor S9) | **Yes** |
| 2 | `20261118000001_teams_workspace_onboarding` | Teams and invitations, workspace details, onboarding progress, preferences, token environment, auth rate limits, billing scaffold | **Yes** |
| 3 | `20261119000001_credit_rollover` | One-month video-credit rollover with expiry (`docs/credits.md`) | **Additional, new this round.** Approve separately; it can wait |

## 1. Execution order

1. **Pre-checks (read-only).** `npm run infra:check` with the Reeldeal URL and owner `DATABASE_URL`
   (it refuses any other project), then `npm run db:migrate -- --plan`. Expected output: exactly the
   approved file(s), in this order: 1117, 1118, 1119.
2. **Backup point.** Note the time, and confirm a daily backup or PITR exists in the dashboard
   (Database → Backups).
3. **Apply 1117.** `npm run db:migrate -- --apply` runs each file in its own transaction, all or
   nothing. To apply one at a time, temporarily move the later files out of
   `supabase/migrations/`, or let me apply each through the Supabase tool once the connector sees the
   project.
4. **Apply 1118.** Its grants to `reeldeal_web` are conditional, so it also works without 1117. But
   1117 first means those grants are created at once.
5. **(If approved) apply 1119.** It's independent of 1118 and has conditional `reeldeal_web` grants,
   like 1118.
6. **Post-checks.** `npm run infra:check`: restricted roles present, 0 tables without RLS,
   0 anon grants, private schema not exposed, expected tables only. Then the Supabase security
   advisor.
7. **Only then** deploy code from this branch. The code writes `api_tokens.environment` and
   calls the 1118 functions.

Nothing in this order changes a row of customer data. The live tables are empty today.

## 2. Every permission change

### 1117: restricted runtime roles

- **New roles** `reeldeal_web` and `reeldeal_worker`: `NOLOGIN NOINHERIT NOSUPERUSER NOCREATEDB
  NOCREATEROLE NOBYPASSRLS`. Nobody can log in as them until a password is set by hand at
  deployment.
- `grant authenticated to reeldeal_web`, so the web role can act as a signed-in user under the
  existing RLS. The worker role gets no such grant.
- Table grants and policies for each role, exactly as listed in the 1117 review ("What changes"):
  - Web: inserts limited by policy (free plan only, first owner only, grants positive and holds
    negative, jobs queued only); narrow column updates.
  - Worker: charges and releases only; analysis and exports inserts; job run columns.
  - Neither role has DELETE, TRUNCATE, `auth.users`, profiles or role creation.
- Usage on `public` and `private`; execute on the two helper functions.
- `reeldeal_meta`: **revoked** from `public`, `anon` and `authenticated`, with RLS on (they had no
  access in practice; this is hardening).
- **Unchanged:** `anon`, `authenticated`, `service_role`, every existing policy, the owner login.

### 1118: teams, workspace and onboarding

- `authenticated` gets:
  - **update** on the new workspace columns (RLS still limits it to admins)
  - **select** on its own `user_preferences` and on the new tables per their policies (owners read
    `billing_accounts`; admins read invitations and the audit log)
  - **execute** on `private.my_role`, `create_invitation`, `revoke_invitation`, `my_invitations`,
    `invitation_preview` *(new this round)*, `accept_invitation`, `change_member_role`,
    `remove_member`, `leave_workspace`, `transfer_ownership` and `team_members`. All are SECURITY
    DEFINER with `search_path = ''`, check `auth.uid()`, and enforce `docs/team-permissions.md`.
- No user write grants on `invitations`, `audit_events`, `memberships` or `billing_accounts`. Writes
  happen only through the functions.
- `private.rate_limits`: revoked from everyone. `private.rate_limit_hit` and `rate_limit_peek`
  *(new this round)* are revoked from `public` and executable only by the owner (the server's
  system connection) and, if 1117 is applied, `reeldeal_web`.
- `reeldeal_web` (if present): insert on `api_tokens.environment`; execute on the two rate-limit
  functions.
- `anon`: nothing.

### 1119: credit rollover (additional)

- `authenticated`: select on `credit_period_closes`, limited by RLS to members of the workspace.
  No write anywhere: the ledger stays server-written.
- `reeldeal_web` (if present): select and insert on `credit_period_closes`; a new insert policy on
  `credit_transactions` for kinds `rollover` and `expiry` only.
- `anon`: nothing.

## 3. Tables and columns added

| Migration | Object | Notes |
|---|---|---|
| 1117 | Roles `reeldeal_web`, `reeldeal_worker`, 33 policies | No tables |
| 1118 | `organisations` columns: `legal_name`, `industry`, `website`, `location`, `phone`, `workspace_kind`, `default_formats`, `onboarding_step`, `onboarding_completed_at` | Nullable or defaulted |
| 1118 | `media_assets.kind` check widened to include `document` | Constraint replaced in the same transaction |
| 1118 | `api_tokens.environment` (`development` default) | |
| 1118 | Tables: `invitations` (token hash only), `audit_events`, `user_preferences`, `billing_accounts`, `private.rate_limits` | RLS on each public table |
| 1118 | Unique index `memberships_one_owner`; unique open invitation per workspace and email | |
| 1118 | Functions listed in section 2 | |
| 1119 | `credit_transactions.kind` check widened with `rollover`, `expiry` | Constraint replaced in the same transaction |
| 1119 | Partial unique indexes: one grant, one expiry, one carry out, one carry in per workspace, wallet and month | Fails only if duplicates already exist (live: empty) |
| 1119 | Table `credit_period_closes` | RLS on |

## 4. Impact on customers and data

- **Live data today:** none. The project has no users or workspaces (last read-only check), so
  nothing is rewritten. Each migration only adds objects.
- **Behaviour:** none until code from this branch is deployed. After deployment:
  - Invitations, team management, onboarding resume and preferences work.
  - Sign-in limits count failures only.
  - With 1119, unspent video credits carry into the next month.
- **1117 risk:** a missing grant would show as "permission denied" on one feature once the
  services move to the roles (a separate step, by changing `DATABASE_URL`). This is covered by
  `restricted-roles.test.ts` and the browser suite run as the roles.
- **1119 risk:** on first use after it's applied, each workspace's earlier months are closed once.
  Live is empty, so no balance changes.

## 5. Rollback, and what it loses

| Migration | Script | Data lost if rolled back |
|---|---|---|
| 1117 | `supabase/rollback/20261117000001_…down.sql` | **None.** Drops the roles, their grants and policies, and RLS on `reeldeal_meta`. First point `DATABASE_URL` back at the owner login, or `drop role` refuses (a safe failure) |
| 1118 | `supabase/rollback/20261118000001_…down.sql` | **Deletes:** every invitation, including accepted ones (the record of who invited whom); **the whole audit log** (role changes, removals, ownership transfers); billing records; user preferences; rate-limit counters; the new workspace columns (legal name, industry, website, location, phone, kind, formats, onboarding progress); token environments. **Refuses** if any `document` media exist. **Keeps** memberships (people who joined stay members), brands, media, projects, tokens and the ledger. **Export first:** `copy (select * from public.audit_events) to stdout csv header;` and the same for `invitations`, `billing_accounts` and the organisation columns |
| 1119 | `supabase/rollback/20261119000001_…down.sql` | **Deletes** every `rollover` and `expiry` ledger row and the close history. Balances return to "current month only": carried credits disappear from the current month. No grants, holds, charges or refunds are touched. Export commands are in the script header |

**The faster partial rollback for 1118 and 1119:** redeploy the previous code and leave the schema
in place. Every addition is inert without the code that uses it.

All three rollbacks were tested on the local Supabase image (apply → rollback → re-apply). Results
are in section 7.

## 6. Environment variables and credentials needed afterwards

| When | Name | Where | Secret? |
|---|---|---|---|
| Applying (your machine) | `DATABASE_URL`: owner, session pooler (`postgres.jzshbaqfrrgsyiciuzfe`, port 5432) | Your shell only, never committed | Yes |
| Deploying with 1117 | Passwords for `reeldeal_web` and `reeldeal_worker` (`alter role … with login password …`), generated and kept in a password manager or the host's secret store | Supabase SQL editor | Yes |
| Deploying with 1117 | `DATABASE_URL` for Vercel: `reeldeal_web.jzshbaqfrrgsyiciuzfe`, port **6543** (transaction mode) | Vercel environment (production and preview separately) | Yes |
| Deploying with 1117 | `DATABASE_URL` for the worker host: `reeldeal_worker.jzshbaqfrrgsyiciuzfe`, port 5432 | Worker host secrets | Yes |
| Deploying 1118 code | `SIGNING_SECRET` (already required; now also keys the rate-limit HMACs) | Vercel and worker | Yes |
| Deploying 1118 code | None for token environments: derived from `NODE_ENV` (`production` on any Vercel build, **including previews**). If previews must not accept production tokens, give them a separate database (recommended) | n/a | n/a |
| Deploying 1118 code | `NEXT_PUBLIC_SITE_URL` (invitation links and auth callbacks) | Vercel | No |
| Not needed | Service-role or secret key | n/a | Never used by these migrations or the code paths |

## 7. Test evidence (local only; nothing here ran against the live project)

| Check | Database / services | Result |
|---|---|---|
| Unit and integration suite (`npm test`) | PGlite | 307 passed, 10 skipped (need live credentials) |
| Same suite | `supabase/postgres:17.6.1.166` | 309 passed, 8 skipped |
| Credit rollover (`credit-rollover.test.ts`) | both | 12/12 |
| Team and invitations (`team.test.ts`, incl. preview) | both | 26/26 |
| Rate limits incl. abuse scenarios | both | 15/15 |
| Browser journey (`npm run test:e2e`), with 1118 and 1119 applied locally | Local stack: Supabase Postgres, Supabase Auth v2.180.0, MinIO, mail catcher | **106/106**, incl. 13 new invitation checks |
| Rollback 1118, then re-apply 1118 and 1119 | Local Supabase image | Clean |
| Rollback 1119, then re-apply | Local Supabase image | Clean (table and ledger kinds removed, then restored) |
| Migration safety check | n/a | 10 migrations additive (constraint replacements reviewed) |
| Typecheck, lint, secret scan, token and pricing validation, production build | n/a | Pass |
| Accessibility (axe) on the production build | n/a | No WCAG 2.2 A/AA violations: 16 theme sets × 31 pages, plus 17 phone layouts; keyboard, focus and reduced-motion checks pass (two name mismatches found in the new controls, fixed, re-run clean) |
| Invitation tokens absent from server logs | Local dev server | Found in **development** server-action logging; fixed (`logging.serverFunctions: false`), re-checked: 0 occurrences |
| Real browser upload to R2 | **Live** `reeldeal-dev-media` | Blocked by CORS as expected; nothing written. Full test waits for approval |

## 8. What I need from you

- [ ] **Approve 1117** (yes / no)
- [ ] **Approve 1118** (yes / no), having read the data-loss row in section 5
- [ ] **1119:** approve now / later / not at all. Also decide D-B2 (billing cycle = Stripe period)
- [ ] **How to apply:** you run `db:migrate` on your machine, or I apply through the Supabase tool
      once it's reconnected to the account that owns `reeldeal` (`docs/supabase-reconnection.md`)
- [ ] **When:** before the first deployment of this branch

## Appendix: the SQL, verbatim

Generated from the files in `supabase/` by `scripts/build-approval-pack.sh`, so it can't drift.

### `supabase/migrations/20261117000001_restricted_runtime_roles.sql`

SHA-256 `34f041375f4d03c0`

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

### `supabase/migrations/20261118000001_teams_workspace_onboarding.sql`

SHA-256 `85efea118950c605`

```sql
-- Teams, workspace details, onboarding progress, preferences and the billing record
-- (docs/production-plan.md 4.2–4.3; docs/team-permissions.md). PREPARED, NOT APPLIED:
-- like 20261117000001 it needs the owner's review before it reaches the live project.
--
-- Additive only: new tables, new nullable columns, new functions, one partial unique
-- index, and a widened check constraint. No data is changed or removed.
--
-- Security model:
--   * Users still have NO insert/update/delete privilege on memberships. Every change of
--     membership (invite, accept, role change, removal, leaving, ownership transfer) goes
--     through a SECURITY DEFINER function in the private schema that checks the caller
--     (auth.uid()) against the rules below and writes an audit event in the same
--     transaction. The private schema is not exposed through the Data API, so these are
--     reachable only through the app's own database connection, as the signed-in user.
--   * Rules: one owner per workspace (unique index); nobody changes their own role; owner
--     can't be demoted or removed except by transferring ownership; administrators manage
--     editors and viewers only and can never become owner themselves; invitations are bound
--     to one organisation and one email address, expire after 7 days, and are single-use;
--     an invitation can only be accepted by a signed-in user whose CONFIRMED email matches.
--   * Removing a member deletes their memberships row; their access tokens for that
--     workspace are deleted with it (existing foreign key, on delete cascade), so access
--     ends on their next request.

/* ------------------------------------------------- one owner per workspace */

create unique index if not exists memberships_one_owner on public.memberships (org_id) where role = 'owner';

/* --------------------------------------------- workspace and onboarding data */

alter table public.organisations
  add column legal_name text check (legal_name is null or length(legal_name) between 1 and 200),
  add column industry text check (industry is null or length(industry) between 1 and 80),
  add column website text check (website is null or website ~* '^https?://[^\s]+$'),
  add column location text check (location is null or length(location) between 1 and 120),
  add column phone text check (phone is null or length(phone) between 3 and 40),
  -- 'business': the customer's own business; 'client': a workspace an agency runs for a client (D1).
  add column workspace_kind text not null default 'business' check (workspace_kind in ('business', 'client')),
  add column default_formats text[] not null default array['9:16'] check (default_formats <@ array['9:16', '1:1', '16:9', '4:5'] and cardinality(default_formats) > 0),
  -- Onboarding: the last optional step reached, and when setup was finished (null = show the resume prompt).
  add column onboarding_step text check (onboarding_step is null or onboarding_step in ('business', 'brand', 'assets', 'preferences', 'done')),
  add column onboarding_completed_at timestamptz;

-- Administrators may edit the workspace's details (RLS "admins update organisation" limits rows).
grant update (legal_name, industry, website, location, phone, workspace_kind, default_formats, onboarding_step, onboarding_completed_at) on public.organisations to authenticated;

/* --------------------------------------------------------- brand documents */

-- Brand guidelines (PDF) are stored like footage: private, org-namespaced, signed URLs only.
alter table public.media_assets drop constraint if exists media_assets_kind_check; -- widened just below, nothing removed
alter table public.media_assets add constraint media_assets_kind_check check (kind in ('video', 'image', 'audio', 'document'));

/* ------------------------------------------------------------ preferences */

create table public.user_preferences (
  user_id uuid primary key references auth.users on delete cascade,
  palette text not null default 'crossroads' check (length(palette) between 1 and 40),
  mode text not null default 'workspace' check (mode in ('workspace', 'studio')),
  type text not null default 'a' check (type in ('a', 'b', 'c')),
  email_when_render_ready boolean not null default true,
  updated_at timestamptz not null default now()
);
create trigger user_preferences_updated before update on public.user_preferences for each row execute function private.set_updated_at();
alter table public.user_preferences enable row level security;
create policy "own preferences" on public.user_preferences for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select, insert, update on public.user_preferences to authenticated;

/* ------------------------------------------------------------- invitations */

create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations on delete cascade,
  email text not null check (email = lower(email) and email ~ '^[^\s@]+@[^\s@]+\.[^\s@]+$'),
  role public.member_role not null check (role <> 'owner'),
  -- SHA-256 of the random token in the emailed link; the token itself is never stored.
  token_hash text not null unique,
  invited_by uuid references auth.users on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '7 days',
  accepted_at timestamptz,
  accepted_by uuid references auth.users on delete set null,
  revoked_at timestamptz,
  revoked_by uuid references auth.users on delete set null,
  check (not (accepted_at is not null and revoked_at is not null))
);
-- At most one open invitation per address per workspace.
create unique index invitations_one_open on public.invitations (org_id, email) where accepted_at is null and revoked_at is null;
create index invitations_org_idx on public.invitations (org_id, created_at desc);
alter table public.invitations enable row level security;
-- Administrators see their workspace's invitations (never the token hash). All writes go through functions.
create policy "admins read invitations" on public.invitations for select to authenticated using (private.is_org_member(org_id, 'admin'));
grant select (id, org_id, email, role, invited_by, created_at, expires_at, accepted_at, accepted_by, revoked_at, revoked_by) on public.invitations to authenticated;

/* ------------------------------------------------------------- audit log */

create table public.audit_events (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations on delete cascade,
  actor_id uuid references auth.users on delete set null,
  action text not null check (action ~ '^[a-z_.]{3,60}$'),
  target_user_id uuid references auth.users on delete set null,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index audit_events_org_idx on public.audit_events (org_id, created_at desc);
alter table public.audit_events enable row level security;
create policy "admins read audit" on public.audit_events for select to authenticated using (private.is_org_member(org_id, 'admin'));
grant select on public.audit_events to authenticated;

/* ------------------------------------------- access tokens: environment binding */

-- A token is accepted only by servers of the environment it was made in (src/server/auth/tokens.ts).
-- Existing tokens were all made in development.
alter table public.api_tokens add column environment text not null default 'development' check (environment in ('development', 'production'));
grant select (environment) on public.api_tokens to authenticated;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'reeldeal_web') then
    grant insert (environment) on public.api_tokens to reeldeal_web; -- migration 20261117000001's web role creates tokens
  end if;
end $$;

/* ------------------------------------------------- auth rate limits (app side) */

-- Fixed-window counters for sign-in, sign-up, password reset and resend, keyed by an HMAC of the
-- client IP or the email address (never the raw value). The app checks these BEFORE calling
-- Supabase Auth, whose own limits stay on: because the app calls Supabase from its server, many
-- customers share a few server IPs there, so per-client limits have to live here
-- (docs/auth.md, "Rate limits"). Private schema: not reachable through the Data API.
create table private.rate_limits (
  key text primary key check (length(key) between 8 and 200),
  window_start timestamptz not null default now(),
  hits integer not null default 0
);
revoke all on private.rate_limits from public, anon, authenticated;

/** Count one attempt for a key; true if it is within p_limit per p_window_seconds. */
create or replace function private.rate_limit_hit(p_key text, p_limit int, p_window_seconds int) returns boolean
language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  insert into private.rate_limits as r (key, window_start, hits) values (p_key, now(), 1)
  on conflict (key) do update
    set hits = case when r.window_start < now() - make_interval(secs => p_window_seconds) then 1 else r.hits + 1 end,
        window_start = case when r.window_start < now() - make_interval(secs => p_window_seconds) then now() else r.window_start end
  returning hits into n;
  -- Occasional clean-up of long-expired windows keeps the table small.
  if random() < 0.01 then delete from private.rate_limits where window_start < now() - interval '1 day'; end if;
  return n <= p_limit;
end $$;
revoke all on function private.rate_limit_hit(text, int, int) from public;

/** Read a key without counting: true if fewer than p_limit hits in the current window (sign-in counts failures only). */
create or replace function private.rate_limit_peek(p_key text, p_limit int, p_window_seconds int) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select r.hits < p_limit or r.window_start < now() - make_interval(secs => p_window_seconds)
                     from private.rate_limits r where r.key = p_key), true)
$$;
revoke all on function private.rate_limit_peek(text, int, int) from public;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'reeldeal_web') then
    grant usage on schema private to reeldeal_web;
    grant execute on function private.rate_limit_hit(text, int, int) to reeldeal_web;
    grant execute on function private.rate_limit_peek(text, int, int) to reeldeal_web;
  end if;
end $$;

/* ------------------------------------------------------ billing (scaffold) */

-- Written only by the server (Stripe webhooks, billing stage). Owners can read their own.
create table public.billing_accounts (
  org_id uuid primary key references public.organisations on delete cascade,
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  subscription_status text not null default 'none' check (subscription_status in ('none', 'trialing', 'active', 'past_due', 'cancelled', 'incomplete')),
  plan_id text,
  billing_interval text check (billing_interval in ('monthly', 'annual')),
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  billing_email text,
  updated_at timestamptz not null default now()
);
create trigger billing_accounts_updated before update on public.billing_accounts for each row execute function private.set_updated_at();
alter table public.billing_accounts enable row level security;
create policy "owners read billing" on public.billing_accounts for select to authenticated using (private.is_org_member(org_id, 'owner'));
grant select on public.billing_accounts to authenticated;

/* ---------------------------------------------- membership functions (rules) */

create or replace function private.audit(p_org uuid, p_action text, p_target uuid, p_meta jsonb default '{}')
returns void language sql security definer set search_path = '' as $$
  insert into public.audit_events (org_id, actor_id, action, target_user_id, metadata) values (p_org, auth.uid(), p_action, p_target, coalesce(p_meta, '{}'))
$$;

/** The caller's role in an organisation, or null. */
create or replace function private.my_role(p_org uuid) returns public.member_role
language sql stable security definer set search_path = '' as $$
  select role from public.memberships where org_id = p_org and user_id = auth.uid()
$$;

/**
 * Invite an address. Owner may invite admin/editor/viewer; admin may invite editor/viewer.
 * p_seat_limit comes from config/pricing.json (null = unlimited); members plus open,
 * unexpired invitations must stay within it. Replaces an existing open invitation for the
 * same address (the old link stops working). Returns the invitation id.
 */
create or replace function private.create_invitation(p_org uuid, p_email text, p_role public.member_role, p_token_hash text, p_seat_limit int)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  me public.member_role := private.my_role(p_org);
  addr text := lower(trim(p_email));
  used int;
  new_id uuid;
begin
  if auth.uid() is null or me is null or me < 'admin' then raise exception 'not allowed' using errcode = '42501'; end if;
  if p_role = 'owner' then raise exception 'ownership is transferred, not invited' using errcode = '22023'; end if;
  if me = 'admin' and p_role >= 'admin' then raise exception 'only the owner can invite administrators' using errcode = '42501'; end if;
  if exists (select 1 from public.memberships m join auth.users u on u.id = m.user_id where m.org_id = p_org and lower(u.email) = addr) then
    raise exception 'already a member' using errcode = '23505';
  end if;
  perform pg_advisory_xact_lock(hashtext('seats:' || p_org::text));
  update public.invitations set revoked_at = now(), revoked_by = auth.uid()
    where org_id = p_org and email = addr and accepted_at is null and revoked_at is null;
  select (select count(*) from public.memberships where org_id = p_org)
       + (select count(*) from public.invitations where org_id = p_org and accepted_at is null and revoked_at is null and expires_at > now())
    into used;
  if p_seat_limit is not null and used >= p_seat_limit then raise exception 'no seats left' using errcode = '53400'; end if;
  insert into public.invitations (org_id, email, role, token_hash, invited_by) values (p_org, addr, p_role, p_token_hash, auth.uid()) returning id into new_id;
  perform private.audit(p_org, 'invitation.created', null, jsonb_build_object('invitation_id', new_id, 'email', addr, 'role', p_role));
  return new_id;
end $$;

/** Revoke an open invitation. Admins may revoke editor/viewer invitations; the owner any. */
create or replace function private.revoke_invitation(p_invitation uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare inv public.invitations; me public.member_role;
begin
  select * into inv from public.invitations where id = p_invitation for update;
  if not found then raise exception 'not found' using errcode = 'P0002'; end if;
  me := private.my_role(inv.org_id);
  if me is null or me < 'admin' or (me = 'admin' and inv.role >= 'admin') then raise exception 'not found' using errcode = 'P0002'; end if;
  if inv.accepted_at is not null or inv.revoked_at is not null then return; end if;
  update public.invitations set revoked_at = now(), revoked_by = auth.uid() where id = p_invitation;
  perform private.audit(inv.org_id, 'invitation.revoked', null, jsonb_build_object('invitation_id', inv.id, 'email', inv.email));
end $$;

/** Open invitations for the caller's confirmed email address (shown during onboarding). */
create or replace function private.my_invitations()
returns table (id uuid, org_id uuid, org_name text, role public.member_role, invited_by_name text, expires_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select i.id, i.org_id, o.name, i.role, coalesce(p.display_name, 'A teammate'), i.expires_at
    from public.invitations i
    join public.organisations o on o.id = i.org_id
    join auth.users u on u.id = auth.uid() and u.email_confirmed_at is not null and lower(u.email) = i.email
    left join public.profiles p on p.user_id = i.invited_by
   where i.accepted_at is null and i.revoked_at is null and i.expires_at > now()
     and not exists (select 1 from public.memberships m where m.org_id = i.org_id and m.user_id = auth.uid())
$$;

/**
 * What the invitation page shows before someone accepts: only to a signed-in user whose
 * CONFIRMED email matches the invitation. Anyone else learns nothing beyond "not for this
 * account" (the token is 256-bit random, so this can't be used to probe for invitations).
 */
create or replace function private.invitation_preview(p_token_hash text)
returns table (status text, org_name text, role public.member_role, invited_by_name text, expires_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
declare inv public.invitations; my_email text; confirmed timestamptz;
begin
  if auth.uid() is null then return; end if;
  select * into inv from public.invitations where token_hash = p_token_hash;
  if not found then return query select 'not_found'::text, null::text, null::public.member_role, null::text, null::timestamptz; return; end if;
  select lower(u.email), u.email_confirmed_at into my_email, confirmed from auth.users u where u.id = auth.uid();
  if confirmed is null or my_email is distinct from inv.email then
    return query select 'other_account'::text, null::text, null::public.member_role, null::text, null::timestamptz; return;
  end if;
  return query
    select case
             when inv.accepted_by = auth.uid() or exists (select 1 from public.memberships m where m.org_id = inv.org_id and m.user_id = auth.uid()) then 'member'
             when inv.revoked_at is not null then 'revoked'
             when inv.accepted_at is not null then 'used'
             when inv.expires_at <= now() then 'expired'
             else 'open' end,
           o.name, inv.role, coalesce(p.display_name, 'A teammate'), inv.expires_at
      from public.organisations o left join public.profiles p on p.user_id = inv.invited_by
     where o.id = inv.org_id;
end $$;

/**
 * Accept an invitation, by the token from the emailed link or by id (onboarding's Join
 * button). Either way the caller's CONFIRMED email must match the invitation. Expired,
 * revoked and used invitations are refused. Returns the organisation id.
 */
create or replace function private.accept_invitation(p_token_hash text default null, p_invitation uuid default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare inv public.invitations; my_email text; confirmed timestamptz;
begin
  if auth.uid() is null then raise exception 'not signed in' using errcode = '42501'; end if;
  select * into inv from public.invitations
   where (p_token_hash is not null and token_hash = p_token_hash) or (p_token_hash is null and id = p_invitation)
   for update;
  if not found then raise exception 'invitation not found' using errcode = 'P0002'; end if;
  select lower(email), email_confirmed_at into my_email, confirmed from auth.users where id = auth.uid();
  -- Same error for every mismatch, so a token can't be used to probe whose address it is.
  if confirmed is null or my_email is distinct from inv.email then raise exception 'invitation not found' using errcode = 'P0002'; end if;
  if inv.revoked_at is not null then raise exception 'invitation revoked' using errcode = '22023'; end if;
  if inv.accepted_at is not null then
    if inv.accepted_by = auth.uid() then return inv.org_id; end if;
    raise exception 'invitation already used' using errcode = '22023';
  end if;
  if inv.expires_at <= now() then raise exception 'invitation expired' using errcode = '22023'; end if;
  insert into public.memberships (org_id, user_id, role) values (inv.org_id, auth.uid(), inv.role) on conflict (org_id, user_id) do nothing;
  update public.invitations set accepted_at = now(), accepted_by = auth.uid() where id = inv.id;
  perform private.audit(inv.org_id, 'member.joined', auth.uid(), jsonb_build_object('invitation_id', inv.id, 'role', inv.role));
  return inv.org_id;
end $$;

/**
 * Change someone's role. Never your own; never to or from owner (that's a transfer).
 * Owner: anyone else to admin/editor/viewer. Admin: editors and viewers, to editor/viewer only.
 */
create or replace function private.change_member_role(p_org uuid, p_user uuid, p_role public.member_role) returns void
language plpgsql security definer set search_path = '' as $$
declare me public.member_role := private.my_role(p_org); target public.member_role;
begin
  if me is null or me < 'admin' then raise exception 'not allowed' using errcode = '42501'; end if;
  if p_user = auth.uid() then raise exception 'you cannot change your own role' using errcode = '42501'; end if;
  select role into target from public.memberships where org_id = p_org and user_id = p_user for update;
  if not found then raise exception 'not a member' using errcode = 'P0002'; end if;
  if p_role = 'owner' or target = 'owner' then raise exception 'use transfer ownership' using errcode = '42501'; end if;
  if me = 'admin' and (target >= 'admin' or p_role >= 'admin') then raise exception 'only the owner can manage administrators' using errcode = '42501'; end if;
  if target = p_role then return; end if;
  update public.memberships set role = p_role where org_id = p_org and user_id = p_user;
  perform private.audit(p_org, 'member.role_changed', p_user, jsonb_build_object('from', target, 'to', p_role));
end $$;

/** Remove someone. Not yourself (leave instead), never the owner; admins remove editors and viewers only. */
create or replace function private.remove_member(p_org uuid, p_user uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare me public.member_role := private.my_role(p_org); target public.member_role;
begin
  if me is null or me < 'admin' then raise exception 'not allowed' using errcode = '42501'; end if;
  if p_user = auth.uid() then raise exception 'leave the workspace instead' using errcode = '42501'; end if;
  select role into target from public.memberships where org_id = p_org and user_id = p_user for update;
  if not found then raise exception 'not a member' using errcode = 'P0002'; end if;
  if target = 'owner' then raise exception 'the owner cannot be removed' using errcode = '42501'; end if;
  if me = 'admin' and target >= 'admin' then raise exception 'only the owner can remove administrators' using errcode = '42501'; end if;
  delete from public.memberships where org_id = p_org and user_id = p_user; -- their tokens for this workspace go with it (FK cascade)
  perform private.audit(p_org, 'member.removed', p_user, jsonb_build_object('role', target));
end $$;

/** Leave a workspace. The owner must transfer ownership first. */
create or replace function private.leave_workspace(p_org uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare me public.member_role := private.my_role(p_org);
begin
  if me is null then raise exception 'not a member' using errcode = 'P0002'; end if;
  if me = 'owner' then raise exception 'transfer ownership before leaving' using errcode = '42501'; end if;
  delete from public.memberships where org_id = p_org and user_id = auth.uid();
  perform private.audit(p_org, 'member.left', auth.uid(), '{}');
end $$;

/**
 * Hand ownership to another member (administrator or editor) with a confirmed email.
 * Owner only. The old owner becomes an administrator. The app confirms the caller's
 * password and the typed workspace name before calling this.
 */
create or replace function private.transfer_ownership(p_org uuid, p_new_owner uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare target public.member_role;
begin
  if private.my_role(p_org) is distinct from 'owner' then raise exception 'only the owner can transfer ownership' using errcode = '42501'; end if;
  if p_new_owner = auth.uid() then raise exception 'you already own this workspace' using errcode = '22023'; end if;
  select role into target from public.memberships where org_id = p_org and user_id = p_new_owner for update;
  if not found then raise exception 'not a member' using errcode = 'P0002'; end if;
  if target not in ('admin', 'editor') then raise exception 'the new owner must be an administrator or editor' using errcode = '22023'; end if;
  if not exists (select 1 from auth.users where id = p_new_owner and email_confirmed_at is not null) then
    raise exception 'the new owner must have a confirmed email' using errcode = '22023';
  end if;
  update public.memberships set role = 'admin' where org_id = p_org and user_id = auth.uid(); -- first, so the one-owner index holds
  update public.memberships set role = 'owner' where org_id = p_org and user_id = p_new_owner;
  perform private.audit(p_org, 'ownership.transferred', p_new_owner, jsonb_build_object('from', auth.uid()));
end $$;

/** Team list for members of the workspace: names and emails of fellow members only. */
create or replace function private.team_members(p_org uuid)
returns table (user_id uuid, role public.member_role, joined_at timestamptz, email text, display_name text, last_sign_in_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select m.user_id, m.role, m.created_at, u.email, p.display_name, u.last_sign_in_at
    from public.memberships m
    join auth.users u on u.id = m.user_id
    left join public.profiles p on p.user_id = m.user_id
   where m.org_id = p_org and private.is_org_member(p_org)
   order by (m.role = 'owner') desc, m.role desc, m.created_at
$$;

do $$
declare f text;
begin
  foreach f in array array[
    'private.audit(uuid, text, uuid, jsonb)', 'private.my_role(uuid)',
    'private.create_invitation(uuid, text, public.member_role, text, int)', 'private.revoke_invitation(uuid)',
    'private.my_invitations()', 'private.invitation_preview(text)', 'private.accept_invitation(text, uuid)', 'private.change_member_role(uuid, uuid, public.member_role)',
    'private.remove_member(uuid, uuid)', 'private.leave_workspace(uuid)', 'private.transfer_ownership(uuid, uuid)', 'private.team_members(uuid)'] loop
    execute format('revoke all on function %s from public', f);
    if f not like 'private.audit(%' then execute format('grant execute on function %s to authenticated', f); end if;
  end loop;
end $$;
```

### `supabase/migrations/20261119000001_credit_rollover.sql`

SHA-256 `a47db7bb1b684216`

```sql
/*
  Credit rollover (pricing.json: video credits roll over for one billing cycle, capped at one
  month's allocation, oldest first). NOT APPLIED to the live project: see
  docs/review/migration-approval-pack.md.

  Ledger model (all rows stay append-only):
  - closing period Q writes, in Q, a negative 'rollover' (the carried amount) and a negative
    'expiry' (the rest), so a closed period sums to zero;
  - it writes, in the next period, a positive 'rollover' (the carried amount);
  - credit_period_closes records each close once (idempotency and history).
  Unique indexes make a second close, a second grant or a second carry impossible, even if two
  requests race.
*/

alter table public.credit_transactions drop constraint credit_transactions_kind_check;
alter table public.credit_transactions add constraint credit_transactions_kind_check
  check (kind in ('grant', 'hold', 'release', 'charge', 'refund', 'adjustment', 'rollover', 'expiry'));

-- One grant per wallet and period (one-off plans only ever have one grant row).
create unique index credit_transactions_one_grant on public.credit_transactions (org_id, wallet, period) where kind = 'grant';
-- One expiry per closed period; one carry out of a period and one carry into a period.
create unique index credit_transactions_one_expiry on public.credit_transactions (org_id, wallet, period) where kind = 'expiry';
create unique index credit_transactions_one_rollover_out on public.credit_transactions (org_id, wallet, period) where kind = 'rollover' and amount < 0;
create unique index credit_transactions_one_rollover_in on public.credit_transactions (org_id, wallet, period) where kind = 'rollover' and amount > 0;

create table public.credit_period_closes (
  org_id uuid not null references public.organisations on delete cascade,
  wallet text not null check (wallet in ('video', 'ai_generation')),
  period text not null check (period ~ '^[0-9]{4}-[0-9]{2}$'),
  balance integer not null,           -- what was left when the period closed
  carried integer not null check (carried >= 0),
  expired integer not null check (expired >= 0),
  closed_at timestamptz not null default now(),
  primary key (org_id, wallet, period)
);
alter table public.credit_period_closes enable row level security;
create policy "members read period closes" on public.credit_period_closes
  for select to authenticated using (private.is_org_member(org_id));
grant select on public.credit_period_closes to authenticated;

-- The restricted web role (migration 20261117000001) closes periods when it ensures a grant.
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'reeldeal_web') then
    grant select, insert on public.credit_period_closes to reeldeal_web;
    create policy "server web reads closes" on public.credit_period_closes for select to reeldeal_web using (true);
    create policy "server web closes periods" on public.credit_period_closes for insert to reeldeal_web with check (true);
    create policy "server web carries and expires" on public.credit_transactions for insert to reeldeal_web
      with check (kind in ('rollover', 'expiry') and wallet in ('video', 'ai_generation'));
  end if;
end $$;
```

### `supabase/rollback/20261117000001_restricted_runtime_roles.down.sql`

SHA-256 `98e2bbf812abf5dc`

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

### `supabase/rollback/20261118000001_teams_workspace_onboarding.down.sql`

SHA-256 `548a538707926b77`

```sql
-- ROLLBACK for migrations/20261118000001_teams_workspace_onboarding.sql. Never applied
-- automatically. Run by hand as the owner, only with approval, in one transaction:
--   psql "$OWNER_DATABASE_URL" -v ON_ERROR_STOP=1 -1 -f supabase/rollback/20261118000001_teams_workspace_onboarding.down.sql
--
-- WARNING: unlike 20261117000001's rollback, this one REMOVES DATA created after the migration:
-- invitations, the audit log, billing records, user preferences, rate-limit counters, the new
-- workspace detail columns (legal name, industry, website, location, phone, kind, default
-- formats, onboarding progress) and the access-token environment column. Memberships, brands,
-- media, projects, tokens and the ledger are untouched. It refuses to run if any media row uses
-- the new 'document' kind (delete or re-kind those first). Export what you need before running.
-- reviewed: destructive (whole file is a rollback)

do $$ begin
  if exists (select 1 from public.media_assets where kind = 'document') then
    raise exception 'media_assets has document rows: remove them before rolling back';
  end if;
end $$;

-- Functions first (they reference the tables).
drop function if exists private.team_members(uuid); -- reviewed: destructive
drop function if exists private.transfer_ownership(uuid, uuid); -- reviewed: destructive
drop function if exists private.leave_workspace(uuid); -- reviewed: destructive
drop function if exists private.remove_member(uuid, uuid); -- reviewed: destructive
drop function if exists private.change_member_role(uuid, uuid, public.member_role); -- reviewed: destructive
drop function if exists private.accept_invitation(text, uuid); -- reviewed: destructive
drop function if exists private.invitation_preview(text); -- reviewed: destructive
drop function if exists private.my_invitations(); -- reviewed: destructive
drop function if exists private.revoke_invitation(uuid); -- reviewed: destructive
drop function if exists private.create_invitation(uuid, text, public.member_role, text, int); -- reviewed: destructive
drop function if exists private.my_role(uuid); -- reviewed: destructive
drop function if exists private.audit(uuid, text, uuid, jsonb); -- reviewed: destructive
drop function if exists private.rate_limit_hit(text, int, int); -- reviewed: destructive
drop function if exists private.rate_limit_peek(text, int, int); -- reviewed: destructive

drop table if exists private.rate_limits; -- reviewed: destructive
drop table if exists public.billing_accounts; -- reviewed: destructive
drop table if exists public.audit_events; -- reviewed: destructive
drop table if exists public.invitations; -- reviewed: destructive
drop table if exists public.user_preferences; -- reviewed: destructive

alter table public.api_tokens drop column if exists environment; -- reviewed: destructive
alter table public.organisations
  drop column if exists legal_name, drop column if exists industry, drop column if exists website, -- reviewed: destructive
  drop column if exists location, drop column if exists phone, drop column if exists workspace_kind, -- reviewed: destructive
  drop column if exists default_formats, drop column if exists onboarding_step, drop column if exists onboarding_completed_at; -- reviewed: destructive

drop index if exists public.memberships_one_owner; -- reviewed: destructive

alter table public.media_assets drop constraint if exists media_assets_kind_check;
alter table public.media_assets add constraint media_assets_kind_check check (kind in ('video', 'image', 'audio'));

delete from reeldeal_meta.migrations where name = '20261118000001_teams_workspace_onboarding.sql'; -- reviewed: destructive
-- If it was also applied through the Supabase dashboard or MCP, remove that record too:
-- delete from supabase_migrations.schema_migrations where name = 'teams_workspace_onboarding';
```

### `supabase/rollback/20261119000001_credit_rollover.down.sql`

SHA-256 `fdf207ad95d337ce`

```sql
/*
  Rollback for 20261119000001_credit_rollover.sql. Run by hand, only with approval.

  DATA EFFECT: deletes every 'rollover' and 'expiry' ledger row and the period-close history.
  Balances then return to "current month only": carried credits disappear from the current
  month, and the closed months show their unspent balance again (they're not spendable). No
  grants, holds, charges, releases or refunds are touched. Export first if you need the history:
    copy (select * from public.credit_transactions where kind in ('rollover', 'expiry')) to stdout csv header;
    copy (select * from public.credit_period_closes) to stdout csv header;
*/
begin;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'reeldeal_web') then
    drop policy if exists "server web carries and expires" on public.credit_transactions;
  end if;
end $$;
drop table if exists public.credit_period_closes;
delete from public.credit_transactions where kind in ('rollover', 'expiry');
drop index if exists public.credit_transactions_one_grant;
drop index if exists public.credit_transactions_one_expiry;
drop index if exists public.credit_transactions_one_rollover_out;
drop index if exists public.credit_transactions_one_rollover_in;
alter table public.credit_transactions drop constraint credit_transactions_kind_check;
alter table public.credit_transactions add constraint credit_transactions_kind_check
  check (kind in ('grant', 'hold', 'release', 'charge', 'refund', 'adjustment'));
delete from reeldeal_meta.migrations where name = '20261119000001_credit_rollover.sql';
commit;
```
