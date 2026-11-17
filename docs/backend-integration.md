# Backend integration plan: the six customer areas

Status at 2026-11-17 (Mission 5). **A screen existing does not mean the feature works.** This map says,
for each area, what is in the database, what is in the services, what is tested, and what
remains before the screen can be wired to real accounts.

Two prepared migrations are **not applied** to the live project:

- `20261117000001_restricted_runtime_roles`: reviewed in `docs/review/`
- `20261118000001_teams_workspace_onboarding`: reviewed in `docs/review/`

Everything marked "needs 1118" works locally and in tests. It can't run against the live project
until that migration is approved and applied.

## Implementation map

| Feature | Existing database support | Existing service support | Remaining work |
|---|---|---|---|
| **Authentication** | Supabase Auth (live project); `profiles` | Sign-up with consent, required email verification, resend, sign-in, sign-out, sign out everywhere, reset, email change (both addresses), password change (current password checked by the app), callback flows (all working locally, 93/93 browser checks). **New:** app-side rate limits per visitor IP and per email (`src/server/auth/rate-limit.ts`, needs 1118) | Configure Resend SMTP and templates on the live project; run the live test plan (`docs/auth.md`); confirm the live Auth version; decide on `Sb-Forwarded-For` (R6) |
| **Onboarding** | `organisations`, `memberships`, `brand_profiles`, `credit_transactions` (trial grant). **New in 1118:** `organisations.industry / website / location / workspace_kind / onboarding_step / onboarding_completed_at`, `user_preferences`, `media_assets.kind = 'document'`, `invitations` | `createWorkspace` (now creates the first brand under a lock: a double submit can't create duplicates, regression-tested). **New:** `getOnboardingState` (resume after sign-out), `saveOnboardingStep`, `setWorkspaceKind`, `myInvitations`, `acceptInvitation`, `get/savePreferences` | Wire the seven-step screen: steps 1–3 exist as pages; steps 4–7 need server actions over these services; logo upload uses the existing media upload (image) plus `brand_profiles.logo_media_id`; guidelines PDF needs `document` in `UPLOAD_TYPES` (analysis skips it); the dashboard's "finish setup" prompt |
| **Workspace settings** | `organisations` (+ 1118 columns), `brand_profiles`, `brand_profile_versions` | **New:** `getWorkspaceSettings`, `updateWorkspaceDetails` (admins only, RLS and grants); `setAiMediaConsent` (existing); brands service (existing) | Server actions plus page; data region shown from configuration; **workspace deletion is not built** (needs a retention decision, D-W1); "leave workspace" uses the team service |
| **Team management** | **New in 1118:** `invitations` (token hash only), `invitation_preview`, `audit_events`, one-owner unique index, security-definer membership functions | **New:** `getTeam`, `inviteMembers` (seat limit from pricing), `revokeInvitation`, `acceptInvitation`, `changeMemberRole`, `removeMember`, `leaveWorkspace`, `transferOwnership` (typed name; password checked by the action), `auditLog`. 25 permission tests (`team.test.ts`) | Invitation emails (Resend API; until then the admin copies the link, U5); **`/invite` page built** (fragment token, sign in or up, then accept; onboarding join); server actions plus the team page; "Resend" means revoke and re-invite (new link) |
| **Access tokens** | `api_tokens` (hashed, scoped, expiring, revocable). **New in 1118:** `environment` (development/production binding) | Existing create/verify/revoke (`auth/tokens.ts`), now refusing tokens from another environment. **New:** `listMyTokens`, `createMyToken` (role-limited scopes, required expiry, 20-token cap, web session only), `revokeMyToken`. 10 tests | Server actions plus page; production `/api/mcp` still refuses tokens and stays private until OAuth (D6). **Deploy note:** token creation now writes `environment`, so `npm run mcp:token` / `workspace:bootstrap` against the live project need 1118 first |
| **Usage and billing** | `credit_transactions` (ledger), `organisations.plan_id`, `jobs`. **New in 1118:** `billing_accounts` (server-written; owner-readable) | `getUsage` (existing). **New:** `getBillingOverview` (plan, credits, analysis, storage, seats, brands, renders this month; billing "not set up" unless a record exists; non-owners never see payment details), `getUsageHistory` (paged, filtered), `toBillingScreenData` (real-page mapping: never sample values, tested). The screen gained a live "billing not set up" state (`/design-system/screens/billing/free`) | Stripe (separate stage): checkout, customer portal, webhooks writing `billing_accounts` and `plan_id`, invoices. **Rollover:** built in migration `20261119000001` (not applied) and `usage.ts`, see `docs/credits.md`. AI generation isn't metered (the `ai_generation` wallet is unused) |

## Area details

### Onboarding

| Step | Screen | Data | Service | State |
|---|---|---|---|---|
| 1. Account | `/sign-up` (live) | Supabase Auth user, `user_metadata` (name, chosen plan) | `signUp` action | Working |
| 2. Verify | `/verify-email` (live) | `email_confirmed_at` | `resendVerification`, `/auth/callback` | Working |
| 3. Workspace (or join) | `/onboarding` (live: create only) | `organisations`, `memberships`, `invitations` | `createWorkspace`, `myInvitations`, `acceptInvitation`, `setWorkspaceKind` | Create works; join and kind need 1118 and wiring |
| 4. Business | Part of today's `/onboarding` form | `organisations` (+1118 columns) | `createWorkspace`, `updateWorkspaceDetails` | Location/phone/legal name need 1118 |
| 5. Brand | Design only | `brand_profiles` (colours, voice, audiences) | `updateBrand` (existing, versioned) | Wiring only |
| 6. Logo and assets | Design only | `media_assets` (image, + `document` in 1118), `brand_profiles.logo_media_id` | `createMediaUpload` / `completeMediaUpload` (existing), `updateBrand` | PDF upload type and wiring |
| 7. Preferences | Design only | `user_preferences` (1118), `organisations.default_formats`, `ai_media_analysis_consent` | `savePreferences`, `updateWorkspaceDetails`, `setAiMediaConsent` | Wiring |
| Done → dashboard | Design only | `onboarding_completed_at` | `saveOnboardingStep("done")` | Wiring, plus the dashboard prompt for unfinished setup |

- **Resume:** progress is stored on the workspace (`onboarding_step`), not in the browser.
  `getOnboardingState` returns the next step after sign-out and sign-in (tested). Only the owner is
  asked; invited members go straight to the dashboard.
- **Duplicates:** workspace creation is serialised per user, and a repeat of the same form within a
  minute returns the same workspace. The first brand is created inside a per-workspace lock. Five
  simultaneous submissions give one workspace and one brand (tested). The general brand-limit race
  in `createBrand` is fixed the same way (tested).

### Workspace

- Business information, workspace details, brand, preferences and ownership map as above.
- Missing: the data-region string (configuration, not data), **workspace deletion**, and brand
  asset listing beyond the logo (guidelines PDFs arrive with the `document` kind).

### Team

- Rules and tests: `docs/team-permissions.md`.
- Missing: invitation email delivery (Resend). The `/invite` page is built.

### Access tokens

- Missing: the page wiring.
- Decision: show an environment badge on tokens (UX issue U7).

### Usage and billing

- Missing: Stripe.
- Ledger rollover (D-B1).
- AI generation metering, if wanted.

## UX issues U1–U13: status (Mission 5)

None of these was a redesign. Each fix is a small adjustment or a missing state inside the approved
look. Impact: **S** security, **F** functional, **U** usability, **V** visual.

| # | Area | Issue | Impact | Status |
|---|---|---|---|---|
| U1 | Settings, phone | Sub-navigation scrolled sideways, hiding "Usage and billing" and "Access tokens" at 390px | U | **Fixed:** items wrap onto rows below the large breakpoint (`settings-shell.tsx`) |
| U2 | Navigation | Sidebar workspace card wasn't a link | U | **Fixed, staged:** the card links to Workspace settings when a page exists (`NavData.workspace.href`). The review pages link now; the product links once the Workspace page is wired, never to an unbuilt page |
| U3 | Team | Role select applied at once, even when demoting an administrator | S, F | **Fixed:** every change asks first. A change that removes permissions says what the person keeps and that it applies to their tokens at once (`?dialog=role`) |
| U4 | Team | No per-address result for bulk invites | F, U | **Fixed:** a result list per address (created, or the reason: invalid, already a member, already invited, no seats left), mirroring `inviteMembers` (`?dialog=invite-results`) |
| U5 | Team | No way to share invitations without email | F | **Fixed:** "Copy link" per created invitation while email isn't set up (`emailDelivery: false`). Wording says links are copied, not emailed. The live link is `/invite#token` (section below) |
| U6 | Team | No empty state for a one-person workspace | U | **Fixed:** "Invite your team" card with the seat count; single-seat plans say "upgrade to add people" (`/design-system/screens/team/solo`) |
| U7 | Access tokens | Development and production tokens looked the same | S, U | **Fixed:** "Development" badge from `api_tokens.environment` |
| U8 | Workspace | Viewers saw "Edit brand" | S (UI only; RLS already refuses) | **Fixed:** viewers see "View brand"; editors and above "Edit brand" (editors can edit brands) |
| U9 | Workspace | Deletion said "14-day grace period [TO CONFIRM]" | F | **Copy updated** to the retention recommendation (`docs/data-retention.md`): access removed at once, content deleted after "[30 days, TO CONFIRM]", legal records kept. Deletion stays preview-only until D-W1 to D-W6 are decided |
| U10 | Onboarding | Invited people saw "Step 3 of 7" | U | **Fixed:** with an invitation, the stepper is hidden and the step reads "Join your team". It returns only if they choose their own workspace. The live `/onboarding` page lists real invitations with Join buttons |
| U11 | Onboarding | No "finish setup" card on the dashboard | U | **Deferred:** it would point at onboarding steps 4–7, which aren't wired (they need 1118). Built with that wiring, from `getOnboardingState` |
| U12 | New screens | Loading and error states | F, U | **Partly done:** the invitation page has loading, error and every outcome state; the team dialogs show inline results. The remaining screens get theirs when wired (reusing `PageLoading` and inline dialog errors) |
| U13 | Billing | Orange meters; "1 seats" | V | Fixed in Mission 4 |

### Invitation acceptance (`/invite`)

- **Links** look like `/invite#rdl_inv_…`. The token is in the fragment, which browsers never send to
  a server, so it can't appear in access logs, proxies, analytics or Referer headers. The page:
  - takes the token out of the address bar
  - keeps it in this tab's `sessionStorage` through sign-in or sign-up
  - sends it to a server action in a POST body, where it's hashed before any query
  - is `noindex` and `no-referrer`
- **Signed out:** "Sign in" or "Create an account", with no workspace details.
- **Signed in:** details only if the invitation is for the confirmed address (the new
  `private.invitation_preview`, in 1118). Anyone else sees "sent to a different address" or "can't
  find".
- **Expired, revoked and used** invitations each have their own message; "already a member" links to
  the dashboard.
- **Cross-device:** after confirming email on another device, `/onboarding` lists the invitations for
  that address, so no link is needed.
- **Tested:**
  - `team.test.ts`: preview rules
  - browser suite: signed-out view; token removed from the address bar and never sent in a URL or
    Referer; onboarding lists the invitation; join by link; already-a-member state; another account's
    link; unknown link; join from onboarding with no link

Keyboard and screen-reader checks pass on every screen and dialog in the accessibility suite
(16 themes × 27 pages, plus phone layouts). The issues above are about clarity, not access.
