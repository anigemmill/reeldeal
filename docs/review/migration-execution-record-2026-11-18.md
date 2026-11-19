# Migration execution record: 1117, 1118, 1119 on the live project

**This is the audit record of what was run on the live Reeldeal database, and when.** The approval
pack (`migration-approval-pack.md`) and the two detailed reviews are kept as they were when you
approved them. Their SQL appendices and the SQL files are unchanged, and the files still say
"prepared, not applied" in their header comments because they are the exact text that was reviewed.

| Item | Value |
|---|---|
| Project | `jzshbaqfrrgsyiciuzfe` (`reeldeal`, ap-southeast-2 Sydney, Postgres 17.11) |
| Approved by | The owner, in the session of 2026-11-18 ("approve all") |
| Applied by | Claude Code, through the Supabase connector (`apply_migration`), signed in to organisation "ANI" |
| Applied as | `postgres` (the project owner), one transaction per migration |
| Backup point | **Not verified.** The connector has no backup tool. The database held no customer data (0 users, 0 workspaces), so nothing could be lost |

## What was run, in order

Each migration's SQL was sent verbatim, except that the header comment block was left out.
Statements, grants and policies were unchanged. Each included, in the same transaction, the
bookkeeping row that `npm run db:migrate` writes:
`insert into reeldeal_meta.migrations (name) values ('<file>')`.

| # | File | `reeldeal_meta.migrations.applied_at` (UTC) | Supabase tracker version |
|---|---|---|---|
| 1 | `20261117000001_restricted_runtime_roles.sql` | 2026-11-18 07:35:56 | `20261118073556` `restricted_runtime_roles` |
| 2 | `20261118000001_teams_workspace_onboarding.sql` | 2026-11-18 07:38:52 | `20261118073852` `teams_workspace_onboarding` |
| 3 | `20261119000001_credit_rollover.sql` | 2026-11-18 07:50:42 | `20261118075042` `credit_rollover` |

The Supabase tracker's versions are the time of applying, not the file names. That's how the
connector records them, and the same was true for the first seven migrations.

## Checks (live, read-only)

| When | Check | Result |
|---|---|---|
| Before 1117 | Migrations recorded | 7 (up to `20261116000003`) |
| Before 1117 | Customer data | 0 users, 0 workspaces |
| After 1117 | Roles | `reeldeal_web` and `reeldeal_worker`: no login, no BYPASSRLS, not superuser, cannot create roles |
| After 1117 | Policies for the two roles | 33 (approval pack: 33) |
| After 1117 | `reeldeal_meta.migrations` | RLS on. `authenticated` has no usage on `reeldeal_meta` |
| After 1118 | New tables | `invitations`, `audit_events`, `user_preferences`, `billing_accounts`: RLS on. `private.rate_limits` exists |
| After 1118 | Functions | `rate_limit_hit` executable by `reeldeal_web`, not by `authenticated`. The team functions are executable by `authenticated` only |
| After 1118 | `organisations` columns | 16 (7 + 9 new) |
| After 1119 | `credit_period_closes` | Exists, RLS on. 4 ledger unique indexes (`credit_transactions_one_*`) |
| After all | Public tables | 22, none without RLS |
| After all | Grants | 0 anon grants (public, private, reeldeal_meta). 0 TRUNCATE for users. No callable public functions. No anon or authenticated usage on private schemas beyond `authenticated` on `private` |
| After all | Security advisor | 1 INFO notice: `reeldeal_meta.migrations` has RLS and no policies. This is intended: no one but the owner can read it. The earlier `media_uploads` notice is gone, because `reeldeal_web` now has policies there |
| After all | Customer data | 0 users, 0 workspaces |
| 2026-11-18 08:17 UTC (Mission 6 start) | Re-check | Both trackers hold 10 rows, including the three above. 22 tables, 0 without RLS, 0 users, 0 workspaces, both roles still have no login |

## Still to do (not done, each needs you)

1. **Passwords for the two roles.** Until they're set, nothing can connect as them, and every
   service still uses the owner connection. Steps: `docs/database-credentials.md`.
2. **Point the services at the roles.** Vercel `DATABASE_URL` → `reeldeal_web`, worker → `reeldeal_worker`.
3. **Deploy the code** that uses the 1118 and 1119 objects (the merged default branch).
4. **D-B2** (billing cycle and Stripe period): a recommendation is in `docs/credits.md`. It's not decided.

## Rollback

The scripts are unchanged: `supabase/rollback/2026111{7,8,9}*.down.sql`. Read section 5 of the
approval pack before using one. Rolling back 1118 deletes invitations and the audit log.
