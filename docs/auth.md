# Authentication

Supabase Auth with server-side cookie sessions (`@supabase/ssr`). Every page and server action
re-verifies the user with Supabase Auth (`getUser`). Tokens never reach browser JavaScript.

## Flows

| Flow | Entry | What happens | Code |
|---|---|---|---|
| Sign-up | `/sign-up` | Name, email, password (8+), Terms and Privacy consent. No session until the email is confirmed (D10). The same answer is given for an existing address | `signUp` |
| Verify | `/verify-email` | Shows the address; resend with a 1-minute wait (per browser, and per address in Supabase); expired and used link states | `resendVerification`, `/auth/callback` |
| Sign-in | `/sign-in` | Unconfirmed accounts go to `/verify-email?reason=unconfirmed` | `signIn` |
| Reset | `/forgot-password` → email → `/reset-password` | Neutral reply (no account probing); the link signs in for one step | `requestPasswordReset`, `updatePassword` |
| Email change | Settings → Account | Secure change: links to **both** addresses; changes when both are confirmed; pending state shown | `requestEmailChange` |
| Password change | Settings → Account | The current password is checked by the app (throwaway sign-in, session revoked), then other sessions are signed out | `changePassword` |
| Sign out / everywhere | Sidebar, Settings → Account | `scope: local` / `scope: global` (with a confirmation dialog) | `signOut`, `signOutEverywhere` |
| Expired session | Any app page | The proxy sends the visitor to `/sign-in?expired=1&next=…`; `next` is checked by `safeNextPath` | `src/proxy.ts` |

`/auth/callback` handles every emailed link (`flow=` or `type=`). It accepts PKCE codes and
token-hash links, always redirects on its own origin, and maps each failure to the right screen.
Tests: `src/app/auth/callback/route.test.ts` (22).

## Email links work on any device

The templates in `supabase/templates/` link with `{{ .TokenHash }}`. Supabase's default PKCE links
only work in the browser that requested them, so confirming on a phone after signing up on a laptop
failed. The browser tests confirm a link requested in one browser and opened in another.

## Rate limits

The app calls Supabase Auth from its server, so **Supabase sees the server's IP addresses, not each
customer's.** Supabase's per-IP limits would therefore throttle all customers together, while doing
little against a single attacker. So:

1. **App-side limits** (`src/server/auth/rate-limit.ts`, Postgres-backed, migration
   `20261118000001`) apply **before** Supabase is called. They're keyed on the visitor's IP (from
   the hosting platform's header) and on the email address, both stored as HMACs.

   | Action | Per visitor IP | Per email |
   |---|---|---|
   | Sign-in | 30 / 5 min | 10 / 15 min |
   | Sign-up | 10 / hour | 3 / hour |
   | Password reset | 10 / hour | 3 / hour |
   | Resend confirmation | 10 / hour | 5 / hour |

   - Loopback (local development) skips the IP check; email limits still apply.
   - If the database is unreachable the check fails open (logged), and Supabase's limits remain.
   - Tested in `rate-limit.test.ts` and used in the browser suite.
2. **Supabase's limits stay on.** Raise its per-IP sign-in and sign-up limit in the dashboard to
   cover the app's expected peak across its few server IPs, because the per-client limits above now
   do the real work. Check the current values first (dashboard → Authentication → Rate Limits).
3. **Forwarding the client IP to Supabase (open question, R6).** Supabase Auth's source documents an
   `Sb-Forwarded-For` header, honoured only when `GOTRUE_SECURITY_SB_FORWARDED_FOR_ENABLED` is on. It
   isn't confirmed whether hosted Supabase supports or enables it. Ask Supabase support before relying
   on it. If supported, the server would send the platform-provided IP. Clients must never be able to
   set it directly.

No Redis or other service is needed: the counters are one small table with one function.

## Live test plan (after Resend + Supabase SMTP are approved and configured)

Run against the `reeldeal` project with addresses you control. **Nothing here is done yet.**

| # | Test | Expected |
|---|---|---|
| 1 | `npm run infra:check` with the project URL and publishable key | Auth version shown; "Email confirmation: required"; "Sign-in methods: email" |
| 2 | Sign up on a laptop, open the email on a phone | Phone opens `/onboarding?verified=1`; the laptop then signs in |
| 3 | Open the same confirmation link again (signed in) | "Your email is already confirmed" |
| 4 | Open it in a private window (signed out) | `/verify-email?link=invalid` with resend |
| 5 | Resend twice within a minute | Second refused with "less than a minute ago" |
| 6 | Wait for link expiry (check the project's OTP expiry), then open | Expired state; resend works |
| 7 | Password reset on another device | `/reset-password`, new password works, old sessions end |
| 8 | Reset link opened twice | Second shows the expired message |
| 9 | Email change: confirm the old address, then the new | First shows "one confirmed"; after both, the new email signs in |
| 10 | Email change link opened after the change | "Expired or already used" |
| 11 | Wrong current password on password change | Refused (the app check). Then confirm whether the live Auth version also enforces `current_password` |
| 12 | Sign out everywhere with two browsers | Both signed out; protected pages redirect |
| 13 | Headers: SPF, DKIM and DMARC pass in Gmail and Outlook; not in spam | All pass |
| 14 | 11 quick sign-in attempts for one address | The 11th is refused by the app; other addresses unaffected |

Record every result in `docs/production-plan.md`, separate from local results.
