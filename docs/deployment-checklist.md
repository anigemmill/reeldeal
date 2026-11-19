# Deployment readiness checklist (first pilot)

Status 2026-11-18 (Mission 6). ✅ done and verified · 🔲 yours to do · ⏳ blocked on a 🔲 above it.
"Local" means proven on the local stack; "live" means on the real services.

## 1. Code (done)

- ✅ Customer journey wired end to end: sign-up → verify → workspace → setup → library → Autopilot →
  Studio → render → export → team → tokens → usage. Two-business acceptance run (local); results in
  `docs/production-plan.md` §00
- ✅ Unit and integration suite, typecheck, lint, secret scan, token and pricing checks, migration
  safety check, production build, accessibility suite
- ✅ Production start-up refuses the wrong database login (`docs/database-credentials.md`)
- ✅ The build refuses a secret key in public variables

## 2. Database (Supabase `jzshbaqfrrgsyiciuzfe`)

- ✅ Migrations 1–10 applied and verified, live (`docs/review/migration-execution-record-2026-11-18.md`)
- 🔲 Set passwords for `reeldeal_web` and `reeldeal_worker` (`docs/database-credentials.md` steps 1–2)
- 🔲 Confirm daily backups or PITR in Database → Backups
- ⏳ `npm run infra:check` with each role's URL: "Database login" is right for each service

## 3. Auth (Supabase)

- 🔲 Settings in `docs/supabase-auth-settings.md` (site URL, redirect URLs, confirm email, providers
  off, OTP expiry 3600, templates)
- 🔲 Resend domain and DNS (`docs/email-resend.md` §3–4), then custom SMTP (§6)
- ⏳ `infra:check` with the publishable key: "Email confirmation: required", "Sign-in methods: email"

## 4. Storage (Cloudflare R2)

- 🔲 CORS for `http://localhost:3000` (`docs/review/r2-cors-approval.md`, owner procedure)
- 🔲 R2 credentials back in this environment, then I run `npm run test:r2-browser`
- 🔲 Check public access is off and the abort-multipart lifecycle rule exists
- ⏳ Add the production origin to CORS (separate approval)

## 5. Hosting

- 🔲 Vercel project: Production variables from `docs/database-credentials.md` (complete list),
  Preview **without** the production database
- 🔲 Worker host (Docker, `infra/worker/Dockerfile`) with `reeldeal_worker` and the same
  `SIGNING_SECRET`
- 🔲 Domain and DNS for the app (`NEXT_PUBLIC_SITE_URL`)
- 🔲 Optional: Sentry project and `SENTRY_DSN` (`docs/monitoring.md`)

## 6. After deploying

- ⏳ Live test plan with your own mailboxes (`docs/auth-live-test-plan.md`), about 45 minutes
- ⏳ Record live results in `docs/production-plan.md`

## 7. Before charging anyone

- 🔲 D-B2 and the commercial choices in `docs/credits.md`
- 🔲 Stripe (billing stage)
- 🔲 Terms and Privacy text (placeholders today); `[COMPANY LEGAL NAME AND POSTAL ADDRESS]` in emails
- 🔲 Retention decisions D-W1 to D-W6 (`docs/data-retention.md`)
