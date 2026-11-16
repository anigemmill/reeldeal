# Transactional email with Resend (D4)

**Status: prepared, nothing connected.** No account, domain, DNS or Supabase setting has been changed.
Every step below that touches DNS or a live setting needs your approval.

## What Resend will send

| Email | Sent by | How |
|---|---|---|
| Confirm your account, reset password, confirm an email change | Supabase Auth | Supabase **custom SMTP** pointed at Resend. No app code involved |
| Workspace invitations, ownership transfer notices (Stage 5) | Reeldeal server | Resend HTTPS API, called from a server action. The API key is server-only, never in the browser |

One provider, one sending domain, one API key per environment.

## The domain

The sending domain depends on the final product name and domain, which aren't confirmed yet (shown below
as `[DOMAIN]`). Recommendation: send from a **subdomain**, for example `mail.[DOMAIN]`. That keeps the
reputation of transactional mail separate from any marketing email or Google Workspace mail on the root
domain, and keeps the root's SPF record untouched.

- From address: `Reeldeal <no-reply@mail.[DOMAIN]>`. The product name is still a working name (`[BRACKETED]`).
- Reply-to: a monitored address such as `support@[DOMAIN]` (`[OWNER TO CONFIRM]`).
- Resend region: choose the one closest to Supabase. Resend's region list doesn't include Sydney, so this
  is a choice to make when the domain is added. It changes the hostnames in the SPF and MX records below.

## DNS records needed (you add them, or approve me to)

Resend shows the exact values once the domain is added in its dashboard. The shape is:

| Type | Name | Value | Purpose |
|---|---|---|---|
| TXT | `resend._domainkey.mail` | `p=…` (DKIM public key from Resend) | Signs each email (DKIM) |
| MX | `send.mail` | `feedback-smtp.<region>.amazonses.com` (priority 10) | Bounce and complaint handling (custom MAIL FROM) |
| TXT | `send.mail` | `v=spf1 include:amazonses.com ~all` | SPF for the MAIL FROM domain |
| TXT | `_dmarc.mail` (or `_dmarc` on the root) | `v=DMARC1; p=none; rua=mailto:[DMARC REPORT ADDRESS]` | DMARC. Start at `p=none` to monitor, then move to `quarantine` once reports are clean |

These are additions only. None of them changes the root domain's existing MX, SPF or website records.
DNS can take up to 48 hours to verify, so this is the earliest dependency for launch.

## Supabase Auth settings (after the domain verifies; needs approval)

Authentication → Emails → SMTP settings:

- host `smtp.resend.com`
- port `465`
- username `resend`
- password: a Resend API key with **sending access only**, for this domain
- sender `no-reply@mail.[DOMAIN]`, name `Reeldeal`

Then, in the same area:

- **Confirm email**: on (D10)
- **Secure email change**: on
- **Secure password change**: on
- Raise the auth email rate limit from the low default, which only applies to Supabase's built-in mailer
- Email templates: branded versions, kept in the repo (`supabase/templates/`), written in Stage 3

## App configuration (Stage 5, invitations)

New server-only variables, validated in `src/env/schema.ts` like the others:

- `RESEND_API_KEY`
- `EMAIL_FROM`
- `EMAIL_REPLY_TO`

Without them, invitations still work as copyable links, and the UI says the email wasn't sent. Nothing
pretends to send.

## What I need from you

1. A Resend account (free tier is fine for the pilot) and the region choice.
2. The final domain, or approval to use a placeholder development domain you own.
3. DNS access: you add the records Resend shows, or approve me to add them.
4. The API key goes into Supabase's SMTP form and the host's secret store, **never into chat or git**.
