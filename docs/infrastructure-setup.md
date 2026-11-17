# Connecting real infrastructure (development)

> **Status 2026-11-18.**
> - **R2: connected.** The credentials work, the bucket is private, and the 12 real-bucket tests pass.
>   **CORS is still to apply** (step 4.3); lifecycle and public access can only be checked in the
>   dashboard.
> - **Supabase:** live checks are waiting for access. `npm run infra:check` now reports the Auth
>   version, email confirmation, sign-in methods, unexpected tables or functions, and the restricted
>   roles.
>
> Details: `docs/production-plan.md` section 0.

This is the owner's checklist for connecting the existing MCP server and video engine to a real
Supabase project, a real Cloudflare R2 bucket and OpenAI. Nothing here deploys anything publicly.

Everything that could be done without credentials has been built and checked against stand-ins that
run the same software (`infra/local`: Supabase's own Postgres image with Supabase Auth, an S3-compatible
store, and the worker container). What's left needs your accounts.

## What is missing

| # | Item | Who | Where it goes | Status |
|---|---|---|---|---|
| 1 | A **new, dedicated** Supabase project for Reeldeal development | You | Supabase dashboard (your Vercel-linked org) | Missing |
| 2 | Its database connection string (session pooler) and password | You | `.env.local` → `DATABASE_URL` | Missing |
| 3 | Its project URL and publishable (anon) key | You | `.env.local` → `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Missing |
| 4 | Two test users in Supabase Auth (for the isolation test) and your own user | You | Supabase → Authentication → Add user | Missing |
| 5 | A Cloudflare R2 bucket (private) | You | Cloudflare dashboard | Missing |
| 6 | An R2 API token scoped to that bucket (Object Read & Write) | You | `.env.local` → `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET` | Missing |
| 7 | An OpenAI API key for Reeldeal (with a monthly spend limit) | You | `.env.local` → `OPENAI_API_KEY` | Missing. The live AI checks so far used this session's own AI integration, which is not yours to deploy |
| 8 | A signing secret | You (one command) | `.env.local` → `SIGNING_SECRET` | Missing |
| 9 | A worker host (Fly.io, Railway, Render or a VM) | Decision | Later; not needed for local testing | Not chosen |
| 10 | OAuth authorisation server for remote MCP | Later phase | Supabase Auth → OAuth server | Deliberately not connected yet |

Not needed: the Supabase **service-role key**. Nothing in Reeldeal uses it. User requests run as the
`authenticated` role under RLS; trusted server work (workers, the ledger) uses the database connection.

### Important: do not reuse the existing Supabase projects

Your Supabase org already has `Tourism-AI-Growth-Platform` and `supabase-coquelicot-branch` (both active,
with another product's live data and users) and `supabase-aero-drum` (paused). I only listed their tables;
nothing was changed. Reeldeal must get its own project: the migrations create tables such as `projects`,
`organisations` and `jobs`, and set default privileges for the `public` schema project-wide.

## Step by step

Keep every value in `.env.local` on your own computer (it is git-ignored). Don't paste credentials into
chat or commit them. `npm run infra:check` tells you after each step whether it works, without printing
any values.

### 1. Supabase project

1. Supabase dashboard → **New project**. Name `reeldeal-dev`, region **Sydney (ap-southeast-2)**, a
   strong database password (store it in your password manager). This may cost money depending on your plan.
2. **Project Settings → Database → Connection string → Session pooler**. Copy it into `.env.local`:
   `DATABASE_URL=postgresql://postgres.<ref>:<password>@aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres`
3. **Project Settings → API**: copy the Project URL and the publishable (anon) key into
   `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
4. **Authentication → Users → Add user** (auto-confirm), three times:
   - you (your real email), for your own workspace
   - `INTEGRATION_USER_A_EMAIL` / `_PASSWORD` and `INTEGRATION_USER_B_EMAIL` / `_PASSWORD`: two test users;
     put their emails and passwords in `.env.local` too

5. **Authentication → URL Configuration** (needed by the web app): Site URL = your app URL
   (`http://localhost:3000` for local use); add `http://localhost:3000/auth/callback` to
   Redirect URLs. Password-reset and confirmation emails link back through it.
6. New accounts must confirm their email (D10): turn on **Confirm email** and **Secure email change**
   (Authentication → Providers → Email), and install the templates in `supabase/templates`.
   Custom SMTP (Resend) comes first: `docs/email-resend.md`. The app enforces confirmation either way.

### 2. Apply the migrations (first change to the database: needs your go-ahead)

```bash
npm run db:migrate -- --plan
```

This lists the 4 pending migrations and changes nothing. All of them only add things: tables, policies,
grants, constraints and indexes (`npm run check:migrations` enforces that). They drop and delete nothing.
When you're happy:

```bash
npm run db:migrate -- --apply
```

Then `npm run infra:check` should show the migrations applied, RLS on every table, no anon grants and
no TRUNCATE grants.

### 3. Your workspace and MCP token

```bash
npm run workspace:bootstrap -- --email you@example.com --org "Lakeside Lodge" --plan creator --scopes mcp:read,mcp:write,mcp:render --token-name "Claude Desktop"
```

This creates the workspace for your existing Supabase user and prints a token once. Add it to Claude
with [`connect-claude.md`](connect-claude.md).

### 4. Cloudflare R2

1. Cloudflare dashboard → **R2 → Create bucket**: `reeldeal-dev-media`, location hint **Oceania**. Leave
   public access **off**.
2. **R2 → Manage API tokens → Create API token**: permission **Object Read & Write**, applied to
   **this bucket only**. Copy the Access Key ID and Secret Access Key (shown once) and your Account ID
   into `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_ACCOUNT_ID`; set `R2_BUCKET=reeldeal-dev-media`.
3. Bucket rules: [`infra/r2/lifecycle.md`](../infra/r2/lifecycle.md): abort incomplete multipart uploads
   after 7 days, and **CORS is now required** because the web library uploads straight from the
   browser: allow your app origin with `PUT`, `GET`, `HEAD` and the headers `content-type` and
   `if-none-match` (`infra/r2/cors.json`, edit the origin).
4. `npm run infra:check` should show the bucket reachable and private.

### 5. OpenAI and the signing secret

- OpenAI platform → a project for Reeldeal → API key → `OPENAI_API_KEY`. Set a monthly budget limit on
  the project.
- Signing secret:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

Put the output in `SIGNING_SECRET`. Use a different value for every environment.

### 6. Run a worker (local first)

```bash
npm run worker
```

Or the same container the hosted worker will use:

```bash
docker build -f infra/worker/Dockerfile -t reeldeal-worker .
```

```bash
docker run -d --name rd-worker --env-file .env.local reeldeal-worker
```

### 7. The full integration test

With the worker running:

```bash
npm run integration:live -- --ai --footage path/to/a-real-clip.mp4
```

This signs in the two test users through Supabase Auth, checks RLS with their real JWTs, and then, as user
A over MCP: creates a brand, uploads your footage (multipart if it's over 100 MB), analyses it, searches
for it, creates a project, writes a brief, concepts and storyboard with OpenAI (three paid calls),
renders a real MP4, downloads it through a signed URL and checks it. Then it confirms user B gets
`not_found` for every one of A's ids. It creates two "Integration" workspaces and leaves the data in
place (nothing is deleted). Its tokens are revoked at the end.

Then the worker restart test (spends one credit):

```bash
npm run worker:restart-test -- --kill "docker kill -s KILL rd-worker" --start "docker start rd-worker"
```

## Hosting the worker (decision needed, nothing deployed)

The worker needs Node 22, FFmpeg, about 2 GB RAM per concurrent render, temporary disk of about 3× the
largest original, and outbound access to Supabase, R2 and OpenAI. It accepts no inbound traffic.
`infra/worker/Dockerfile` runs on any container host. Options:

| Host | Fit |
|---|---|
| Fly.io Machines (Sydney) | Close to Supabase and R2 Oceania; scale to zero is possible with a wake-up job |
| Railway / Render background worker | Simplest dashboards; always-on billing |
| A small VM (e.g. Hetzner, Lightsail) | Cheapest steady cost; you manage updates |

Environment for the host: `DATABASE_URL`, `R2_*`, `SIGNING_SECRET`, optionally `OPENAI_API_KEY`
(only for consented AI frame descriptions). On shutdown it finishes the current job within
`WORKER_SHUTDOWN_GRACE_SECONDS` (default 25) or hands it back to the queue. A crashed worker's job is
picked up by another after `WORKER_STALE_SECONDS` (default 120).

## Running these checks from a Claude cloud session instead

This cloud session can reach Supabase's HTTPS APIs and R2 once their hosts are allowed in the
environment's network settings, but Postgres connections (TCP 5432/6543) may not pass its HTTPS-only
proxy, and secrets would have to be stored as environment variables, which are plain text. Running
the steps above on your own computer is the safer path. If you want me to run them here, say so and I'll
propose the exact network change.
