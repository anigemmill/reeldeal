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
