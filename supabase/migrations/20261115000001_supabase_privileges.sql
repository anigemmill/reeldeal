-- Least-privilege grants for Supabase.
--
-- Supabase grants ALL on every new public table to anon and authenticated by default
-- (including TRUNCATE, which ignores RLS). The first migration added narrower grants
-- on top of those defaults instead of replacing them, so on a real Supabase project a
-- signed-in user could, through the Data API, change organisations.plan_id, widen the
-- scopes of their own API token, or point a media row's storage_key at another
-- organisation's object. Verified against the supabase/postgres image (infra/local).
--
-- This migration only revokes and re-grants privileges and adds check constraints.
-- It changes no data.

/* --------------------------------------------- start from nothing, then grant */

revoke all on all tables in schema public from anon, authenticated;
-- Future tables in this project start with no access for anon or signed-in users.
alter default privileges in schema public revoke all on tables from anon, authenticated;

grant usage on schema public to authenticated;

-- Tenancy: read; admins may rename the workspace and set AI consent (RLS limits rows to admins).
grant select on public.organisations, public.memberships to authenticated;
grant update (name, ai_media_analysis_consent) on public.organisations to authenticated;

-- Tokens: users see their own tokens without the hash and may only revoke them.
grant select (id, user_id, org_id, name, token_prefix, scopes, created_at, expires_at, last_used_at, revoked_at)
  on public.api_tokens to authenticated;
grant update (revoked_at) on public.api_tokens to authenticated;

-- Content tables: the columns the application writes on a user's behalf, nothing more.
grant select, delete on
  public.brand_profiles, public.media_assets, public.projects, public.project_media,
  public.video_briefs, public.video_concepts, public.storyboards to authenticated;

grant insert (org_id, name, description, industry, audiences, voice, colours, typography, guidelines, restrictions, created_by)
  on public.brand_profiles to authenticated;
grant update (name, description, industry, audiences, voice, colours, typography, guidelines, restrictions, logo_media_id, version)
  on public.brand_profiles to authenticated;

-- status, analysis results and size after upload are set by the server only.
grant insert (id, org_id, title, description, kind, mime_type, size_bytes, storage_key, original_filename, tags, brand_id, usage_rights, created_by)
  on public.media_assets to authenticated;
grant update (title, description, tags, brand_id, usage_rights)
  on public.media_assets to authenticated;

grant insert (org_id, brand_id, name, objective, audience, description, platform, formats, duration_seconds, created_by)
  on public.projects to authenticated;
grant update (brand_id, name, objective, audience, description, platform, formats, duration_seconds, status)
  on public.projects to authenticated;

grant insert (project_id, media_id, org_id) on public.project_media to authenticated;

grant insert (org_id, project_id, request, brief, source, model, created_by) on public.video_briefs to authenticated;
grant insert (org_id, project_id, brief_id, concepts, model, created_by) on public.video_concepts to authenticated;
grant insert (org_id, project_id, version, title, format, total_duration_seconds, scenes, source, model, created_by)
  on public.storyboards to authenticated;

-- Written by trusted server code only.
grant select on public.jobs, public.media_analysis, public.exports, public.credit_transactions to authenticated;

/* ------------------------------------- storage keys stay in their organisation */

-- Even a server bug cannot store a key outside the row's own organisation namespace.
alter table public.media_assets add constraint media_assets_storage_key_in_org
  check (storage_key like 'org/' || org_id::text || '/media/' || id::text || '/%');
alter table public.exports add constraint exports_storage_key_in_org
  check (storage_key is null or storage_key like 'org/' || org_id::text || '/exports/%');
