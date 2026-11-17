/*
  Rollback for 20261119000001_credit_rollover.sql. Run by hand, only with approval.

  DATA EFFECT: deletes every 'rollover' and 'expiry' ledger row and the period-close history.
  Balances then return to "current month only": carried credits disappear from the current
  month, and the closed months show their unspent balance again (they're not spendable). No
  grants, holds, charges, releases or refunds are touched. Export first if you need the history:
    copy (select * from public.credit_transactions where kind in ('rollover', 'expiry')) to stdout csv header;
    copy (select * from public.credit_period_closes) to stdout csv header;
*/
begin;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'reeldeal_web') then
    drop policy if exists "server web carries and expires" on public.credit_transactions;
  end if;
end $$;
drop table if exists public.credit_period_closes;
delete from public.credit_transactions where kind in ('rollover', 'expiry');
drop index if exists public.credit_transactions_one_grant;
drop index if exists public.credit_transactions_one_expiry;
drop index if exists public.credit_transactions_one_rollover_out;
drop index if exists public.credit_transactions_one_rollover_in;
alter table public.credit_transactions drop constraint credit_transactions_kind_check;
alter table public.credit_transactions add constraint credit_transactions_kind_check
  check (kind in ('grant', 'hold', 'release', 'charge', 'refund', 'adjustment'));
delete from reeldeal_meta.migrations where name = '20261119000001_credit_rollover.sql';
commit;
