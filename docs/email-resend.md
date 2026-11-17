# Transactional email with Resend (D4)

**Status: prepared, nothing connected.** No account, domain, DNS record, Supabase setting or real
email has been created, changed or sent. Every step marked **(approval)** needs your go-ahead.
The branded templates are built and tested locally (see "Tested locally" below).

## 1. What Resend will send

| Email | Sent by | How | Template |
|---|---|---|---|
| Confirm your email (sign-up) | Supabase Auth | Custom SMTP → Resend | `supabase/templates/confirmation.html` |
| Reset your password | Supabase Auth | Custom SMTP → Resend | `supabase/templates/recovery.html` |
| Confirm an email change (sent to both addresses) | Supabase Auth | Custom SMTP → Resend | `supabase/templates/email_change.html` |
| Workspace invitation, ownership transfer notice (Stage 5) | Reeldeal server | Resend HTTPS API, server-side only | To write in Stage 5, same layout |
| Video ready (later, optional) | Reeldeal worker | Resend HTTPS API | Later |

One provider and one sending domain, with a separate API key per environment (development, production).

## 2. Account setup

1. Create a Resend account for Reeldeal, owned by a company address, not a personal one. Turn on
   two-factor authentication for every member. The free tier (3,000 emails a month, 100 a day) is
   enough for development and a small pilot. Move to a paid plan before launch, for the volume
   and for dedicated support.
2. Add the sending domain (section 3) and choose the region (section 5). **(approval)**
3. Create two API keys, one per environment, each with **sending access only** and limited to
   the sending domain. Each key is shown once:
   - store the production key only in Supabase's SMTP form and the host's secret store
   - never put a key in chat, git or `.env.example`
4. Turn on bounce and complaint webhooks later (Stage 5 or 7), so invitations to bad addresses
   are flagged.

## 3. Sending domain (recommended)

Send from a **dedicated subdomain**, `mail.[DOMAIN]`. This:

- keeps transactional reputation separate from marketing email and from any Google Workspace mail
  on the root domain
- leaves the root domain's SPF and MX records untouched

| Setting | Value |
|---|---|
| Sending domain | `mail.[DOMAIN]` |
| From | `Reeldeal <no-reply@mail.[DOMAIN]>` (name is a working name: confirm before launch) |
| Reply-To | `[SUPPORT EMAIL]` on the root domain, a monitored inbox |
| Development | Use the same subdomain with a separate API key, or `dev-mail.[DOMAIN]` if you want development reputation fully isolated |

`[DOMAIN]` depends on the final product name and domain (open decision).

## 4. DNS records needed (approval; you add them, or approve me to)

Resend shows the exact values once the domain is added. Expect:

| Type | Host (relative to the root domain) | Value | Purpose |
|---|---|---|---|
| TXT | `resend._domainkey.mail` | `p=MIGf…` (the DKIM public key from Resend) | DKIM: signs every email |
| MX | `send.mail` | `feedback-smtp.<region>.amazonses.com`, priority 10 | Bounces and complaints (custom MAIL FROM) |
| TXT | `send.mail` | `v=spf1 include:amazonses.com ~all` | SPF for the MAIL FROM domain |
| TXT | `_dmarc.mail` | `v=DMARC1; p=none; rua=mailto:[DMARC REPORT ADDRESS]` | DMARC, monitoring first |

- These are **additions only**. Nothing on the root domain (website, existing MX, existing SPF)
  changes.
- If the root domain already has a DMARC record, the subdomain inherits it unless `_dmarc.mail`
  is set. Check the existing policy before adding one.
- Move DMARC from `p=none` to `p=quarantine` after two to four weeks of clean reports.
- Verification usually takes minutes, but DNS can take up to 48 hours. Start this early: it is
  the slowest dependency for launch.

## 5. Sending region

Resend sends from a small set of regions (US East is the default; others, including an
Asia-Pacific region, are offered when adding the domain: check the list in the dashboard).
Recommendation: **the Asia-Pacific region closest to Sydney**, where the Supabase project and the
customers are. That keeps processing close to the rest of the stack, and is worth noting in the
Privacy Policy's list of processors. The region is fixed per domain and changes the hostname in
the MX record above.

## 6. Supabase Auth configuration (approval; after the domain verifies)

Project `reeldeal` → **Authentication**:

| Area | Setting | Value |
|---|---|---|
| Emails → SMTP | Host / port | `smtp.resend.com` / `465` (SSL) |
| | Username / password | `resend` / the production API key |
| | Sender email / name | `no-reply@mail.[DOMAIN]` / `Reeldeal` |
| Emails → Templates | Confirm signup, Reset password, Change email address | Paste `supabase/templates/*.html`; subjects in `supabase/templates/README.md` |
| Sign In / Providers → Email | Confirm email | **On** (D10) |
| | Secure email change | **On** (both addresses confirm) |
| | Secure password change | Off: the app checks the current password itself (section 8) |
| | Minimum password length | 8, matching the app |
| | Leaked password protection | On (Pro plan) |
| URL Configuration | Site URL | The app's URL (`{{ .SiteURL }}` in the templates) |
| | Redirect URLs | `<app URL>/auth/callback` (and `http://localhost:3000/auth/callback` on the development project) |
| Rate limits | Emails sent per hour | Raise from the built-in mailer's low default to suit the pilot (for example 100) |
| | Sign-ins and sign-ups | Review: the app signs in from its server, so many customers share a few server addresses (risk R6) |

## 7. The templates (built)

`supabase/templates/` holds three branded HTML emails:

- Crossroads Blue literal hex colours, because email clients can't read CSS variables
- system-safe fonts with Space Grotesk and Inter first
- a single blue button with a plain-text link under it
- bracketed owner copy where needed (`[COMPANY LEGAL NAME AND POSTAL ADDRESS]`)

The links use `{{ .TokenHash }}` and go to `/auth/callback`, not Supabase's default
`{{ .ConfirmationURL }}`. **This matters.** The default links only work in the browser that asked
for them (PKCE). The browser tests showed that someone who signs up on a laptop and opens the
email on their phone would get "link expired". Token-hash links work on any device.

Not used: magic link, invite (Reeldeal sends its own invitations), reauthentication.

## 8. Findings that shaped this

- **Current password.** Supabase Auth v2.180 accepts `current_password` on a password update but
  does not check it: a wrong current password changed the password in testing. The app now checks
  the current password itself, with a throwaway sign-in whose session is revoked immediately, and
  still sends `current_password` for newer versions that do check it.
- **Resend limit.** Supabase Auth sends at most one confirmation email per address per minute, from
  any browser. The app also waits a minute per browser and says so plainly.

## 9. Tested locally (not against Resend)

The local stack runs Supabase Auth with these settings and these exact templates, served from the
repo (`infra/local`), with a mail catcher in place of Resend. The browser tests (`npm run test:e2e`)
cover:

- sign-up → verification email → confirming on a different browser → onboarding
- resend, and its limits
- used and expired links
- sign-in before confirming
- password reset
- password change with the current password, and its refusal with a wrong one
- email change confirmed by both addresses
- sign out everywhere

**None of this has been sent through Resend or a real inbox yet.** That is the first test after
approval: one confirmation and one reset to an address you own, checked for SPF, DKIM and DMARC
pass and inbox placement in Gmail and Outlook.

## 10. What I need from you

1. A Resend account and the region choice.
2. The final domain, or a development domain you own.
3. DNS: you add the records Resend shows, or approve me to.
4. Approval to configure Supabase Auth SMTP and templates on the `reeldeal` project.
5. `[SUPPORT EMAIL]`, `[DMARC REPORT ADDRESS]`, and `[COMPANY LEGAL NAME AND POSTAL ADDRESS]` for the email footer.
