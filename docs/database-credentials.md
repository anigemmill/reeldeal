# Database credentials: setting up the restricted roles

Status 2026-11-18. Migration 1117 is **applied** on the live project. `reeldeal_web` and
`reeldeal_worker` exist, but they **have no password and cannot log in**. Until the steps below are
done, every hosted service would have to use the owner login (`postgres`), which bypasses RLS.
**The production build refuses that** (see "Start-up check" below).

Nothing here has been done for you. Each step is yours: passwords are never set by Claude, and
they must never be pasted into a chat, an issue, a commit or a log.

## Which login each service uses

| Service | Database login | Connection | Port | Why |
|---|---|---|---|---|
| Next.js app on Vercel (pages, server actions, `/api/mcp`) | `reeldeal_web` | Supavisor **transaction** pooler | 6543 | Short serverless requests. The app sets `prepare: false` and uses `set local role` in every transaction, so transaction pooling is safe |
| FFmpeg worker (long-running host) | `reeldeal_worker` | Supavisor **session** pooler (or direct) | 5432 | Long jobs, `FOR UPDATE SKIP LOCKED` claims and heartbeats |
| Migrations, `workspace:bootstrap`, `infra:check` as owner | `postgres` | Session pooler | 5432 | Only from your own machine, only when you run them |

What each role can and can't do is listed in the 1117 review (`docs/review/migration-20261117000001-…`)
and tested by `src/server/db/restricted-roles.test.ts` (48 tests, also with real logins). Since
Mission 6 those tests also cover the 1118 and 1119 services: team, invitations, onboarding,
preferences, tokens, rate limits, billing overview and month-end rollover.

## Step 1: generate two passwords (your machine)

Make each password random and use it in one place only. For example:

```bash
openssl rand -base64 36 | tr -d '/+=' | cut -c1-40
```

Run it twice, once per role, and store each result in your password manager straight away.
**Letters and digits only** avoids having to URL-encode the password in `DATABASE_URL`.

## Step 2: set them (Supabase dashboard → SQL Editor)

Open the `reeldeal` project (`jzshbaqfrrgsyiciuzfe`), then **SQL Editor → New query**. Paste the
statement, replace the placeholder **in the editor only**, run it, then clear the editor without
saving the query:

```sql
alter role reeldeal_web with login password 'PASTE-WEB-PASSWORD-HERE';
```

```sql
alter role reeldeal_worker with login password 'PASTE-WORKER-PASSWORD-HERE';
```

Then check, without revealing anything:

```sql
select rolname, rolcanlogin, rolbypassrls, rolsuper from pg_roles where rolname in ('reeldeal_web', 'reeldeal_worker');
```

Expect `rolcanlogin = true`, `rolbypassrls = false` and `rolsuper = false` for both. Saved queries
in the SQL editor are visible to every project member, so **don't save** the query that contains
the password.

## Step 3: build the connection strings

In the dashboard: **Connect → Connection string → Supavisor** shows the pooler host for this
project (for Sydney, a host like `aws-…-ap-southeast-2.pooler.supabase.com`; copy it from there).
The user name is `<role>.<project-ref>`.

| Where | Value |
|---|---|
| Vercel `DATABASE_URL` (Production) | `postgresql://reeldeal_web.jzshbaqfrrgsyiciuzfe:<web password>@<pooler host>:6543/postgres` |
| Worker host `DATABASE_URL` | `postgresql://reeldeal_worker.jzshbaqfrrgsyiciuzfe:<worker password>@<pooler host>:5432/postgres` |

Previews: **don't** give Vercel Preview the production `DATABASE_URL` (see the token-environment
note in `docs/review/migration-approval-pack.md` section 6). Use a separate Supabase project or
branch for previews, or leave `DATABASE_URL` unset there.

## Step 4: check before deploying

From your machine, with the URL in your shell only (not a file in the repository):

```bash
DATABASE_URL='postgresql://reeldeal_web.jzshbaqfrrgsyiciuzfe:…@…:6543/postgres' npm run infra:check
```

The line **Database login** should read `reeldeal_web: the right login for the web service`. Do the
same with the worker URL (`reeldeal_worker: the right login for the worker service`).

## Start-up check (built in Mission 6)

`src/server/db/role-guard.ts`. In a **production** build:

- the web app (`getPlatform`) and the standalone MCP HTTP server must be logged in as `reeldeal_web`
- the worker (`npm run worker`) must be logged in as `reeldeal_worker`
- a login that bypasses RLS or is a superuser is refused even if its name matches

If the check fails the process doesn't start, and the error names the expected role. That way a
wrong `DATABASE_URL` shows up at deployment, not later as data exposed across workspaces.

`DATABASE_ROLE_CHECK=warn` turns the refusal into a logged warning. It's only for a deliberate
transition (deploying before the passwords exist, on the owner login), and `infra:check` flags it
while it's set. **Remove it once Step 4 passes.** Development and tests (`NODE_ENV` other than
`production`) aren't checked.

## Vercel and worker environment variables (complete list)

| Variable | Vercel (Production) | Worker host | Secret | Notes |
|---|---|---|---|---|
| `DATABASE_URL` | `reeldeal_web…:6543` | `reeldeal_worker…:5432` | Yes | Step 3 |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://jzshbaqfrrgsyiciuzfe.supabase.co` | not needed | No | |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | publishable key (`sb_publishable_…`) or legacy anon key | not needed | No | The build refuses a secret or service-role key here (Mission 6) |
| `NEXT_PUBLIC_SITE_URL` | the production origin, e.g. `https://app.<domain>` | not needed | No | Invitation links, auth redirects |
| `SIGNING_SECRET` | random, at least 32 characters | **the same value** | Yes | Quotes, signed links, rate-limit HMACs |
| `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET` | object-scoped token | same bucket; can be a separate object-scoped token | Yes | `docs/review/r2-cors-approval.md` |
| `OPENAI_API_KEY` | optional | optional (frame descriptions) | Yes | AI features are hidden without it |
| `RESEND_API_KEY`, `EMAIL_FROM` | when Resend is approved | not needed | Key: yes | Invitation emails (`docs/email-resend.md`) |
| `SENTRY_DSN` | when a project exists | same | No (but keep it private) | `docs/monitoring.md` |
| `DATABASE_ROLE_CHECK` | unset (= enforce) | unset | No | `warn` only during a planned transition |
| `SUPABASE_SERVICE_ROLE_KEY` | **never** | **never** | Yes | Not used by any code path |

## Rotation and rollback

- **Rotate:** run Step 2 with a new password, update the variable, redeploy or restart. The old
  password stops working at once, so update first in low traffic.
- **Back to the owner login (emergency only):** set `DATABASE_URL` to the owner session-pooler
  URL **and** `DATABASE_ROLE_CHECK=warn`. Then fix the cause and reverse both.
- **Disable a role:** `alter role reeldeal_web with nologin;` (services using it fail at once).
