-- Multipart uploads for large footage (R2/S3). One row per media asset while its
-- upload is in progress. Written by the server only; users have no access to it
-- (upload ids are useless without the server's storage credentials, but stay private).
create table public.media_uploads (
  media_id uuid primary key,
  org_id uuid not null references public.organisations on delete cascade,
  upload_id text not null,
  part_size_bytes bigint not null check (part_size_bytes >= 5242880),
  part_count integer not null check (part_count between 1 and 10000),
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  foreign key (media_id, org_id) references public.media_assets (id, org_id) on delete cascade
);
alter table public.media_uploads enable row level security;
-- No policies and no grants: not reachable by anon or signed-in users.
revoke all on public.media_uploads from anon, authenticated;
