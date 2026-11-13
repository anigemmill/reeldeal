-- Reeldeal platform core: tenancy, brands, media, projects, creative outputs,
-- jobs, exports and the credit ledger. See docs/architecture/security.md.
--
-- Rules every table follows:
--   * org_id on every customer row; Row Level Security on every table.
--   * Cross-table links use composite (id, org_id) foreign keys, so a row can never
--     point at another organisation's data, whatever the application does.
--   * Ledger, jobs, analysis and exports are written by trusted server code only;
--     signed-in users can read them but have no insert/update/delete privileges.

create schema if not exists private;

create type public.member_role as enum ('viewer', 'editor', 'admin', 'owner');

create or replace function private.set_updated_at() returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- Immutable helper so tags can feed a generated search column.
create or replace function private.tags_text(tags text[]) returns text
  language sql immutable parallel safe as $$ select coalesce(array_to_string(tags, ' '), '') $$;

/* ---------------------------------------------------------------- tenancy */

create table public.organisations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(name) between 1 and 120),
  slug text not null unique check (slug ~ '^[a-z0-9-]{2,60}$'),
  plan_id text not null default 'free',
  -- Customer consent to send footage frames to the external AI provider for analysis.
  ai_media_analysis_consent boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.memberships (
  org_id uuid not null references public.organisations on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  role public.member_role not null default 'viewer',
  created_at timestamptz not null default now(),
  primary key (org_id, user_id)
);
create index memberships_user_idx on public.memberships (user_id);

-- Membership check used by every policy. SECURITY DEFINER so it can read memberships
-- regardless of the caller's RLS; search_path pinned against hijacking.
create or replace function private.is_org_member(target_org uuid, min_role public.member_role default 'viewer')
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.memberships m
    where m.org_id = target_org and m.user_id = auth.uid() and m.role >= min_role
  )
$$;
revoke all on function private.is_org_member(uuid, public.member_role) from public;
grant usage on schema private to authenticated;
grant execute on function private.is_org_member(uuid, public.member_role) to authenticated;

-- Personal access tokens for MCP clients (development and pilot). Only a SHA-256 hash is stored.
create table public.api_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  org_id uuid not null,
  name text not null check (length(name) between 1 and 80),
  token_prefix text not null,
  token_hash text not null unique,
  scopes text[] not null default array['mcp:read', 'mcp:write'],
  created_at timestamptz not null default now(),
  expires_at timestamptz,
  last_used_at timestamptz,
  revoked_at timestamptz,
  foreign key (org_id, user_id) references public.memberships (org_id, user_id) on delete cascade
);

/* ----------------------------------------------------------------- brands */

create table public.brand_profiles (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations on delete cascade,
  name text not null check (length(name) between 1 and 120),
  description text,
  industry text,
  audiences text[] not null default '{}',
  voice text,
  colours jsonb not null default '[]',
  typography jsonb not null default '{}',
  logo_media_id uuid,
  guidelines text,
  restrictions text[] not null default '{}',
  version integer not null default 1,
  created_by uuid references auth.users on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, org_id)
);
create index brand_profiles_org_idx on public.brand_profiles (org_id, name);

/* ------------------------------------------------------------------ media */

create table public.media_assets (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations on delete cascade,
  title text not null check (length(title) between 1 and 200),
  description text,
  kind text not null check (kind in ('video', 'image', 'audio')),
  mime_type text not null,
  size_bytes bigint check (size_bytes >= 0),
  duration_seconds numeric(10, 3) check (duration_seconds >= 0),
  width integer check (width > 0),
  height integer check (height > 0),
  orientation text generated always as (
    case when width is null or height is null then null
         when width > height then 'landscape'
         when width < height then 'portrait'
         else 'square' end
  ) stored,
  status text not null default 'awaiting_upload'
    check (status in ('awaiting_upload', 'uploaded', 'analysing', 'ready', 'failed')),
  -- Private object key, org-namespaced. Never returned to clients; downloads use short-lived signed URLs.
  storage_key text not null unique,
  original_filename text,
  tags text[] not null default '{}',
  ai_tags text[] not null default '{}',
  usage_rights text,
  brand_id uuid,
  created_by uuid references auth.users on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  search tsvector generated always as (
    setweight(to_tsvector('english', title), 'A') ||
    setweight(to_tsvector('english', private.tags_text(tags) || ' ' || private.tags_text(ai_tags)), 'A') ||
    setweight(to_tsvector('english', coalesce(description, '')), 'B')
  ) stored,
  unique (id, org_id),
  foreign key (brand_id, org_id) references public.brand_profiles (id, org_id) on delete set null (brand_id)
);
create index media_assets_org_idx on public.media_assets (org_id, created_at desc);
create index media_assets_search_idx on public.media_assets using gin (search);

alter table public.brand_profiles
  add foreign key (logo_media_id, org_id) references public.media_assets (id, org_id) on delete set null (logo_media_id);

/* --------------------------------------------------------------- projects */

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations on delete cascade,
  brand_id uuid,
  name text not null check (length(name) between 1 and 160),
  status text not null default 'draft'
    check (status in ('draft', 'storyboarding', 'ready_to_render', 'rendering', 'completed', 'archived')),
  objective text,
  audience text,
  description text,
  platform text,
  formats text[] not null default array['9:16'] check (formats <@ array['9:16', '1:1', '16:9', '4:5'] and cardinality(formats) > 0),
  duration_seconds integer check (duration_seconds between 5 and 300),
  created_by uuid references auth.users on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, org_id),
  foreign key (brand_id, org_id) references public.brand_profiles (id, org_id) on delete set null (brand_id)
);
create index projects_org_idx on public.projects (org_id, updated_at desc);

create table public.project_media (
  project_id uuid not null,
  media_id uuid not null,
  org_id uuid not null,
  added_at timestamptz not null default now(),
  primary key (project_id, media_id),
  foreign key (project_id, org_id) references public.projects (id, org_id) on delete cascade,
  foreign key (media_id, org_id) references public.media_assets (id, org_id) on delete cascade
);

/* ------------------------------------------------------- creative outputs */

create table public.video_briefs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations on delete cascade,
  project_id uuid,
  request text not null,
  brief jsonb not null,
  source text not null check (source in ('ai', 'client')),
  model text,
  created_by uuid references auth.users on delete set null,
  created_at timestamptz not null default now(),
  unique (id, org_id),
  foreign key (project_id, org_id) references public.projects (id, org_id) on delete cascade
);

create table public.video_concepts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations on delete cascade,
  project_id uuid,
  brief_id uuid,
  concepts jsonb not null,
  model text,
  created_by uuid references auth.users on delete set null,
  created_at timestamptz not null default now(),
  foreign key (project_id, org_id) references public.projects (id, org_id) on delete cascade,
  foreign key (brief_id, org_id) references public.video_briefs (id, org_id) on delete set null (brief_id)
);

create table public.storyboards (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations on delete cascade,
  project_id uuid not null,
  version integer not null,
  title text not null,
  format text not null check (format in ('9:16', '1:1', '16:9', '4:5')),
  total_duration_seconds numeric(8, 2) not null,
  scenes jsonb not null,
  source text not null check (source in ('ai', 'client')),
  model text,
  created_by uuid references auth.users on delete set null,
  created_at timestamptz not null default now(),
  unique (id, org_id),
  unique (project_id, version),
  foreign key (project_id, org_id) references public.projects (id, org_id) on delete cascade
);

/* -------------------------------------------------------- jobs and exports */

create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations on delete cascade,
  kind text not null check (kind in ('media_analysis', 'render')),
  status text not null default 'queued' check (status in ('queued', 'running', 'succeeded', 'failed', 'cancelled')),
  stage text,
  progress numeric(5, 2) not null default 0 check (progress between 0 and 100),
  input jsonb not null default '{}',
  result jsonb,
  error jsonb,
  idempotency_key text not null,
  attempt integer not null default 1,
  max_attempts integer not null default 3,
  retry_of uuid references public.jobs on delete set null,
  project_id uuid,
  media_id uuid,
  credits_held integer not null default 0 check (credits_held >= 0),
  created_by uuid references auth.users on delete set null,
  locked_by text,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  heartbeat_at timestamptz,
  finished_at timestamptz,
  unique (id, org_id),
  unique (org_id, kind, idempotency_key),
  foreign key (project_id, org_id) references public.projects (id, org_id) on delete cascade,
  foreign key (media_id, org_id) references public.media_assets (id, org_id) on delete cascade
);
create index jobs_queue_idx on public.jobs (created_at) where status = 'queued';
create index jobs_org_idx on public.jobs (org_id, created_at desc);

create table public.media_analysis (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations on delete cascade,
  media_id uuid not null,
  job_id uuid,
  version integer not null default 1,
  technical jsonb not null,
  scenes jsonb not null default '[]',
  quality jsonb not null default '{}',
  ai jsonb,
  created_at timestamptz not null default now(),
  foreign key (media_id, org_id) references public.media_assets (id, org_id) on delete cascade,
  foreign key (job_id, org_id) references public.jobs (id, org_id) on delete set null (job_id)
);
create index media_analysis_media_idx on public.media_analysis (media_id, created_at desc);

create table public.exports (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations on delete cascade,
  project_id uuid not null,
  job_id uuid not null,
  storyboard_id uuid,
  format text not null,
  status text not null check (status in ('ready', 'failed')),
  storage_key text unique,
  mime_type text,
  size_bytes bigint,
  duration_seconds numeric(8, 2),
  width integer,
  height integer,
  created_at timestamptz not null default now(),
  foreign key (project_id, org_id) references public.projects (id, org_id) on delete cascade,
  foreign key (job_id, org_id) references public.jobs (id, org_id) on delete cascade,
  foreign key (storyboard_id, org_id) references public.storyboards (id, org_id) on delete set null (storyboard_id)
);
create index exports_org_idx on public.exports (org_id, created_at desc);

/* ---------------------------------------------------------- credit ledger */

-- Append-only. Balance for a wallet and period = sum(amount).
-- A render holds credits (negative), then on success releases the hold and charges;
-- on a platform failure it only releases, so failed renders are free.
create table public.credit_transactions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations on delete cascade,
  wallet text not null check (wallet in ('video', 'analysis', 'ai_generation')),
  kind text not null check (kind in ('grant', 'hold', 'release', 'charge', 'refund', 'adjustment')),
  amount integer not null check (amount <> 0),
  period text not null check (period ~ '^[0-9]{4}-[0-9]{2}$'),
  job_id uuid,
  note text,
  created_at timestamptz not null default now(),
  foreign key (job_id, org_id) references public.jobs (id, org_id) on delete set null (job_id)
);
create index credit_transactions_org_idx on public.credit_transactions (org_id, wallet, period);

/* --------------------------------------------------------------- triggers */

create trigger organisations_updated before update on public.organisations for each row execute function private.set_updated_at();
create trigger brand_profiles_updated before update on public.brand_profiles for each row execute function private.set_updated_at();
create trigger media_assets_updated before update on public.media_assets for each row execute function private.set_updated_at();
create trigger projects_updated before update on public.projects for each row execute function private.set_updated_at();

/* ------------------------------------------------------ row level security */

alter table public.organisations enable row level security;
alter table public.memberships enable row level security;
alter table public.api_tokens enable row level security;
alter table public.brand_profiles enable row level security;
alter table public.media_assets enable row level security;
alter table public.projects enable row level security;
alter table public.project_media enable row level security;
alter table public.video_briefs enable row level security;
alter table public.video_concepts enable row level security;
alter table public.storyboards enable row level security;
alter table public.jobs enable row level security;
alter table public.media_analysis enable row level security;
alter table public.exports enable row level security;
alter table public.credit_transactions enable row level security;

create policy "members read organisation" on public.organisations
  for select to authenticated using (private.is_org_member(id));
create policy "admins update organisation" on public.organisations
  for update to authenticated using (private.is_org_member(id, 'admin')) with check (private.is_org_member(id, 'admin'));

create policy "read own memberships, admins read all in org" on public.memberships
  for select to authenticated using (user_id = auth.uid() or private.is_org_member(org_id, 'admin'));

create policy "read own tokens" on public.api_tokens
  for select to authenticated using (user_id = auth.uid());
create policy "revoke own tokens" on public.api_tokens
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Standard content tables: members read, editors create and change, admins delete.
do $$
declare t text;
begin
  foreach t in array array['brand_profiles', 'media_assets', 'projects', 'project_media', 'video_briefs', 'video_concepts', 'storyboards'] loop
    execute format('create policy "members read" on public.%I for select to authenticated using (private.is_org_member(org_id))', t);
    execute format('create policy "editors insert" on public.%I for insert to authenticated with check (private.is_org_member(org_id, ''editor''))', t);
    execute format('create policy "editors update" on public.%I for update to authenticated using (private.is_org_member(org_id, ''editor'')) with check (private.is_org_member(org_id, ''editor''))', t);
    execute format('create policy "admins delete" on public.%I for delete to authenticated using (private.is_org_member(org_id, ''admin''))', t);
  end loop;
end $$;

-- Server-written tables: members read only.
create policy "members read" on public.jobs for select to authenticated using (private.is_org_member(org_id));
create policy "members read" on public.media_analysis for select to authenticated using (private.is_org_member(org_id));
create policy "members read" on public.exports for select to authenticated using (private.is_org_member(org_id));
create policy "members read" on public.credit_transactions for select to authenticated using (private.is_org_member(org_id));

/* ------------------------------------------------------------- privileges */

grant usage on schema public to authenticated;
grant select on public.organisations, public.memberships to authenticated;
grant update (name, ai_media_analysis_consent) on public.organisations to authenticated;
grant select on public.api_tokens to authenticated;
grant update (revoked_at) on public.api_tokens to authenticated;
grant select, insert, update, delete on
  public.brand_profiles, public.media_assets, public.projects, public.project_media,
  public.video_briefs, public.video_concepts, public.storyboards to authenticated;
grant select on public.jobs, public.media_analysis, public.exports, public.credit_transactions to authenticated;
-- Server-written tables: make sure no write privilege exists for signed-in users (Supabase grants broadly by default).
revoke insert, update, delete on public.jobs, public.media_analysis, public.exports, public.credit_transactions from authenticated, anon;
revoke all on all tables in schema public from anon;
