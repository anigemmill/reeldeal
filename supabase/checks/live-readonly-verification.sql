-- Read-only verification of the live Reeldeal project (jzshbaqfrrgsyiciuzfe).
-- Every statement is a SELECT. Run as one read-only transaction:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c 'begin read only' -f supabase/checks/live-readonly-verification.sql -c rollback
-- or statement by statement through the Supabase connector's SQL tool. It changes nothing.

-- 1. Identity
select current_database() as database, current_user as connected_as, current_setting('server_version') as postgres,
       inet_server_addr() as server_address, pg_postmaster_start_time() as started_at;

-- 2. Migrations recorded by the app (expect the 7 up to 20261116000003; 1117, 1118, 1119 absent)
select name, applied_at from reeldeal_meta.migrations order by name;

-- 3. Migrations recorded by Supabase's own tracker, if used
select case when to_regclass('supabase_migrations.schema_migrations') is null then 'not used on this database'
            else query_to_xml('select string_agg(version || '' '' || coalesce(name, ''''), '', '' order by version) as versions from supabase_migrations.schema_migrations', false, false, '')::text end
       as supabase_tracker;

-- 4. Tables in public, with RLS state and row counts (expect 17 tables, RLS on, 0 rows)
select c.relname as table_name, c.relrowsecurity as rls_on, s.n_live_tup as approx_rows
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  left join pg_stat_user_tables s on s.relid = c.oid
 where n.nspname = 'public' and c.relkind = 'r' order by 1;

-- 5. Exact customer-data counts (expect 0 everywhere before the pilot)
select (select count(*) from auth.users) as auth_users, (select count(*) from public.organisations) as organisations,
       (select count(*) from public.memberships) as memberships, (select count(*) from public.media_assets) as media,
       (select count(*) from public.credit_transactions) as ledger_rows, (select count(*) from public.api_tokens) as tokens;

-- 6. Objects the pending migrations would create (expect all false / 0 before approval)
select (select count(*) from pg_roles where rolname in ('reeldeal_web', 'reeldeal_worker')) as m1117_roles,
       to_regclass('public.invitations') is not null as m1118_invitations,
       to_regclass('public.audit_events') is not null as m1118_audit_events,
       to_regclass('public.credit_period_closes') is not null as m1119_period_closes;

-- 7. Policies per table
select tablename, policyname, roles, cmd from pg_policies where schemaname = 'public' order by 1, 2;

-- 8. Unexpected public permissions: anon grants, TRUNCATE for users, functions callable by anon/authenticated
select grantee, table_name, privilege_type from information_schema.role_table_grants
 where table_schema = 'public' and (grantee = 'anon' or privilege_type = 'TRUNCATE') and grantee in ('anon', 'authenticated') order by 1, 2;
select p.proname, has_function_privilege('anon', p.oid, 'execute') as anon, has_function_privilege('authenticated', p.oid, 'execute') as authenticated
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' order by 1;

-- 9. Default privileges that would expose future tables
select defaclrole::regrole as owner, defaclnamespace::regnamespace as schema, defaclobjtype as kind, defaclacl from pg_default_acl;

-- 10. Roles that can log in, bypass RLS or are superusers
select rolname, rolcanlogin, rolbypassrls, rolsuper, rolcreaterole from pg_roles where rolname !~ '^pg_' order by 1;

-- 11. Schema drift: columns in public, to compare with the local stack at the same migration level
select table_name, column_name, data_type, is_nullable, column_default
  from information_schema.columns where table_schema = 'public' order by table_name, ordinal_position;

-- 12. Auth schema version (compare with the local test stack: 20250904133000)
select max(version) as auth_schema_version from auth.schema_migrations;

-- 13. Extensions
select extname, extversion from pg_extension order by 1;
