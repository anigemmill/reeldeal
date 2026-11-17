# Customer onboarding

The journey (design: `/design-system/screens/onboarding`; backend map: `docs/backend-integration.md`):

1. **Create account** (`/sign-up`, live): name, email, password, Terms and Privacy consent.
2. **Verify email** (`/verify-email`, live): required before anything else (D10).
3. **Join or create a workspace.**
   - Someone with an invitation for their confirmed address sees it and joins: no further steps.
   - Otherwise they create a workspace for **my business** or **a client** (agencies: one workspace
     per client, D1).
4. **Business details:** name, industry, website, location. The workspace and its first brand are
   created here, once, even if the button is pressed repeatedly.
5. **Brand** (optional): colours, tone of voice, customers.
6. **Logo and assets** (optional): logo image and brand guidelines PDF, stored privately like footage.
7. **Preferences** (optional): appearance, main format, AI keyframe consent, email when videos are
   ready.
8. **Done:** summary and next steps, then the dashboard.

## Resuming

Progress is saved on the workspace (`organisations.onboarding_step`, `onboarding_completed_at`):

- After signing out and back in, `getOnboardingState` returns the next unfinished step.
- Skipped optional steps are offered again from a dashboard card. Setup is never forced again.
- Only the owner is asked to finish setup.

## Personas

| Who | Path |
|---|---|
| Owner-operator | Steps 1–8 in about a minute; optional steps skippable |
| Marketing manager | Same as the owner, or invited by the owner as Administrator (steps 1–3 only) |
| Agency | Creates the first client workspace ("a client"); adds more from the workspace switcher |
| Team member | Invited: signs up or signs in with the invited address, joins, lands on the dashboard |

## Integration plan (Mission 5). Not connected to the live database until 1118 is approved

| Step | Screen today | Server action to add | Service (exists, tested) | Needs |
|---|---|---|---|---|
| 1 Account | `/sign-up` live | (exists) | Supabase Auth | — |
| 2 Verify | `/verify-email` live | (exists) | Supabase Auth | — |
| 3 Join or create | `/onboarding` live: create, **plus real invitations with Join (Mission 5)** | `joinInvitedWorkspace` (built), `setWorkspaceKind` action | `myInvitations`, `acceptInvitation`, `setWorkspaceKind` | 1118 (until then the invitation list is empty and creation works as today) |
| 4 Business | Part of `/onboarding` | `saveBusiness` → `updateWorkspaceDetails` + `saveOnboardingStep("brand")` | `createWorkspace`, `updateWorkspaceDetails` | 1118 columns |
| 5 Brand | Design | `saveBrandBasics` → `updateBrand` + step | `updateBrand` (versioned) | Wiring only |
| 6 Logo and guidelines | Design | Upload through the existing signed-upload flow; `setBrandLogo`; guidelines as `document` | `createMediaUpload`, `completeMediaUpload`, `updateBrand` | `application/pdf` upload type (below) |
| 7 Preferences | Design | `savePreferences` + `setAiMediaConsent` + step | `savePreferences`, `setAiMediaConsent` | 1118 |
| 8 Done | Design | `saveOnboardingStep("done")` | same | 1118 |

**Order:** one step per pull request, each with a browser test, all behind 1118 approval. Steps 5–8
are skippable. Each "Skip" saves the next step, so resuming never repeats a step.

**Resume after sign-out:** `/onboarding` reads `getOnboardingState` and routes to the next step.
Tested in `customer-integration.test.ts` (sign out, sign in, next step returned).

**No duplicate workspaces or brands:** creation is serialised per user (advisory lock) and repeats
within a minute return the same workspace. The first brand is created under a per-workspace lock
(`createFirstBrand`). Tested with five simultaneous submissions: one workspace, one brand.

### Brand guidelines PDF: investigation and recommendation

- **Storage:** the same private R2 bucket and `org/{orgId}/…` keys as footage, uploaded with a
  signed, single-use `PUT` (overwrite refused, `if-none-match: *`). It's never public; downloads use
  5-minute signed links.
- **Validation:**
  1. Allow-list `application/pdf` only, max **25 MB**, kind `document` (1118 widens the check).
  2. On completion, the server reads the first bytes (ranged GET) and requires `%PDF-`; anything
     else is marked failed and deleted.
  3. No server-side parsing or rendering of PDF content (avoids parser vulnerabilities). Analysis
     skips documents.
- **Serving:** the download link sets `Content-Disposition: attachment` and `Content-Type:
  application/pdf`, so a PDF never renders inline on the app's origin. (R2 is a different origin in
  any case.)
- **Privacy:** listed only to workspace members (RLS), counted in storage, deleted with the workspace
  (`docs/data-retention.md`).
- **Not built yet**, because the upload type would let documents into the library flow before the
  brand-assets screen exists. Built with step 6.
