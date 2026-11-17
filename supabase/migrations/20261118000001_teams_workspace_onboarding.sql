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
