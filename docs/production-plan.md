# Production accounts and backend: audit and roadmap

Status: **Mission 4 checkpoint (2026-11-18): live R2 verified; customer backend prepared and tested locally; two migrations awaiting approval.** The current checkpoint is section 0; the previous one follows it. Decisions are in section 12. No application code, database or
infrastructure was changed while writing it. The only live checks were read-only (2026-11-16):

- Supabase: listed projects, tables, migrations and security advisors.
- Cloudflare: listed the R2 bucket.

Evidence labels used below:

- **Local**: verified on embedded or containerised Postgres and local stand-ins (`npm test`: 132 passed and
  8 skipped, where the skipped tests need live credentials).
- **Live**: observed on the real Supabase project or the real R2 bucket.
- **Unverified**: built, but never exercised against real infrastructure.

---

## 0. Checkpoint: 2026-11-18 (Mission 4)

Branch `claude/eager-edison-iwtva8`, on top of `0a69462`.

### Live infrastructure (real services, not local)

**Cloudflare R2: connected and verified.** Credentials are set in this environment as `R2_*` (never
printed); `R2_BUCKET=reeldeal-dev-media`.

| Check | Result |
|---|---|
| `npm run infra:check` | Bucket reachable with the credentials; unsigned request refused (HTTP 400) |
| Real-bucket test suite (12 tests) | **All pass** against `reeldeal-dev-media`: signed PUT, **no overwrite of an existing original**, tampered, expired and header-stripped links refused, multipart upload and download intact, abort, dropped-part retry, missing-part recovery, cancel, conditional single PUT |
| Clean-up | 0 objects and 0 open multipart uploads left in the bucket afterwards |
| Token scope | Least privilege: can't read bucket settings or list buckets (403) |
| **CORS** | **Not configured for the app origin:** a browser preflight from `http://localhost:3000` gets 403 with no CORS headers. **Browser uploads to the real bucket will fail until it is set.** Needs your approval; command below |
| Lifecycle (abort incomplete multipart after 7 days) | **Unverifiable** with an object-scoped token; check in the dashboard |
| Public access (r2.dev / custom domain) | Unverifiable via the S3 API; the S3 endpoint is private; check "Public access: off" in the dashboard |

To apply CORS (approval needed; dashboard → R2 → `reeldeal-dev-media` → Settings → CORS policy, or):

```bash
npx wrangler r2 bucket cors set reeldeal-dev-media --file infra/r2/cors.json
```

Add the preview or production app origin to `infra/r2/cors.json` before it's used from there.

**Supabase: blocked; read-only checks not possible this session.**

- The Supabase connector is now linked to a different Supabase account. It only sees one new project
  (Tokyo, created 2026-11-17) and is refused on `reeldeal`. That other project was **not touched**.
- This environment has none of `DATABASE_URL`, `NEXT_PUBLIC_SUPABASE_URL` or
  `NEXT_PUBLIC_SUPABASE_ANON_KEY`. The project's API answers, but needs the publishable key.
- **Unblock** (either):
  - add the two public values (URL plus publishable key), and optionally a read-only `DATABASE_URL`,
    to the environment
  - or re-link the connector to the Vercel-linked Supabase organisation
- Then run `npm run infra:check`. It now also reports:
  - Auth version vs local (v2.180.0)
  - email confirmation on/off and enabled sign-in methods
  - unexpected tables or callable functions
  - private-schema access and whether the restricted roles exist
  - the Auth schema migration level
- It was proven against the local stack. Site URL, redirect URLs, SMTP, secure email change and
  rate limits are dashboard-only.
- Last confirmed state (2026-11-16, read-only): 7 migrations applied, RLS on all 17 tables, no anon
  grants, 0 users.

### Prepared migrations (not applied)

| Migration | Purpose | Review |
|---|---|---|
| `20261117000001` | Restricted runtime roles | `docs/review/migration-20261117000001-restricted-runtime-roles.md` |
| `20261118000001` (new) | Teams, invitations, audit log, workspace and onboarding fields, preferences, token environment, auth rate limits, billing scaffold | `docs/review/migration-20261118000001-teams-workspace-onboarding.md` |

**Restricted roles (`20261117000001`) in short:**

- **What the roles do.** `reeldeal_web` (the app and `/api/mcp`) switches to `authenticated` for user
  work, so RLS applies as today. As itself, it can only do the few server writes the app needs.
  `reeldeal_worker` can only run jobs and write analysis, exports, charges and releases.
- **Why it's safer.** Today the services log in as `postgres`, which bypasses RLS and can create roles.
  A bug or injection in trusted code could touch any organisation's data. The roles can't bypass RLS,
  delete, change plans, read `auth.users` or tokens (worker), or create roles.
- **What changes on apply.** Two roles that can't log in, plus their grants and policies, and the
  `reeldeal_meta` lock-down. Nothing else changes until the services' `DATABASE_URL` is switched.
- **Credentials afterwards.** You set passwords by hand:
  - `alter role reeldeal_web with login password '…'`, and the same for `reeldeal_worker`
  - pooler user names `reeldeal_web.jzshbaqfrrgsyiciuzfe` (port 6543) and `reeldeal_worker.<ref>` (port 5432)
  - stored only in the host's secret store
- **Transition.** The worker first, then the app: change `DATABASE_URL`, restart, run
  `npm run infra:check`. The owner URL stays on your own machine for migrations and admin scripts.
- **Rollback.** Point `DATABASE_URL` back to the owner (instant). Then, optionally, run the rollback
  script: it drops only the roles, grants and policies, and was tested on a database with real data.

### Customer backend (local; services and tests, not yet wired to the screens)

Map: `docs/backend-integration.md`.

- **Team:** `services/team.ts` over the migration's functions. 25 permission tests cover every rule
  (one owner; no self-elevation; admins can't take ownership; removed members lose access at once;
  invitations org- and address-bound, expiring, single-use, revocable).
- **Access tokens:** `services/access-tokens.ts` (role-limited scopes, required expiry, cap,
  web-session only). Tokens are now bound to their environment: a development token is refused by
  production. 10 tests.
- **Workspace, onboarding, preferences:** `services/workspace-settings.ts`. Onboarding resumes after
  sign-out; only the owner is asked.
- **Usage and billing:** `services/billing.ts`, plus a tested real-page mapping that never shows sample
  values. The billing screen gained a live "Billing not set up" state
  (`/design-system/screens/billing/free`).
- **Auth hardening:** app-side rate limits per visitor IP and per email, in Postgres
  (`docs/auth.md`). Supabase's own limits stay on.
- **Defects found and fixed:** duplicate brand profiles on a double-submitted "Create workspace", and
  a race past the plan's brand limit. Both have regression tests.
- **Security review:** `docs/security-review.md` (7 new regression tests; no isolation weakness found).
- **UX issues to resolve before wiring:** U1–U12 in `docs/backend-integration.md`.

### Test results (local unless stated)

| Suite | Result |
|---|---|
| R2 storage suite against the **real** bucket | 12 / 12 pass |
| Unit, service and permission tests, PGlite | 287 passed, 10 skipped |
| Same on `supabase/postgres:17.6.1.166` | 284 passed, 8 skipped |
| Browser journey (local Supabase Auth + Postgres + S3 + mail catcher) | 93 / 93 |
| Accessibility: 16 themes × 27 pages + 16 phone layouts, keyboard, reduced motion | No WCAG 2.2 A/AA violations; all pass |
| Production build, types, lint, migration safety, secret scan, token check, pricing | All pass |

### Next stage (proposed, in order)

1. **Approvals:** R2 CORS; migrations `20261117000001` and `20261118000001`; the Supabase access
   needed for the live checks.
2. **Live verification:** `infra:check` on Supabase; apply the migrations; switch the worker, then the
   app, to the restricted roles; first live end-to-end run with real R2 (a separate report).
3. **Wire the screens** (after your design feedback and fixes U1–U12):
   - Account (already live)
   - Team, including `/invite/[token]` and copy-link until email
   - Access tokens
   - Workspace
   - Usage and billing (live mapping)
   - Onboarding steps 4–7, plus the resume card
4. **Resend + Supabase SMTP**, then the live auth test plan (`docs/auth.md`).
5. **Hosting** (Vercel preview, Fly.io worker), Sentry, then a pilot customer.

### Outstanding launch requirements

- **Configuration:**
  - R2 CORS and lifecycle; confirm public access is off
  - Supabase Auth settings, SMTP and templates
  - migrations applied; services on the restricted roles
- **Accounts and services:**
  - Resend domain and DNS
  - OpenAI production key and budget
  - hosting (app and worker); Sentry
- **Product:**
  - Stripe billing
  - workspace and account deletion (retention decision)
  - credit rollover in the ledger (D-B1)
  - Terms and Privacy final text
  - final product name and domain
  - Google sign-in (D5)
  - OAuth for public MCP (D6)
- **Tests on live services:**
  - live auth plan
  - live isolation run (`integration:live`)
  - load test of the sign-in path (R6)

## 0b. Checkpoint: 2026-11-17 (after Stage 3)

### Done, and tested locally
- **Email verification required (D10).**
  - Sign-up goes to `/verify-email`: the address, a resend button with a visible one-minute
    cooldown, and links to start again or sign in.
  - The proxy, pages and server actions refuse an unconfirmed account. Signing in before confirming
    leads back to verification.
  - The email-link handler (`/auth/callback`) gives each flow its right outcome: confirmed, already
    confirmed, and expired or used.
- **Branded auth email templates** (`supabase/templates/`) with token-hash links. These work on any
  device; Supabase's default links only work in the browser that asked for them (a real problem
  found by the tests).
- **Account settings** (`/settings/account`):
  - change name
  - change email (secure change: both addresses confirm)
  - change password, with the current password required
  - sign out, and sign out everywhere (with confirmation)
  - account details, and the verified state
- **Terms of Service and Privacy Policy** pages: structure with bracketed placeholders, a visible
  draft notice, and `noindex`. The consent checkbox on sign-up is required.
- **Accessibility fixes:**
  - The media detail page lost its `<title>` during navigation. Fixed by updating the URL in place,
    with no server re-render. The same fix applies to Autopilot.
  - Closing media details dropped keyboard focus on `<body>`. It now returns to the item.
- **Designs for review (D7)**, all built as real components on labelled sample data:
  - onboarding (7 steps, plus the invited variant)
  - workspace settings, team management, usage and billing, access tokens
  - screenshot pack at three sizes in light and dark (`npm run review:shots`)

### Found during Stage 3, and handled
- Supabase Auth v2.180 ignores `current_password`. The app checks the current password itself.
- Default (PKCE) email links fail across devices. Token-hash templates fix this.
- Supabase Auth allows one confirmation email per address per minute. The app shows a clear message.

### Test results (local only; nothing here ran against live services)
| Suite | Result |
|---|---|
| Unit, service and privilege tests, embedded Postgres | 219 passed, 10 skipped |
| Same, on Supabase's Postgres image (`supabase/postgres:17.6.1.166`) | 216 passed, 8 skipped |
| Browser journey, local Supabase Auth + Postgres + S3 + mail catcher (`npm run test:e2e`) | 93 of 93 |
| Accessibility (`npm run test:a11y`): 16 theme sets × 26 pages, plus 17 phone layouts; keyboard and reduced-motion checks | No WCAG 2.2 A/AA violations; all keyboard checks pass |
| Types, lint, migration safety, secret scan, token check, pricing config, production build | All pass |

### Outstanding infrastructure (none of it is complete; local tests don't count)
| Item | State | Needs |
|---|---|---|
| Cloudflare R2: real bucket tests | Bucket exists; privacy, CORS, lifecycle and token unverified; storage tests never run against it | Scoped R2 token in your `.env.local`, then `npm run infra:check` and the R2 tests |
| Supabase Auth email | Built-in mailer (won't reach customers); templates not installed; confirmation setting unverified on the live project | Resend + domain, then SMTP and template setup (`docs/email-resend.md`), with approval |
| Restricted database credentials | Migration `20261117000001` prepared and tested, **not applied** | Your review and approval (`docs/review/`) |
| Resend account and sending domain | Not created | Account, region, domain, DNS (approval) |
| App hosting and worker | Nothing deployed | Hosting approval (Vercel preview, Fly.io worker) |
| OpenAI production key | Not set | Key with a monthly budget limit |
| Sentry (D9) | Not set up | Before a real customer pilot |

### Next stage proposal
1. **Your review of the designs.** Changes first, then Stage 4 (onboarding steps 4–7, brand assets
   with the `document` media kind, `user_preferences`) and Stage 5 (invitations, team, ownership
   transfer, workspace settings, audit log, token page).
2. **Stage 2 live items**, as soon as credentials arrive: R2 verification, Resend and Supabase SMTP,
   then the first live end-to-end run, kept separate from local results.

## 1. Summary

The foundations are stronger than a typical MVP. The data model, Row Level Security, per-column grants,
organisation isolation, the credit ledger, jobs, storage signing and the MCP authentication are all real,
tested and consistent. Most of this phase therefore **adds** to what exists (invitations, team management,
settings, a fuller onboarding, the billing scaffold, production plumbing) rather than rebuilding it.

Five things stand between today and real customers:

1. **Transactional email.** Supabase's built-in mailer only sends to your own team's addresses, at a few
   emails per hour. Without a custom SMTP provider, no customer can confirm an account or reset a password.
2. **Team features don't exist yet.** There are no invitations, member management, role changes, ownership
   transfer, account settings or workspace settings. The roles exist in the database, but nothing manages them.
3. **Security fixes before launch.** There is one confirmed open redirect, the server holds an over-powered
   database credential, there is no rate limiting on the web app's AI calls, and storage quotas are not
   enforced (section 5).
4. **Hosting.** Nothing is hosted yet: no app deployment and no worker host. CORS, the API token and the
   lifecycle rules on the R2 bucket are unverified.
5. **Legal pages.** There are no Terms or Privacy pages. The approved sign-up design (`design/website/W-Auth`)
   links to both, and they are needed for Google sign-in and email deliverability.

---

## 2. What exists today

### 2.1 Complete and working (local)

| Area | Where | Notes |
|---|---|---|
| Schema: organisations, memberships, brands (+ versions), media, analysis, projects, briefs, concepts, storyboards, jobs, exports, credit ledger, uploads, profiles, API tokens | `supabase/migrations/*` | 7 migrations, additive only, checked by `npm run check:migrations` |
| RLS on every table; `private.is_org_member(org, min_role)`; composite `(id, org_id)` foreign keys | `20261113000001` | Cross-tenant links are impossible at the database level |
| Least-privilege grants per column; anon has nothing; no TRUNCATE; storage keys constrained to the row's own organisation | `20261115000001` | Audited by `privileges.test.ts` |
| Two-organisation isolation tests | `services.test.ts`, `mcp.test.ts` | PGlite and PostgreSQL 16 |
| Supabase Auth with cookie sessions (`@supabase/ssr`), refresh in `src/proxy.ts`, `getUser` checked on every page and action | `src/server/app/session.ts` | Expired session shows "Your session ended" and returns the user to their page |
| Sign up, sign in, sign out, forgot and reset password (PKCE), sign-up confirmation notice when no session is returned | `src/app/(app)/(auth)/` | Server actions, so tokens never reach browser JS. Neutral reset reply (no account probing) |
| One-step onboarding: business name, industry, website, display name → organisation (Free plan, owner) + first brand + trial grant | `services/account.ts` | Double-submit safe; at most 5 owned workspaces per user |
| Workspace switcher (membership-checked httpOnly cookie) | `_actions/workspace.ts`, `app-nav.tsx` | |
| Every app feature on real services, under RLS, as the signed-in user | `docs/app.md` | Covers the dashboard, library, uploads (multipart), analysis, Autopilot, Studio, versions, render, exports and credits |
| Role checks in services (`requireRole`): editor to create and change, admin to delete and set consent. Viewer UI states in the library | `services/*` | |
| Credit ledger: holds, single charge on success, failed renders free, signed single-use quotes | `services/render.ts`, `usage.ts` | |
| Worker: claim, heartbeat, stale recovery, max attempts, graceful shutdown | `workers/*` | |
| MCP: hashed and scoped PATs bound to one organisation; OAuth 2.1 resource server (JWKS, audience, issuer); per-principal rate limit | `src/server/auth`, `src/mcp` | PATs are refused in production builds; remote MCP returns 503 until OAuth is configured |
| Environment validation, `server-only` secrets, secret scanning, security headers | `src/env`, `next.config.ts`, `scripts/check-secrets.ts` | |

### 2.2 Live infrastructure (observed read-only)

| Item | State |
|---|---|
| Supabase project **`reeldeal`** (`jzshbaqfrrgsyiciuzfe`, Sydney, Postgres 17) | Dedicated to Reeldeal. All 7 migrations applied; both migration trackers agree (7/7). Every table is empty. RLS is on for all 17 public tables |
| Supabase security advisor | (a) `media_uploads` has RLS but no policies. This is intentional: the table is server-only. (b) **`reeldeal_meta.migrations` has RLS disabled**, which the advisor rates *critical*. The schema is not exposed through the Data API, so real exposure is probably nil, but it is not yet confirmed. Fix in Stage 2 |
| Auth settings (email confirmation, SMTP, redirect URLs, password policy, rate limits) | Not readable through the tools available here. **Unverified**: check in the dashboard (Stage 2) |
| R2 bucket **`reeldeal-dev-media`** (Oceania, Standard) | Exists. Still to verify: public access off, API token scoped to this bucket only, CORS, and the abort-multipart lifecycle rule |
| Other Supabase projects (`Tourism-AI-Growth-Platform`, `supabase-coquelicot-branch`) | Not touched. They stay separate |
| App hosting, worker host, OpenAI key, email provider | Not set up |

### 2.3 Built, but not run against real services

- `npm run integration:live`: the full journey with two real Supabase users, real R2 and real AI.
- The R2 storage tests against the real bucket (part of the 8 skipped tests).
- Email links (confirmation and reset) through the real Supabase mailer.
- The worker in a hosted container.
- OAuth for remote MCP.

---

## 3. What's missing, by area

### Authentication
- **Email verification isn't enforced by the app.** Whether it applies depends on a dashboard setting.
  Onboarding doesn't check `email_confirmed_at`.
- No "check your email" screen with **resend**. Today it is an inline notice only.
- No **email change** (Supabase supports it, with confirmation sent to both addresses).
- No **password change in settings**. `updatePassword` accepts any live session without re-authentication,
  which is fine for a reset link but not for settings.
- No "sign out of all devices".
- The approved design shows **Continue with Google**, which isn't built (section 6).
- No Terms and Privacy pages, and no consent line on sign-up (the design has one).

### Onboarding
- A single form. It cannot join an existing workspace (there are no invitations), has no agency path, and
  has no brand assets step.
- **Brand guidelines as a document can't be stored.** Media kinds are video, image and audio only, so a
  PDF would need a new kind.

### Organisations and teams
None of the following exists. The role enum (`viewer < editor < admin < owner`) does, and it fits:

- Invitations
- Member list, role change and removal
- Leaving a workspace
- Ownership transfer
- Deleting a workspace
- Enforcing the plan's seat limit (`users` in `pricing.json`)
- An audit trail

### Settings
- Only **Appearance** exists, and the theme isn't saved per user (`user_preferences` was never added).
- Missing: Account, Workspace, Team, Usage and billing, and API tokens. Tokens can only be created with
  the `npm run mcp:token` CLI.

### Billing foundation
- `organisations.plan_id` and the ledger exist.
- There is no subscription record, no Stripe customer id, no status or period, and no invoice history.
- There is no path to change plans.

### Account lifecycle
- No account deletion or data export. You will need them for privacy compliance (Australian Privacy Act,
  GDPR for EU visitors).

---

## 4. Recommended production architecture

**Keep the current stack. Add only what real customers require.**

```
Browser ──► Next.js (Vercel, Sydney region)  ──► Supabase Postgres (RLS) ◄── Worker (container, FFmpeg)
             │  server actions, /api/mcp          ▲                              │
             │                                    │ Supabase Auth (email+pw,     │
             ├──► Supabase Auth ──── SMTP ────────┘ later Google)                │
             ├──► Email API (invitations, notices)                               │
             └──► presigned URLs ──► Cloudflare R2 (private) ◄───────────────────┘
                                         OpenAI (server/worker only)
```

New external services, kept to a minimum:

| Service | Why | Recommendation |
|---|---|---|
| **Transactional email** (required) | Supabase Auth SMTP (confirm, reset, email change) and our own invitation emails | **Resend** or **Postmark**, one provider for both. Needs a sending domain with SPF, DKIM and DMARC |
| App hosting | Next.js | **Vercel**. The code already reads `VERCEL_PROJECT_PRODUCTION_URL`, and your Supabase organisation is Vercel-linked |
| Worker hosting | FFmpeg jobs | **Fly.io Machines in Sydney** (see `infrastructure-setup.md`) |
| Error monitoring (optional, recommended) | Know about failures before customers report them | Sentry free tier, with PII scrubbing. Alternatively, keep JSON logs and Vercel log drains for now |
| Stripe | Billing | Separate stage. The schema below makes it a drop-in |

No Redis or extra queue: rate limiting and invitations live in Postgres.

### 4.1 Tenancy: keep "organisation = workspace"

The schema already treats the organisation as the workspace. Adding a separate workspace level under each
organisation would mean rewriting every policy and foreign key, for no customer benefit today. The four
customer types map onto the current model as follows:

| Customer | Model |
|---|---|
| Owner-operator | One workspace, one owner |
| Marketing manager | Creates the workspace (owner), or is invited as admin by the business owner |
| Agency | **One workspace per client business**, all with the agency user as a member. The existing switcher handles this. Onboarding asks "Is this for your own business or a client?". "Add a client workspace" sits in the switcher. A later "agency account" that groups client workspaces for billing can be added on top, without changing what exists |
| Team | Invitations into one workspace, with roles |

### 4.2 Roles and permissions

The existing roles fit, so no change is needed. The permission matrix (each row is enforced in both RLS
and the services):

| Capability | Viewer | Editor | Admin | Owner |
|---|---|---|---|---|
| View library, projects, exports; download | ✓ | ✓ | ✓ | ✓ |
| Upload, edit brands and projects, generate, render (spends credits) | | ✓ | ✓ | ✓ |
| Delete content; AI frame consent; workspace details | | | ✓ | ✓ |
| Invite and remove members; change roles below admin | | | ✓ | ✓ |
| Make or remove admins; billing and plan; transfer ownership; delete workspace | | | | ✓ |

The rules that go with it:

- Exactly **one owner** per workspace, who is also the billing contact.
- The owner can't leave or be removed without first transferring ownership.
- An admin can't change another admin or the owner.
- Invitations count against the plan's seat limit.

*Decision D3 below*: allow more than one owner?

### 4.3 New database objects

Each item is an additive migration and goes for review before it is applied (section 8).

- **`invitations`**: id, org_id, email, role (not owner), token hash, invited_by, expires_at (7 days),
  accepted_at, revoked_at.
  - The link carries a random token; only its hash is stored.
  - Accepting requires a signed-in user whose **verified** email matches the invitation.
- **Member management through `security definer` functions** in `private`. Users get no direct
  insert, update or delete grants on `memberships`, and each function enforces the rules in 4.2:
  - `create_invitation`
  - `accept_invitation`
  - `change_member_role`
  - `remove_member`
  - `leave_workspace`
  - `transfer_ownership`
- **`audit_events`** (server-written; admins can read): actor, org, action, target, metadata, at. It covers
  invitations, role changes, removals, ownership transfer, token creation and revocation, exports,
  consent changes and plan changes.
- **`user_preferences`**: theme palette, mode and type, and email notifications. Already designed in
  `security.md`.
- **`billing_accounts`** (one per organisation, server-written; the owner can read):
  - `stripe_customer_id`, `stripe_subscription_id`, `subscription_status`, `plan_id`, `billing_interval`
  - `current_period_end`, `cancel_at_period_end`
  - Stripe webhooks later write here and to `organisations.plan_id`. Until then every workspace is Free and
    the screen says so.
- **`rate_limits`**: a small Postgres token-bucket function, shared by server actions and MCP across all
  server instances.
- **Media kind `document`** (PDF, for brand guidelines), stored the same private way. No analysis job.

### 4.4 Database credentials

Today `DATABASE_URL` is the Postgres owner. The web server switches to `authenticated` for user work, which
is correct, but the same process can run `db.system()` with full owner rights. That is more power than
Supabase's service-role key, held by an internet-facing server.

Recommendation: two dedicated login roles.

- **`reeldeal_web`**, for Next.js and MCP.
  - It may `set role authenticated` and execute a small set of `security definer` functions for its
    server-owned operations: token verification, workspace creation, credit grants, upload completion,
    quotes and hold creation, and the member functions above.
  - It owns no tables and cannot read `auth.users` directly.
- **`reeldeal_worker`**, for the worker only.
  - Read and write on jobs, analysis, exports, ledger and media status. Nothing on tokens or memberships.

This is the largest single security change in the plan. About 30 `db.system()` call sites move behind
functions, and the existing tests cover them. It is in Stage 2 so everything after it is built the safe way.

---

## 5. Security findings

| # | Severity | Finding | Fix (stage) |
|---|---|---|---|
| S1 | **Fixed** (was High) | **Open redirect in `/auth/callback`.** `next=/\evil.com` passes the check (`startsWith("/") && !startsWith("//")`), and `new URL("/\\evil.com", origin)` resolves to `https://evil.com/` (verified). The result is a phishing redirect from a genuine Reeldeal email link. The sign-in action already rejects `/\` | One shared `safeNext` helper with an allow-list of app paths, plus a test (Stage 3, first commit, or sooner if you approve) |
| S2 | High (defence in depth) | The server's database credential is the table owner (4.4) | Dedicated roles (Stage 2) |
| S3 | Medium | **No rate limiting on web server actions.** AI brief, concepts and storyboard each cost OpenAI money per click. The MCP limiter is in-memory, so each serverless instance has its own count | Postgres-backed limiter for AI, uploads, invitations and sign-in adjacent actions. Per-organisation daily AI cap from `pricing.json`. OpenAI project budget as a backstop (Stage 6) |
| S4 | Medium | **Storage allowance not enforced.** Uploads up to 20 GB are accepted whatever the plan's `storageGB`. The presigned PUT can't cap size; completion records it | Check the quota when the upload is created (declared size) and again at completion (actual size). Over quota: refuse and delete (Stage 6) |
| S5 | **Fixed** (was Medium) | **Email verification not enforced in code** | Turn on "Confirm email" in Supabase. Onboarding, invitation acceptance and the app require `email_confirmed_at` (Stage 3) |
| S6 | **Fixed for settings** (was Medium) | **Password change without re-authentication** (any session can call `updatePassword`). Settings now require the current password; the reset flow still uses the emailed link | Settings asks for the current password (or Supabase's reauthenticate nonce). Turn on "Secure password change" and "Secure email change" (Stage 3) |
| S7 | Medium | **Default Supabase mailer** (not deliverable to customers) | Custom SMTP (Stage 2) |
| S8 | Low–Medium | CSP still allows inline scripts | Nonce-based CSP now that app pages render per request (Stage 7) |
| S9 | Low (measured: no access for anon or authenticated) | `reeldeal_meta.migrations` has RLS disabled (advisor: critical) | Revoke anon and authenticated on the schema, then enable RLS. Migration for your review (Stage 2) |
| S10 | Low | No audit trail for sensitive actions | `audit_events` (Stage 5) |
| S11 | Low | Password policy is 8 characters minimum, enforced client-side and through Supabase defaults | Set the same in Supabase. Enable leaked-password protection (Pro plan) (Stage 2) |
| S12 | Low | No account deletion or data export | Stage 5 (workspace deletion) and Stage 7 (account deletion) |
| S13 | Info | `media_uploads` RLS with no policies | Intentional (server-only). Document it and leave it |

Already right, and to be kept: no service-role key anywhere, tokens never logged, uniform "not found" for
foreign ids, per-column grants, quotes bound to org, user and version, and single-use confirmation.

---

## 6. Google sign-in and other providers

**Recommendation: add Google in Stage 3b, once the product name and domain are final. Leave the others for later.**

- The approved sign-up design already shows "Continue with Google". Tourism and hospitality businesses
  mostly run on Google Workspace, so it reduces friction.
- The code path exists: `/auth/callback` already exchanges PKCE codes. The extra work is roughly a day:
  - the button
  - linking accounts by verified email
  - handling invitations for Google users
- **Blocking dependencies:**
  - a Google Cloud OAuth client
  - a verified consent screen, which needs the final domain, app name, logo and Privacy and Terms URLs
  - `Reeldeal` is still a working name, so verifying under it risks redoing the work
- Microsoft (agencies and corporates), Apple and magic links: later, on demand.
- TOTP two-factor authentication: offer it to owners and admins after launch. Supabase supports it.

---

## 7. Onboarding journey

Goal: about 60 seconds to the dashboard. Everything beyond the essentials can be skipped and is offered
later as a dashboard checklist.

1. **Create account**: name, email, password, and the Terms and Privacy consent line. The plan picked on
   the pricing page is kept (already built).
2. **Check your email**: a dedicated screen with the address, a "Resend" button (rate-limited) and
   "Wrong address? Start again". The link confirms the account and continues.
3. **Join or create**:
   - If invitations are waiting for that verified email: "You've been invited to *Lakeside Lodge* as an
     Editor" → **Join**. Done; straight to the dashboard, no business questions.
   - Otherwise, create a workspace.
4. **Your business** (one screen): business name, industry, website, and "This workspace is for: my
   business / a client (agency)". This is today's form plus one question.
5. **Your brand** (optional; "Skip for now"): logo upload, brand colours (with suggestions), tone of voice
   in one line, guidelines PDF.
6. **Preferences** (optional, one screen): theme, and AI frame analysis consent explained in plain words
   (owner and admin only, off by default).
7. **Dashboard**, with a first-use checklist: upload footage, finish your brand, invite your team, make
   your first video. Part of it exists already.

The screens reuse `AuthCard`, the form primitives and the tokens: the same look as today's sign-in, with a
step indicator. There are no approved designs for onboarding steps, settings, team or billing. I'll build
them from the existing system and put screenshots (desktop, tablet, phone, light and dark) up for review
before wiring each one. Section 8, decision D7.

---

## 8. Phased roadmap

Each stage ends with:

- tests run, with local and live results reported separately
- screenshots at 1440, 820 and 390 px for any UI work
- a commit and push to `claude/eager-edison-iwtva8`
- a report of what's done and what's outstanding

Estimates are focused build sessions (about half a day each). Owner time is listed separately.

### Stage 1: Audit and architecture ✅ (this document)

### Stage 2: Production infrastructure (3–4 sessions; owner ~2 h)
- Verify R2: private, scoped token, CORS for the app origins, lifecycle rule. Run the 8 skipped storage
  tests against the real bucket.
- Supabase Auth configuration checklist:
  - confirm email
  - secure email and password change
  - Site URL and redirect URLs
  - password policy
  - auth rate limits
  - custom SMTP
  - branded email templates (written to match the product, in the repo)
- **Migration A (for approval):** the `reeldeal_web` and `reeldeal_worker` roles, the `security definer`
  functions, and the `reeldeal_meta` lock-down (S2, S9).
- Point local `.env.local`, the worker and `integration:live` at the real project. Run
  `integration:live` and the worker restart test. **First real end-to-end evidence.**
- Vercel project (preview deployments only, protected; no public domain) and a Fly.io worker,
  **only with your approval**.
- *Depends on:* email provider account and sending domain, R2 API token, OpenAI key, signing secret, hosting decisions.

### Stage 3: Authentication ✅ (local; see section 0)
- S1 fix first, then:
  - the check-your-email screen with resend
  - verification enforced (S5)
  - expired and used link states
  - sign out everywhere
  - Terms and Privacy pages (your copy, bracketed until supplied)
  - consent line
- The **Account** settings page: name, email change (two-sided confirmation), password change with
  re-authentication (S6), sign out.
- Tests: unit tests for redirect safety and action validation; browser tests for every auth path on the
  local Supabase Auth stack; then the same on the real project with test addresses.
- **3b, optional, after the domain is confirmed:** Google sign-in (about 2 sessions).

### Stage 4: Onboarding (3 sessions)
- The multi-step flow from section 7, with resumable progress (a reload keeps the step).
- Agency question; brand step with logo and colours; `document` media kind and migration for guideline
  PDFs; preferences step; `user_preferences` migration with the Appearance screen saving to it.
- Dashboard checklist.
- Persona walkthroughs (owner, manager, agency) as browser tests.

### Stage 5: Teams, roles and workspace management (4–5 sessions)
- Migration: `invitations`, `audit_events`, and the member functions.
- **Workspace** settings: name, details, AI consent, delete workspace (owner, typed confirmation).
- **Team**:
  - list members
  - invite by email with a role (seat-limited by plan)
  - resend and revoke invitations
  - change roles, remove members, leave
  - transfer ownership
- Invitation emails through the email provider.
- "Add a client workspace" in the switcher.
- Role-aware UI everywhere: disabled with a reason, matching the existing library pattern.
- Tests: the permission matrix as a table-driven test (every role × every action, in both RLS and
  services), invitation token tests (expiry, reuse, wrong email), last-owner rules.

### Stage 6: Backend integration and billing foundation (4 sessions)
- Feature-by-feature audit against the signed-in organisation. Most is already connected (`docs/app.md`).
  Confirm each with a sign out → sign in → resume test.
- Postgres rate limiter (S3), storage quota (S4), per-organisation AI caps.
- Seat, brand and storage limits shown in the UI with upgrade prompts. The prompts lead to "contact us"
  until Stripe exists.
- **Usage and billing** page: plan, credits, usage history from the ledger, subscription status from
  `billing_accounts` (Free / "Billing not yet available"), clearly labelled.
- **API tokens** page: create (shown once), list, revoke. Remote MCP's OAuth decision is separate (D6).

### Stage 7: Security and quality assurance (3–4 sessions)
- Isolation test suite run against the **real** Supabase project with two real users (extends
  `integration:live`).
- Nonce CSP (S8).
- Account deletion (S12).
- Supabase advisors clean.
- `npm audit`.
- Secrets scan.
- Signed-URL expiry tests on real R2.
- Accessibility: axe on every new page, plus keyboard-only runs of the full journey.
- Full browser journey at three viewports: register → verify → onboard → invite → teammate joins →
  upload → analyse → Autopilot → render → download → sign out → sign back in.
- Report with **local and live results kept separate**. No claim of production readiness without the live results.

**Total: about 21–26 sessions (roughly 11–13 working days), plus Stripe as its own stage (about 4–5 sessions).**

---

## 9. What I need from you

| # | Item | Needed for |
|---|---|---|
| 1 | Email provider account (Resend or Postmark) and a sending domain you control. DNS records for SPF, DKIM and DMARC: you add them, or approve me to | Stage 2 |
| 2 | Supabase dashboard access to Auth settings (or 15 minutes to apply my checklist) | Stage 2 |
| 3 | R2 API token for `reeldeal-dev-media` (Object Read & Write, this bucket only), in your `.env.local` or the hosting secret store, **not in chat** | Stage 2 |
| 4 | OpenAI API key for a Reeldeal project with a monthly budget limit | Stage 2 |
| 5 | Database password for `reeldeal`, to create the restricted roles; you can run that step yourself | Stage 2 |
| 6 | Hosting go-ahead: Vercel (preview only) and Fly.io (worker) | Stage 2 |
| 7 | Terms of Service and Privacy Policy text (I'll leave bracketed placeholders) | Stage 3 |
| 8 | Final product name and domain | Stage 3b (Google), email sender |
| 9 | Google Cloud project for OAuth | Stage 3b |
| 10 | Stripe account (later) | Billing stage |

## 10. Decisions needing your approval

| # | Decision | My recommendation |
|---|---|---|
| D1 | Approve the architecture in section 4: no separate workspace layer, one organisation per client for agencies | Yes |
| D2 | Approve migration A (restricted database roles and the `reeldeal_meta` lock-down) to be **written**. Applying it to the live project is a separate approval, after you've read the SQL | Yes |
| D3 | One owner per workspace, or several? | One (clear billing responsibility). Admins cover shared management |
| D4 | Email provider: Resend or Postmark | Resend (simpler, good Supabase SMTP docs). Postmark if deliverability matters most |
| D5 | Google sign-in: launch, or after? | After the name and domain are confirmed (Stage 3b) |
| D6 | Remote MCP for customers: enable Supabase OAuth server now, or keep PATs dev-only and add a tokens page? | Tokens page now (owner and admin only, workspace-scoped); OAuth before a public MCP launch |
| D7 | No designs exist for onboarding steps, settings, team and billing. OK to design them from the existing system, with screenshots for review before wiring? | Yes |
| D8 | Fix S1 (open redirect) now as a one-file change, ahead of Stage 3? | Yes |
| D9 | Error monitoring: Sentry now, or logs only? | Sentry free tier, with PII scrubbing |
| D10 | Require email verification before onboarding | Yes |

## 11. Risks

- **Email deliverability** is the most likely launch blocker. Set up the domain early; DNS takes time.
- **Restricted database roles** touch the trusted code paths. The existing tests (132) and the privileges
  audit make this safe, but it must land before new features are built on top.
- **Serverless database connections.** Vercel functions need Supabase's transaction pooler (port 6543).
  The driver already uses `prepare: false`; connection limits still need watching under load.
- **R6: server-side sign-in and the auth rate limit.** Sign-in, password checks and resends go from
  the app's server to Supabase Auth, so many customers share a few server IP addresses. Supabase's
  per-IP sign-in limit could block legitimate customers at busy times. Check and raise it in Stage 2;
  measure under load in Stage 7.
- **R7: auth server version.** The local Supabase Auth image (v2.180) didn't enforce
  `current_password`. The hosted project may run a different version: re-test password, email
  change and verification flows against the live project once SMTP is set up.
- **Unconfirmed brand name.** Anything verified externally (Google consent screen, email sender domain,
  OAuth client) may have to be redone if the name changes.
- **AI cost.** Until S3 lands, a signed-in user can trigger unlimited AI calls. Keep an OpenAI budget limit from day one.

## 12. Owner decisions (2026-11-16)

| # | Decision |
|---|---|
| D1 | Approved. One workspace per client organisation; no further workspace layer. Agencies use the existing switcher |
| D2 | Approved **for preparation only**. Migration `20261117000001` is written and tested; review in `docs/review/migration-20261117000001-restricted-runtime-roles.md`. Not applied live |
| D3 | Approved. One owner per workspace; admins manage the workspace and team; secure ownership transfer |
| D4 | Resend. Preparation and DNS plan in `docs/email-resend.md`. No DNS changes without approval |
| D5 | Google sign-in deferred until the name and domain are final |
| D6 | Build the token page (create, scopes, expiry, revoke). Full OAuth before any public MCP access; the development endpoint stays private |
| D7 | Approved. Screenshots for review before wiring. Autopilot, Studio and dashboard are not redesigned |
| D8 | Approved and done: `src/lib/safe-redirect.ts`, used by `/auth/callback` and the sign-in action, with regression tests |
| D9 | Sentry before a real customer pilot (not blocking development) |
| D10 | Approved. Verification required before onboarding, with a verification screen and resend |
