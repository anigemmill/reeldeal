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
