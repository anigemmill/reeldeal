# Supabase Auth email templates

Branded templates for the emails Supabase Auth sends. Paste each into the Supabase dashboard
(Authentication → Emails → Templates) when the Resend SMTP setup is approved (`docs/email-resend.md`).
The local stack (`infra/local`) uses these same files, so the browser tests exercise them.

| File | Supabase template | Subject |
|---|---|---|
| `confirmation.html` | Confirm signup | Confirm your Reeldeal email |
| `recovery.html` | Reset password | Reset your Reeldeal password |
| `email_change.html` | Change email address | Confirm your new Reeldeal email |

Links use `{{ .TokenHash }}` and point at `/auth/callback`, which verifies them with `verifyOtp`.
Unlike the default `{{ .ConfirmationURL }}` (PKCE), these links work in any browser or device:
someone can sign up on a laptop and confirm on their phone.

Not used (leave Supabase's defaults or disable): magic link, invite (Reeldeal sends its own
workspace invitations, Stage 5), reauthentication.

Footer: "Outside In Limited, Rotorua, New Zealand" (owner, 2026-11-22).
Colours are the Crossroads Blue tokens as literal hex: email clients cannot read CSS variables.
