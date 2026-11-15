-- Worker reliability. No data is changed.
-- claim_count: how many times a worker has picked the job up. A job whose worker keeps
-- dying (crash, out of memory, host restart) is failed after max_attempts claims
-- instead of being requeued forever. `attempt` stays the user-visible retry number.
alter table public.jobs add column claim_count integer not null default 0;

-- A job can hold, release and charge credits at most once each, whatever happens to
-- workers: two workers finishing the same job can never charge twice.
create unique index credit_transactions_once_per_job
  on public.credit_transactions (job_id, kind)
  where job_id is not null and kind in ('hold', 'release', 'charge');
