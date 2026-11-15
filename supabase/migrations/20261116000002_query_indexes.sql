-- Indexes for the web app's hot paths (additive). Each matches a query in the services:
create index if not exists jobs_media_idx on public.jobs (media_id, created_at desc) where media_id is not null;      -- analysis status per clip (library, activity)
create index if not exists jobs_project_idx on public.jobs (project_id, created_at desc) where project_id is not null; -- renders per project (Autopilot, Studio)
create index if not exists jobs_running_idx on public.jobs (heartbeat_at) where status = 'running';                    -- stale-job sweep in every worker loop
create index if not exists exports_project_idx on public.exports (project_id, created_at desc);
create index if not exists exports_job_idx on public.exports (job_id);
create index if not exists video_briefs_project_idx on public.video_briefs (project_id, created_at desc);
create index if not exists video_concepts_project_idx on public.video_concepts (project_id, created_at desc);
create index if not exists media_assets_activity_idx on public.media_assets (org_id, updated_at desc);                 -- processing activity
create index if not exists credit_transactions_history_idx on public.credit_transactions (org_id, created_at desc);   -- credit history
create index if not exists project_media_media_idx on public.project_media (media_id);
