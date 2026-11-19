# Live authentication and customer-journey test plan

For the live `reeldeal` project (`jzshbaqfrrgsyiciuzfe`), **after** these are in place:
- Auth settings (`docs/supabase-auth-settings.md`)
- Resend SMTP (`docs/email-resend.md`)
- role passwords and Vercel variables (`docs/database-credentials.md`)
- a deployment

**Nothing in this plan has been run against the live project.** Every step is automated locally in
`npm run test:e2e` (Supabase Auth v2.180, a mail catcher, Postgres with RLS). Mission 6 results are
in `docs/production-plan.md`.

## What you need

- Four mailboxes you own, e.g. `you+a1@`, `you+a2@`, `you+b1@` and `you+b2@` on a domain you control
  (two businesses, two people each). **No customer addresses.**
- Two browsers (or one plus a private window) and a phone.
- About 45 minutes. Record each result (pass, fail, notes) in a copy of the tables below.

## A. Registration and verification

| # | Test | Steps | Expected |
|---|---|---|---|
| A1 | New registration | Sign up as `a1` (name, email, password ≥ 8, accept terms) | `/verify-email` names the address. One email, "Confirm your Reeldeal email", arrives within a minute. SPF, DKIM and DMARC pass (Gmail: Show original) |
| A2 | Unverified restrictions | Before confirming, open `/dashboard`, `/library`, `/settings/team` | Each redirects to `/verify-email`. Signing in again also leads back there |
| A3 | Verification on another device | Open the email on the phone | Phone: `/onboarding?verified=1`. Laptop: refresh → onboarding |
| A4 | Link used twice | Open the same link again (signed in, then in a private window) | "Your email is already confirmed" / expired state with resend |
| A5 | Expired verification link | Sign up as `a2`, wait more than 1 hour (Email OTP expiry 3600 s), open the link | Expired state; "Send a new link" works; the new link confirms |
| A6 | Resend limits | Press resend twice within a minute | The second is refused with a clear message |
| A7 | Duplicate registration | Sign up again with `a1` (already confirmed) | Same "check your inbox" screen (no account probing). No second account is created (Supabase → Users shows one) |

## B. Workspace and onboarding

| # | Test | Expected |
|---|---|---|
| B1 | Create workspace "Live Test A" (business, Accommodation) | Continues to "Step 4 of 7: Brand" |
| B2 | Brand: 2 colours, tones, customers. Continue | "Step 5 of 7". Brand profiles shows the colours |
| B3 | Close the tab and sign in on the phone | Dashboard shows "Finish setting up"; Continue resumes at step 5 |
| B4 | Upload a PNG logo and a PDF guideline. Cancel and retry a video upload | Logo appears on the brand; the PDF is in the Library; the cancelled upload is gone, the retried one finishes. **Needs R2 CORS for the production origin** |
| B5 | Preferences: 1:1, AI keyframes off. Finish | Summary lists the choices; dashboard has no setup card; `/onboarding/setup` sends you to the dashboard |
| B6 | Double-click "Create workspace" (fresh account `b1`) | Exactly one workspace |

## C. Sign-in, sessions and account

| # | Test | Expected |
|---|---|---|
| C1 | Sign out, then use the browser's back button | Protected pages redirect to sign-in |
| C2 | Wrong password 11 times quickly for `a1` | The app refuses with "Too many attempts". Another account still signs in |
| C3 | Password reset from the phone | Email "Reset your Reeldeal password" (expiry 1 hour); the new password works; other browsers are signed out |
| C4 | Reset link opened twice | The second shows the expired message |
| C5 | Change email (Settings → Account) | Both addresses get "Confirm your new Reeldeal email". The change applies only after both confirm |
| C6 | Change password with a wrong current password | Refused |
| C7 | Sign out everywhere | The other browser is signed out on its next request |

## D. Team, invitations and roles

| # | Test | Expected |
|---|---|---|
| D1 | As `a1` (owner; Free has one seat, so first set the plan for the test or use a paid plan record), invite `a2` as Editor | With Resend on: one email "… invited you to Live Test A", expiry date shown. Off: "Copy link" |
| D2 | Open the invitation on the phone, signed out → Create an account → confirm → back to the link | "Join Live Test A" → dashboard of that workspace |
| D3 | Expired invitation (owner: set `expires_at` in the past only on a test workspace, or wait 7 days) | "This invitation has expired"; Join isn't offered |
| D4 | Revoke a pending invitation, then open its link | "Withdrawn" message |
| D5 | Change `a2` to Viewer (confirm dialog) | `a2` can view the library but can't upload, edit brands or start renders (buttons absent; direct actions refused) |
| D6 | Remove `a2` | `a2`'s next request shows onboarding; their tokens for the workspace no longer work |
| D7 | Transfer ownership to an Editor (typed name + password) | They become owner; you become administrator; audit log entries exist |
| D8 | Invitation for an address that isn't yours | "Sent to a different address"; no workspace details shown |

## E. Isolation (two businesses)

Business B: `b1` (owner) and `b2`, workspace "Live Test B".

| # | Test | Expected |
|---|---|---|
| E1 | `b1` opens A's project, brand and export URLs (copy them from A) | "Not found" every time |
| E2 | `b1`'s library, exports and usage | Empty and separate (own credits) |
| E3 | A signed download link of A's export, path edited to another workspace | 403 |
| E4 | `b1` opens A's invitation link | Refused (different address) |
| E5 | Access token made in A, used against B's data | Refused (token is bound to A) |

## F. Access tokens and billing

| # | Test | Expected |
|---|---|---|
| F1 | Create a token (Read only, 7 days) | Shown once; only the prefix is shown afterwards |
| F2 | Revoke it | Moves to "Revoked and expired" |
| F3 | A development token against production (if both exist) | Refused |
| F4 | Usage and billing | Real plan and credits; "Online billing isn't set up yet"; no card, invoice or renewal invented |

## After the run

- Delete the four test accounts in Supabase → Authentication → Users. Their workspaces stay as
  orphans unless deleted. Workspace deletion isn't built (D-W1), so ask me for a reviewed clean-up
  query for the test workspaces only.
- Record results in `docs/production-plan.md` under "Live", separate from local results.
