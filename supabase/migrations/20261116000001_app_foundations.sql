-- Customer web app foundations. Additive only: new tables and columns, policies,
-- grants and a version-snapshot trigger. Existing data is untouched (brand
-- histories are seeded from the current rows).

/* ------------------------------------------------------------ user profiles */

-- One row per Supabase Auth user: the name shown in the app. Users manage their own row only.
create table public.profiles (
  user_id uuid primary key references auth.users on delete cascade,
  display_name text check (display_name is null or length(display_name) between 1 and 120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger profiles_updated before update on public.profiles for each row execute function private.set_updated_at();
alter table public.profiles enable row level security;
create policy "read own profile" on public.profiles for select to authenticated using (user_id = auth.uid());
create policy "create own profile" on public.profiles for insert to authenticated with check (user_id = auth.uid());
create policy "update own profile" on public.profiles for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select on public.profiles to authenticated;
grant insert (user_id, display_name) on public.profiles to authenticated;
grant update (display_name) on public.profiles to authenticated;

/* ------------------------------------------------------- brand: website */

alter table public.brand_profiles add column website text check (website is null or website ~* '^https?://[^\s]+$');
grant insert (website, logo_media_id) on public.brand_profiles to authenticated;
grant update (website) on public.brand_profiles to authenticated;

/* ------------------------------------------------ brand: version history */

-- Every saved version of a brand profile, written by trigger (users cannot edit history).
-- Briefs and storyboards record the version they were made with, so a later brand
-- edit never changes what an existing project was based on.
create table public.brand_profile_versions (
  brand_id uuid not null,
  org_id uuid not null references public.organisations on delete cascade,
  version integer not null,
  snapshot jsonb not null,
  created_by uuid references auth.users on delete set null,
  created_at timestamptz not null default now(),
  primary key (brand_id, version),
  foreign key (brand_id, org_id) references public.brand_profiles (id, org_id) on delete cascade
);
alter table public.brand_profile_versions enable row level security;
create policy "members read" on public.brand_profile_versions for select to authenticated using (private.is_org_member(org_id));
grant select on public.brand_profile_versions to authenticated;

create or replace function private.snapshot_brand_version() returns trigger
  language plpgsql security definer set search_path = '' as $$
begin
  insert into public.brand_profile_versions (brand_id, org_id, version, snapshot, created_by)
  values (new.id, new.org_id, new.version, to_jsonb(new) - 'org_id' - 'created_by', auth.uid())
  on conflict (brand_id, version) do nothing;
  return new;
end $$;
revoke all on function private.snapshot_brand_version() from public;
create trigger brand_profiles_version after insert or update on public.brand_profiles
  for each row execute function private.snapshot_brand_version();

insert into public.brand_profile_versions (brand_id, org_id, version, snapshot, created_by)
select id, org_id, version, to_jsonb(b) - 'org_id' - 'created_by', created_by from public.brand_profiles b
on conflict (brand_id, version) do nothing;

/* ------------------------------- which brand version a creative output used */

alter table public.video_briefs add column brand_id uuid, add column brand_version integer;
alter table public.storyboards add column brand_id uuid, add column brand_version integer;
grant insert (brand_id, brand_version) on public.video_briefs to authenticated;
grant insert (brand_id, brand_version) on public.storyboards to authenticated;
