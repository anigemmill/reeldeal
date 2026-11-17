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
