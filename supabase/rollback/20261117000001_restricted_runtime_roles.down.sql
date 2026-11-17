-- ROLLBACK for migrations/20261117000001_restricted_runtime_roles.sql. Never applied
-- automatically (this folder is not read by npm run db:migrate). Run by hand as the
-- owner, only with approval, after pointing every service back at the owner connection:
--   psql "$OWNER_DATABASE_URL" -v ON_ERROR_STOP=1 -1 -f supabase/rollback/20261117000001_restricted_runtime_roles.down.sql
-- It touches no customer data: it removes the two roles, their grants and policies,
-- and restores the previous (default) state of reeldeal_meta.

-- 1. Policies created for the two roles. -- reviewed: destructive (rollback only)
do $$
declare r record;
begin
  for r in select schemaname, tablename, policyname from pg_policies
            where schemaname = 'public' and (policyname like 'server web %' or policyname like 'server worker %') loop
    execute format('drop policy %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;
end $$;

-- 2. Every privilege held by the roles, then the roles themselves.
--    Fails safely (whole script rolls back with -1) if a session is still connected as either role.
revoke authenticated from reeldeal_web;
revoke all on all tables in schema public from reeldeal_web, reeldeal_worker;
revoke all on schema public, private from reeldeal_web, reeldeal_worker;
revoke all on function private.tags_text(text[]), private.set_updated_at() from reeldeal_web, reeldeal_worker;
drop role if exists reeldeal_web;
drop role if exists reeldeal_worker;

-- 3. reeldeal_meta back to how db:migrate created it (no RLS; no grants were ever given).
alter table reeldeal_meta.migrations disable row level security;

-- 4. Forget the migration so it can be applied again later.
delete from reeldeal_meta.migrations where name = '20261117000001_restricted_runtime_roles.sql';
-- If it was also applied through the Supabase dashboard or MCP, remove that record too:
-- delete from supabase_migrations.schema_migrations where name = 'restricted_runtime_roles';
