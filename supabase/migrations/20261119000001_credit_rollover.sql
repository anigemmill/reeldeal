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
