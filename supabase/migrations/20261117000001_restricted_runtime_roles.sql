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
