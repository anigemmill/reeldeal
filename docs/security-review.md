# Security review: customer journey (2026-11-18)

Scope: onboarding, team management, access tokens, workspace switching, media URLs, billing data
and route protection. Method: read the code paths, then prove each property with tests that run as
real users through RLS (PGlite and Supabase's Postgres image). **All results are local.** Nothing
here was run against the live project.

| Property | Result | Evidence |
|---|---|---|
| Organisation A can't read or write B's data | Holds | `services.test.ts` (isolation, no-filter RLS), `mcp.test.ts`, browser suite |
| Workspace switching doesn't leak | Holds: a foreign or forged workspace choice falls back to your own; multi-workspace users see only the selected one, with that workspace's role and credits | `security-regression.test.ts` |
| A context with a tampered organisation sees nothing | Holds (RLS, whatever role the app believed) | `security-regression.test.ts` |
| Foreign and missing projects and media are indistinguishable | Holds (same message) | `security-regression.test.ts` |
| Signed media URLs can't reach other organisations | Holds: keys are checked against the caller's namespace on every signing (path tricks refused); the database constrains keys per organisation | `security-regression.test.ts`, `storage.test.ts`, browser suite, **live R2 tests** |
| Removed members lose access | Holds: membership gone, tokens deleted, a stale context sees nothing | `team.test.ts` |
| Expired, revoked and used invitations fail; only the invited, confirmed address accepts | Holds | `team.test.ts` |
| Users can't raise their own role; admins can't take ownership; one owner | Holds (no write grants on memberships; definer functions; unique index) | `team.test.ts` |
| Revoked and expired tokens stop working; development tokens refused in production | Holds | `access-tokens.test.ts`, `services.test.ts` |
| Customers can't change their plan, credits or billing record | Holds (no grants) | `customer-integration.test.ts`, `privileges.test.ts` |
| Unauthenticated users can't open app routes | Holds; every app route folder is checked against the proxy list | `security-regression.test.ts`, browser suite |
| Unverified users can't reach onboarding or the app | Holds | Browser suite |
| Open redirects | Fixed earlier (S1); regression tests | `safe-redirect.test.ts`, `route.test.ts` |
| Invitation tokens stay out of logs, URLs sent to the server, and Referer headers (Mission 5) | Holds: fragment only, removed from the address bar, POST body, hashed before any query, `no-referrer` | Browser suite (every request URL and Referer recorded and checked) |
| Someone else's invitation link reveals nothing (Mission 5) | Holds: "different address", no workspace, role or inviter | `team.test.ts`, browser suite |
| Credit ledger can't be double-carried or written by clients (Mission 5) | Holds: unique indexes, credit lock, no client grants | `credit-rollover.test.ts` |
| Sign-in brute force and credential stuffing limited without locking out shared offices (Mission 5) | Holds (failures only) | `rate-limit.test.ts` |

## Defects found and fixed in this review

1. **Duplicate brand profiles on double submit.** Simultaneous "Create workspace" submissions made one
   workspace but several brand profiles, past the plan's limit. Fixed: the first brand is created
   under a per-workspace lock, and `createBrand`'s limit check and insert now run in one locked
   transaction. Regression tests for both.
2. **Brand-limit race.** Two simultaneous `createBrand` calls could exceed the plan's brand limit.
   Same fix, same tests.

## Open items (not defects in the code; need decisions or live infrastructure)

- **R2 CORS is not configured** (approval requested: `docs/review/r2-cors-approval.md`). Browser
  uploads to the real bucket fail until it is (verified with a real browser; nothing written).
- **Auth rate limits.** Raise Supabase's per-IP limit after the app limits are live; ask about
  `Sb-Forwarded-For` (R6; question drafted in `docs/review/supabase-support-question.md`).
- **The services still use the owner database connection** until migration `20261117000001` is
  approved and the services move to the restricted roles.
- **Workspace and account deletion** aren't built: recommendation and decisions D-W1 to D-W6 are in
  `docs/data-retention.md`.
- **Audit log retention:** recommended 2 years (D-W2).

## Mission 6 review (2026-11-18): new surfaces and the full app

New this mission: the real Workspace, Team, Tokens and Billing pages; onboarding steps 4–7; the
invitation email sender; PDF uploads; the production database-role check; Sentry. Each area in the
brief was re-checked. **All results are local unless marked live.**

| Area | Result | Evidence |
|---|---|---|
| Every server action checks the session | Holds. All actions in `src/app/(app)/_actions` go through `withCtx` or a session check (scripted scan). The one exception is `reportClientError`, which is deliberate: it is rate-budgeted, scrubbed, and off without Sentry | Scan in this review; browser suite |
| Organisation isolation on the new pages | Holds: every new page reads through the services as the signed-in user (RLS). A removed member's next request lands on onboarding | Browser suite "settings pages"; `team.test.ts` |
| Role permissions in the UI | Viewers see no invite or role controls; RLS and the definer functions refuse anyway | Browser suite (viewer check), `team.test.ts` |
| Restricted roles | Every Mission 5 service also runs as `reeldeal_web`. A **production** web app or worker on the wrong login **refuses to start** | `restricted-roles.test.ts` (48, real logins on the Supabase image) |
| Service-role key in browser code | Not used anywhere. **New:** the build refuses a secret or service-role key placed in `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `schema.test.ts` |
| Tokens | Shown once (component state only, dropped on close); only the hash and prefix are stored; revocation; environment binding | Browser suite; `access-tokens.test.ts` |
| Invitation abuse | **New limit:** 50 invitations per workspace per day. "New link" could otherwise re-send without limit (seats only bound open invitations) | `rate-limit.test.ts` |
| Emails | All values escaped; idempotency key per invitation; nothing logged | `email.test.ts` |
| File uploads | Allow-listed types and sizes, checked again on completion. New `application/pdf` (25 MB) is never analysed. Storage keys stay namespaced per workspace | `services.test.ts`, browser suite (PDF and wrong-type checks) |
| Server-action argument logging (Mission 5 finding) | Still fixed (`logging.serverFunctions: false`). After three full browser runs the dev and worker logs contain **0** access tokens, invitation tokens, passwords, JWTs or keys | Log scan in this review |
| **New finding: dev request log** | The dev server's request log printed `/auth/callback?token_hash=…` (one-time email-link tokens, already used by then). **Fixed:** `logging.incomingRequests.ignore` for `/auth/callback`. Production doesn't log requests, but Vercel's request logs record paths with queries. The token is single-use and spent at once, so a logged value can't be replayed. Accepted, recorded as R-L1 | `next.config.ts` |
| App logger | Now also redacts `rdl_inv_…`, `sb_secret_…` and Resend keys | `sentry.test.ts` (redaction block) |
| Error monitoring | Prepared and off. Scrubs tokens, keys and emails; allow-listed context; never sends bodies, headers, cookies or queries | `sentry.test.ts`, `docs/monitoring.md` |
| Open redirects | Unchanged and still covered | `safe-redirect.test.ts` |
| Error handling | New app error boundary: plain message and retry, no stack shown | `src/app/(app)/error.tsx` |

### Defects found and fixed this mission

1. **Invited members showed as their email address.** Their sign-up name was never saved, because
   only workspace creation wrote a profile. Fixed when they accept an invitation.
2. **Brand guidelines PDFs sat in "processing" forever** in the activity feeds. Excluded from
   activity, since documents are never analysed.
3. **Setup's last step redirected away before "You're all set" showed** (revalidation re-rendered a
   now-finished setup page). Fixed.
4. **The dev request log contained email-link tokens** (above).
5. **No limit on invitation emails** (above).

### Open items (yours, or need live infrastructure)

- Role passwords and `DATABASE_URL`s (`docs/database-credentials.md`). Until then the production
  start-up check refuses the owner login, by design.
- R2 CORS and R2 credentials in this environment (`docs/review/r2-cors-approval.md`).
- Supabase Auth settings (`docs/supabase-auth-settings.md`), and R6 (`Sb-Forwarded-For`).
- A Sentry project, if wanted (`docs/monitoring.md`).
- Workspace deletion: D-W1 to D-W6 (`docs/data-retention.md`). The button says "not available yet".
- CSP still allows `'unsafe-inline'` scripts: moving to nonces needs dynamic rendering everywhere.
  Medium priority before a public launch.
