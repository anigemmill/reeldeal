# Supabase Auth: settings to configure by hand (project `jzshbaqfrrgsyiciuzfe`)

Status 2026-11-18. **None of these has been changed by Claude.** Live Auth settings are yours.
I could read the project's database but not its Auth configuration: that needs the publishable key
(`/auth/v1/settings`) or a Management API token. So the "Today" column is what we expect, not what's
confirmed. After you've set them, run `npm run infra:check` with the project URL and publishable
key (plus, optionally, a short-lived `SUPABASE_ACCESS_TOKEN`) and it reports most of them.

Dashboard path: **Authentication** in the `reeldeal` project.

## 1. URL configuration (Authentication → URL Configuration)

| Setting | Value | Why |
|---|---|---|
| Site URL | The production app origin, e.g. `https://app.<domain>` (no trailing slash) | `{{ .SiteURL }}` in every email link. Must be the origin the app runs on |
| Redirect URLs | `https://app.<domain>/auth/callback` (exact). On a development project, also `http://localhost:3000/auth/callback` | The emails build their links from **Site URL** and `token_hash` (`supabase/templates`), not from `{{ .RedirectTo }}`, so they don't depend on this list. A `redirectTo` that doesn't match falls back to Site URL, which is harmless. Supabase recommends exact paths in production. **No `/**` wildcard**: it would let a crafted sign-in send people to any page of the domain |
| Preview deployments | Don't add `*.vercel.app` | Previews should use a separate project (`docs/database-credentials.md`) |

## 2. Sign-in methods (Authentication → Sign In / Providers)

| Setting | Value | Why |
|---|---|---|
| Allow new users to sign up | On | Self-serve pilot |
| Email provider | On | The only method the app supports (D1) |
| **Confirm email** | **On** | D10: no workspace data before the address is confirmed. The app also enforces this, but leave it on |
| Secure email change | On | Both the old and new address confirm |
| Secure password change | Off | The app checks the current password itself. Auth v2.180 didn't verify it (`docs/auth.md`) |
| Minimum password length | 8 | Matches the app's check |
| Password requirements | None beyond length (or "letters and digits") | The app's error messages assume length only. Tell me if you add character rules |
| Leaked password protection | On (Pro plan) | Refuses known-breached passwords |
| Phone, anonymous, all OAuth providers (Google, Apple, …) | **Off** | Not built. An enabled provider that the app doesn't handle is an unreviewed way in |
| Manual linking | Off | |

## 3. Emails (Authentication → Emails)

| Setting | Value | Why |
|---|---|---|
| SMTP | Custom: `smtp.resend.com`, port `465`, user `resend`, password = Resend API key | The built-in mailer is limited to a few emails an hour and isn't meant for customers (`docs/email-resend.md` §6) |
| Sender | `no-reply@mail.<domain>` / `Reeldeal` | Must be on the Resend-verified domain |
| Email OTP expiration | **3600** seconds | The templates say "expires in 1 hour" |
| Email OTP length | 6 (default) | Not used by the links, but leave the default |
| Templates: Confirm signup, Reset password, Change email address | Paste `supabase/templates/confirmation.html`, `recovery.html`, `email_change.html`; subjects in `supabase/templates/README.md` | Links use `token_hash`, so they work on any device |
| Templates: Magic link, Invite user, Reauthentication | Leave as default (unused) | The app sends its own workspace invitations through Resend |

## 4. Rate limits (Authentication → Rate Limits)

| Limit | Suggested for the pilot | Notes |
|---|---|---|
| Emails sent | 100 an hour (after custom SMTP) | Built-in default is far lower |
| Token refreshes | Default | |
| Sign-ups and sign-ins | Default, review after a week | The app adds its own per-visitor and per-email limits (`src/server/auth/rate-limit.ts`). Sign-ins come from the app's server IPs, so Supabase's per-IP limit is shared by everyone (risk R6, `docs/review/supabase-support-question.md`) |
| Verifications | Default | |

## 5. Sessions and keys

| Setting | Value | Why |
|---|---|---|
| JWT expiry | 3600 (default) | The app re-verifies the user with the Auth server on every request |
| Refresh token reuse interval | Default (10 s) | |
| Time-box and inactivity timeout (Pro) | Optional: e.g. 30 days and 7 days | Policy choice |
| JWT signing keys | Move to asymmetric keys when you enable MCP OAuth (D6) | `infra:check` reports the JWKS |
| API keys | Use the **publishable** key (`sb_publishable_…`) for `NEXT_PUBLIC_SUPABASE_ANON_KEY`. **Never** expose the secret key | The build refuses a secret or service-role key in that variable (Mission 6) |

## 6. Checks afterwards

```bash
NEXT_PUBLIC_SUPABASE_URL=https://jzshbaqfrrgsyiciuzfe.supabase.co NEXT_PUBLIC_SUPABASE_ANON_KEY='<publishable key>' npm run infra:check
```

Expect: "Email confirmation: required", "Sign-in methods: email", the Auth version. Then run the
live test plan in `docs/auth-live-test-plan.md` with mailboxes you own.
