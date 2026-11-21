# Design decisions log

Decisions made on the design canvas after the original brief, newest last.

## Direction
- **Homepage direction:** "show the work, in motion". A curved 3D slider of finished videos, with a
  prompt bar below that types example briefs ("30s reel for summer bookings"). Inspired by the
  Patta "Let's connect" carousel; a pattern, not a copy.
- **Prompt wall:** dark section of scrolling columns of video cards, each with a prompt pill; a
  featured card types the prompt live. Inspired by a Pinterest reference the owner supplied.
- Other approved patterns: inline coloured pills in headlines, numbered "index" list on electric blue,
  bento feature grid, kinetic type rows, orbit animation for AI analysis, giant gradient wordmark footer,
  big stacked-word mobile menu.

## Colour
- Palette chosen: **05 refined as "Crossroads"** (owner's swatch sheet values): Electric Blue `#2038E2`,
  Bleu Ciel `#007BFF`, Portland Orange `#FF5A00`, Charcoal `#1A1A1A`.
- Then revised to **Crossroads Blue**: peach removed, white `#FFFFFF` and ice `#EEF5FF` surfaces,
  sky `#8FC2FF`, gradients rebuilt around the blues (see `tokens/`).
- Palettes 08 (Tailwind blue/orange) and 09 (linen/tangelo) were tested and not chosen.
  08 was rejected because its colours are Tailwind defaults (generic SaaS look).
- Logo mark and footer wordmark keep the original full Crossroads gradient including orange.
- Orange widened to a defined accent role (see CLAUDE.md "Brand rules").

## Copy and content
- "Most popular" on the Creator plan changed to **"Recommended"** until there is data to back a
  popularity claim (NZ Fair Trading Act).
- Copy adjusted so the site does not promise free multi-format exports; each extra aspect ratio
  costs a credit under current pricing.
- Placeholder business names on video tiles ("Lakeside Lodge", "Bay Sail Charters" etc.) are invented.
  Replace with real customers only with permission.
- Images: owner is supplying real photos and clips to replace the `Scene` placeholders.

## Website edits made by the owner on the canvas
- Removed the kinetic type and orbit sections and the testimonial from Home. Kept them as components
  (orbit still appears on Product). Do not re-add to Home unless asked.

## App
- Studio editor: dark theme confirmed.
- Credits are only spent at render. Storyboard previews are free (matches pricing).
- Open question: free storyboard generation costs compute. Consider a monthly cap on storyboard runs,
  especially on the Free plan.

## Open items before launch
- GST: prices shown as NZD, inclusive or exclusive not yet confirmed.
- Legal wording for footage ownership.
- Music licensing partner.
- Which social channels support direct posting at launch.
- Validate margins (storage, analysis, render and AI generation costs) against the $100k operating
  profit target before publishing prices.

---

# Build decisions (Claude Code sessions)

## Phase 0 (approved)
- Tailwind v4. `tokens/tailwind.preset.ts` converted 1:1 to `@theme inline` in `src/app/globals.css`;
  `tokens/tokens.css` stays the single source of truth for design values.
- All six brief palettes implemented as `.palette-01` … `.palette-06`, each with Workspace (light) and
  Studio (dark) values from `design/explorations/Appearance.dc.html`. Crossroads Blue is the brand default.
- Pricing validated with Zod in a dedicated `prebuild` step.

## Phase 1 scope and direction (approved by owner)
- **Palette 05 keeps `#FFE4D0`.** The no-peach rule applies to the Crossroads Blue brand only, not to
  the six palettes.
- **Three typography combinations stay selectable** for comparison: A (Space Grotesk + Inter + Geist Mono),
  B (Sora + DM Sans + Geist Mono), C (Manrope + Geist Mono). Instrument Serif italic is the accent in all
  three. A is the default only because it matches the current brand rules; no final choice yet.
- **Semantic tokens only in components.** Fixed brand colours are reserved for the logo mark and the
  footer wordmark. Enforced by `npm run check:tokens`.
- **Separate root layouts** for `(marketing)` and `(app)`. The marketing website is fixed to Crossroads Blue;
  only the app reads the user's theme.
- **Status colours** (success, warning, danger) drafted for every palette and mode. Draft values, pending
  owner review in the design-system pages.
- **Contrast failures** are fixed and every changed value is logged below (old → new, ratio).
- **Design review pages** (`/design-system`) and, until auth exists, the app routes are hidden in production
  unless `REELDEAL_DESIGN_REVIEW=1`.
- **Four representative screens** are Phase 1 deliverables: marketing homepage, app dashboard, Autopilot,
  Studio. They use labelled sample data and do not perform real uploads, generation, saving or rendering.
- **Dashboard** has no approved design; designed from scratch as a creative workspace, with Autopilot and
  Studio as the two primary actions.
- **Placeholder imagery**: no production asset library yet. Screens use labelled, illustrated cinematic
  placeholder scenes (the approach of `design/components/Scene.dc.html`, refined). All media goes through one
  registry (`src/content/media.ts`) so real photos and footage replace placeholders without touching screens.

## Phase 1 contrast fixes (automated test: `src/lib/contrast.test.ts`)
No palette colour from the brief was changed. Failures were fixed by adding role tokens or remapping a role
to another colour from the same palette.

| Set | Failure | Fix | After |
|---|---|---|---|
| All palettes · Studio | Light ink on light tint (1.0–1.7:1), e.g. timeline text clips | New `on-tint` token: the palette's dark Studio background in Studio, ink in Workspace | ≥ 9.39:1 |
| Crossroads · Studio | Electric `#2038E2` as link text on `#232323` (2.04:1) | New `link` token; Crossroads Studio links use sky `#8FC2FF`. Buttons keep electric. | 8.48:1 |
| Palette 01 · Workspace | Orange `#F4721E` focus ring on `#F6EFE7` (2.53:1) and as link text (2.89:1) | Focus and link use the palette's blue `#4D6080` | focus 5.58:1, link 6.36:1 |
| Palette 05 · Studio | Orange link text on `#2C2C2C` active nav (4.47:1) | Link = `color-mix(primary 80%, ink)` | 5.26:1 |
| Palette 06 · Workspace | Blue `#2860FF` link text on `#ECECEC` active nav (4.22:1) | Link = `color-mix(primary 85%, ink)` | 5.23:1 |

Other derived values (not fixes): `field-line` (form borders) is `ink-muted` mixed 70% into the surface so
controls reach 3:1; `scrim` is ink at 55% (Workspace) or the dark background at 78% (Studio).

## Phase 1 implementation notes
- Components are hand-built on Radix primitives rather than generated by `shadcn add`, so they use our
  tokens directly. The shadcn alias tokens from the plan were dropped as unnecessary.
- `check:tokens` exceptions: `src/components/brand/` (logo mark, wordmark) and `src/components/media/`
  (placeholder artwork; black/white overlays on top of imagery, which must not change with the theme).
- Links to pages not built yet (website pages, Library, Projects…) are left as real links in the marketing
  nav (Phase 2 pages) but shown as "Soon" and not linked in the app sidebar.

## Checkpoint 1 review (owner)
- Status colours provisionally approved; keep them semantically consistent across palettes and modes.
- Keep the illustrated placeholder scenes for now; screens follow a premium, cinematic, photography-led direction
  so real photography and footage can replace the placeholders later.
- All three typography options stay available until reviewed on the real screens.

## Checkpoint 2
- **Homepage** rebuilt from `W-Home.dc.html` as written (kinetic, orbit and testimonial stay off Home, per the
  owner's canvas edits). Pricing teaser reads `config/pricing.json`; GST wording stays bracketed.
- **Dashboard** (new design): Autopilot (full-bleed cinematic card with the brief box) and Studio (dark editor
  preview resuming the latest project) lead the page. Below: recent projects strip, then footage processing with
  AI-picked best moments, and recent exports. Usage is a slim strip in the header because the sidebar already
  carries the meters. The brief box is a real GET form to `/autopilot?brief=…` (screen arrives at Checkpoint 3);
  upload and "all projects/exports" are shown as "soon", not as working controls.
- **Over-image tokens** `on-media` (white) and `media-veil` (near-black): text, chips and shading on top of photos
  and video are the same in every theme, because the picture does not change with the theme.
- Both screens can be reviewed in any palette, mode and type at `/design-system/screens/home` and
  `/design-system/screens/dashboard`. The live homepage stays Crossroads Blue.

## Checkpoint 2 sign-off (owner)
- Signed off. Dashboard hierarchy kept. Placeholder imagery kept; geothermal steam is a known visual improvement.
- No typography selected. GST wording stays a clearly marked pending decision.

## Checkpoint 3
- **Autopilot** is a mobile-first focus-mode route (no sidebar): Brief → Creating → Review, restyled from the
  exploration designs. Credit cost is shown live and again before approval, computed from
  `config/pricing.json` (`creditCosts` rows now have stable ids). Progress is simulated and labelled;
  approve, request changes and export say they arrive in later phases.
- **Studio** is a full-screen route, always Dark Studio in the user's palette. Playback, scrubbing, clip selection,
  aspect switch and panel tabs work on sample data; editing tools, undo/redo, share and render are shown as
  Phase 4. Below 1024px it shows a "best on a larger screen" notice that points to Autopilot.
- **Appearance** saves palette, mode and type to the theme cookie and applies it before first paint. The
  marketing site ignores it.
- **Accessibility suite** (`npm run test:a11y`): axe WCAG 2.2 A/AA in all 14 palette/mode sets (type A) plus
  types B and C, 4 mobile layouts, keyboard paths and reduced motion. All pass. Fixes it found:
  - How-it-works pills in palette 01 (4.18:1): now outlined on the primary colour.
  - Translucent text on the primary colour in palette 06 (4.33:1): now uses the full on-primary colour.
- **Security foundation**: Zod-validated env (`src/env/`), `server-only` for secrets, `.env.example`, env
  validation before every build, secret scan, security headers with CSP, and `docs/architecture/security.md`
  (RLS, organisation isolation, private R2 with signed URLs) for Phase 3.
- Pending, unchanged: GST wording, typography choice, geothermal steam, `[MUSIC LICENSING PARTNER]`.

## MCP server and platform core (overnight engineering mission)
Full description: `docs/mcp.md` and `docs/architecture/mcp.md`. Decisions made along the way:

- **One service layer.** `src/server/services/` holds every rule (authorisation, validation, credits,
  idempotency). The MCP layer only maps tools to services, so the app can call the same code later.
- **Database: Postgres with RLS, two drivers.** Migrations are Supabase-compatible SQL. Locally and in tests
  they run on embedded PGlite (no install) with a small shim for `auth.users` and `auth.uid()`; the same suites
  also pass on PostgreSQL 16 (`npm run test:postgres`). Supabase itself is not connected yet.
- **RLS is enforced, not bypassed.** User calls run inside a transaction as `authenticated` with JWT claims
  (`asUser`). The owner connection (`system`) is used only for token lookup, workers and the credit ledger.
  No service-role key is used by the MCP server.
- **Auth: personal access tokens first, OAuth ready.** PATs are the development and private-pilot mechanism.
  OAuth 2.1 is implemented as a resource server against the Supabase Auth OAuth server (JWKS); the
  authorisation server still has to be configured. PATs can be switched off for the remote endpoint.
- **Stateless Streamable HTTP with JSON responses**, so the endpoint runs on Vercel functions. No sessions, no
  SSE streams, no deprecated HTTP+SSE transport.
- **Vercel enqueues, workers render.** Analysis and rendering run in `npm run worker` (needs FFmpeg) because
  they exceed serverless limits. With the embedded database the local servers run the worker in-process.
- **Renderer v1 is FFmpeg**: per-scene segments at 1080p H.264 with a silent AAC track, Inter text overlays,
  brand-colour title cards, fades, `+faststart`. Music, voice-over and captions are not in v1.
- **Two-step billing.** `create_video` returns a signed quote first; only `confirm: true` with that quote
  starts work. Credits are held, charged on success, released on failure; retries reuse the hold.
- **AI tools are hidden when no provider is configured**, rather than returning placeholder output.
  `submit_storyboard` lets Claude write a storyboard itself, validated like a generated one.
- **AI sees metadata, not footage**, unless the organisation turns on `ai_media_analysis_consent` (off by
  default; no UI for it yet).
- **Live AI was verified once** through the STDIO server with the environment's OpenAI-compatible
  integration (brief, concepts, storyboard, then a real render of the AI storyboard). Tests use a mocked
  provider.
- **Production refuses unsafe defaults:** it requires `DATABASE_URL`, `SIGNING_SECRET` and R2. Local storage in
  a production build needs `STORAGE_DRIVER=local` as an explicit opt-in (used only for local testing).

## Infrastructure connection phase
Setup checklist: `docs/infrastructure-setup.md`. Decisions:

- **A dedicated Supabase project for Reeldeal.** The org's existing active projects hold another product's
  live data; they were listed read-only and left untouched.
- **Least-privilege grants (migration `20261115000001`).** On Supabase's own Postgres image, the first
  migration left Supabase's default ALL grants in place: a signed-in user could, through the Data API, have
  changed `plan_id`, widened their own token's scopes, repointed `storage_key` at another organisation's
  object, or TRUNCATEd tables. Now every grant is per column, anon has nothing, keys are constrained to the
  row's organisation, and every signing and download re-checks the key against the caller's organisation.
  The local shim reproduces Supabase's default grants, so tests catch this class of bug.
- **No service-role key anywhere.** User requests run as `authenticated` under RLS; workers and the ledger use
  the database connection. `SUPABASE_SERVICE_ROLE_KEY` stays empty.
- **Migrations: `npm run db:migrate`, not the Supabase CLI**, for this project (the two record applied
  migrations in different tables; use one). Remote targets need `--apply`; migrations must be additive.
- **Local stand-ins for verification** (`infra/local`): `supabase/postgres` 17 + Supabase Auth (GoTrue) and an
  S3-compatible store (MinIO, Bitnami legacy image: development only). They prove behaviour, not the
  hosted services' configuration, which `npm run infra:check` and `npm run integration:live` cover.
- **Multipart uploads above 100 MiB**, 64 MiB equal parts (R2 requires equal parts), server lists parts on
  completion, missing parts get fresh URLs. Video uploads up to 20 GB. Single PUTs carry `If-None-Match: *`.
- **Worker:** jobs are claimed at most `max_attempts` times; heartbeat every 15 s; stale after 120 s; ownership
  re-checked before finalising; a unique ledger index makes double charging impossible; SIGTERM finishes within
  25 s or hands the job back. Container: Ubuntu 24.04 + FFmpeg 6.1 (Debian mirrors were unreachable from the
  build sandbox; Ubuntu also ships Inter). `tsx` moved to runtime dependencies (the worker runs TypeScript).
- **Remote MCP stays development-only.** Production builds refuse personal access tokens and return 503 until
  OAuth is configured; the standalone HTTP server binds to 127.0.0.1.

## Mission 3: connected customer web app
How it is wired: `docs/app.md`. Decisions:

- **One backend.** Pages call `src/server/services` directly; client components call server
  actions (`src/app/(app)/_actions`) that wrap one service call each and return safe
  `{ ok, data | error }` results. The website never calls the MCP server, and no business
  rule lives in React. The web app and `/api/mcp` share one platform instance.
- **Supabase Auth with `@supabase/ssr`** (cookie sessions, refreshed in `src/proxy.ts`,
  verified with `getUser` in every page and action). Sign-in, sign-up, reset and
  onboarding are server actions, so tokens never reach browser JavaScript.
- **Web sessions are principals** (`via: "session"`) built from the verified user and real
  memberships. They carry all scopes; roles still apply, and billable work still needs the
  server-signed quote and an explicit confirmation.
- **New workspaces start on the Free plan** (2 one-off video credits, 30 analysis minutes,
  1 brand profile, from `config/pricing.json`). No billing was built.
- **Design screens kept, sample versions preserved**: the Phase 1 dashboard, Autopilot and
  Studio components moved to `*-preview.tsx` for the design review pages; the product
  versions keep the same layout on real data.
- **Autopilot stages are honest**: four real requests (project, brief, concepts,
  storyboard), each shown as running only while it is in flight; no simulated
  percentages. Render progress is the worker's real stage and percentage.
- **Studio edits are versions**: a draft is saved through `submit_storyboard` validation
  as a new storyboard version; assistant revisions and restores also create new versions.
  `generate_storyboard` gained `base_storyboard_id` for revisions (also on the MCP tool).
- **Brand versions** are snapshotted by a database trigger; briefs and storyboards record
  the brand id and version they used. Logos must be images in the same workspace.
- **AI fixture provider** (`AI_PROVIDER=fixture`) for automated browser tests; labelled in
  the UI and refused in production. Live AI was verified separately (the same browser
  journey with `gpt-4.1-mini`).
- **Accessibility of the designed screens** is now checked through the review routes (app
  routes need a session); signed-in pages are checked with axe inside `npm run test:e2e`.
- **Bug found by the browser tests and fixed**: AI footage candidates could include a clip
  whose analysis had failed. Candidates are now analysed clips only.

## Hardening round (after mission 3)
- **Render output reviewed frame by frame** and fixed: clip sound kept (was always silent),
  real cross-dissolves that keep scene lengths (was fade-from-black), larger brand-card text,
  10 Mbit/s cap (one render was 28 Mbit/s), AI on-screen text lengthened to be readable.
  `render-quality.test.ts` inspects the MP4 itself.
- **Images get thumbnails** through the analysis job (dimensions + 480px JPEG), so the
  library never loads large originals for tiles. Images are not scored or charged.
- **Missing footage is not "retry free"**: a render whose source is gone from storage fails
  with the clip's name and the fix, and offers no retry (it could never succeed).
- **Interrupted uploads** (page closed mid-upload) are labelled and can be removed; network
  failures during upload are retried for the missing parts only.
- **Indexes** for the web app's hot paths (migration `20261116000002`), and one usage lookup
  per request shared by navigation and page.
- **Phones**: grids use `minmax(0, 1fr)` so long names wrap instead of widening the page.

## Website pages and hero (2026-11-16)
- **Hero platform words.** "Reels" sits on Instagram's gradient and "Ads" on Meta's blue
  gradient, in white (owner's choice, Option A of the hero mockup). Colours are fixed
  tokens (`--rd-platform-*`), not themed. Instagram Sans and Meta's Optimistic are not
  publicly licensed, so Lexend and Figtree stand in. These are plain words, not the
  platforms' logos. Before launch, check both companies' brand guidelines: they restrict
  third-party use of their colours and lettering that implies endorsement.
- This is an exception to "orange has one job": the Instagram gradient contains orange,
  kept to the tile's lower-left corner so white type sits on pink and purple.

## Stage 3: authentication and customer experience designs (2026-11-17)
- **Email verification is required** (D10) in the proxy, pages and server actions, whatever the project's
  setting. Unverified users see `/verify-email` (resend with a one-minute cooldown; neutral replies).
- **Auth emails use token-hash links** (`supabase/templates/`), not Supabase's default PKCE links, which
  only work in the requesting browser: confirming on a phone after signing up on a laptop failed.
- **The app checks the current password** before a password change (throwaway sign-in, session revoked).
  Supabase Auth v2.180 accepts but ignores `current_password`; we still send it.
- **Secure email change**: both addresses must confirm. The settings page shows the pending address from
  Supabase Auth; the callback reports "one of two confirmed" until both are.
- **Sign out everywhere** revokes every session (`scope: global`) after a confirmation dialog. A password
  change signs out other sessions (`scope: others`).
- **Settings navigation** is shared (`SettingsFrame`, `PRODUCT_SETTINGS`): unbuilt areas show "soon" and are
  not links.
- **Legal pages are placeholders**: section structure only, every body bracketed, a draft notice on
  screen, `noindex`. No legal wording was written.
- **Stage 3 designs are real components on sample data** (`src/components/app/settings/*-screen.tsx`,
  `onboarding-flow.tsx`), shown only on `/design-system/screens/*` and labelled. Wiring them later replaces
  the sample data, not the components. `npm run review:shots` regenerates the screenshot pack.
- **Shallow URL updates** (`history.replaceState`) for the library's `?media=` and Autopilot's `?project=`:
  `router.replace` re-rendered the page on the server and briefly removed the document title.
- **Local stack mirrors production auth settings**: confirmation required, secure email change, the repo's
  email templates served to the local auth server.

## Mission 4: infrastructure readiness and customer backend (2026-11-18)
- **R2 verified live** with the environment's scoped token (12 real-bucket tests, clean-up confirmed).
  CORS for the app origin is missing; applying it is a live change and waits for approval.
- **Membership changes only through SECURITY DEFINER functions** (migration 20261118000001), each
  checking `auth.uid()` and writing an audit event. Users keep no write grants on `memberships`.
  The plan's seat limit comes from `config/pricing.json`, passed by the service.
- **Invitation acceptance requires the caller's confirmed email to match.** The emailed token only
  points at the invitation; the same error for every mismatch (no probing).
- **Ownership transfer:** the app checks the owner's password and the typed workspace name; the
  database checks owner, target role (admin or editor) and target confirmed email; one-owner unique index.
- **Access tokens are bound to their environment** (`api_tokens.environment`): production refuses
  development tokens. The web page may create tokens only from a signed-in session, with an expiry.
- **App-side auth rate limits in Postgres** (per visitor IP and per email, HMAC keys), because
  Supabase sees the app server's IPs. Supabase's limits stay on. No Redis.
- **First brand created under a lock**, and brand-limit checks are transactional (fixes a double-submit
  duplicate and a limit race found by tests).
- **Real billing pages never show sample values** (`toBillingScreenData`, tested). Without a
  `billing_accounts` record the screen says billing isn't set up.
- **The migration safety check ignores function bodies** (they don't run at migration time); `DO`
  blocks are still checked.

## Mission 5 (2026-11-17)

- **R2 CORS is PUT-only from named origins.** Browsers only upload to storage. Downloads are
  navigations and previews are media tags, so GET, HEAD and exposed headers aren't needed. Each
  new origin (preview, production) is added with its own approval.
- **Invitation tokens travel in the URL fragment** (`/invite#…`), never the path or query, so they
  can't reach server logs, analytics or Referer headers. The page posts the token to a server action.
- **The invitation preview shows details only to the invited, confirmed address.** Everyone else gets
  "different address" or "not found".
- **Credit rollover is a month-close in the ledger** (rollover and expiry rows; one close per month,
  enforced by unique indexes), not a balance column. Carry = min(left over, the month's own grant,
  the current allocation). Periods stay calendar months until Stripe (D-B2).
- **Sign-in rate limits count failures only**; sign-up, reset and resend count every attempt.
- **`infra:check` refuses any Supabase project but Reeldeal's**, before connecting.
- **Workspace deletion: deactivate first, delete after a recovery period** (recommended 30 days,
  D-W1), keep legal records (`docs/data-retention.md`). Not built until decided.

## Owner answers on launch copy (2026-11-21)

- **Prices include GST** (`gstIncluded: true` in `config/pricing.json`).
- **Contact email:** anigemmill@theoutsidein.nz (Demo page).
- **Instagram** links to https://www.instagram.com/theoutsidein.nz/. **LinkedIn link removed.**
- **Newsletter sign-up hidden** from the footer until there is more to announce.
- **Founder section is off the About page** until the owner supplies the story, quote and photo.
  "The problem" now uses the brief's own framing instead of a bracket.
- **Tagline** (default page description): "Turn your raw footage into finished reels, ads and website
  videos. AI video production for businesses."
- **Booking:** Cal.com (https://cal.com/ani-gemmill-yg4gmo). The Demo page links out to it instead of the
  design's in-page form, so availability and confirmations are real. The sample time slots are gone.
- **Address:** theoutsidein.nz/reeldeal. The live main site is on Netlify (apex; `www` redirects to
  it), so a Netlify proxy rule forwards `/reeldeal` to the Reeldeal Vercel project at
  `reeldeal.theoutsidein.nz`. Reeldeal runs with `NEXT_PUBLIC_BASE_PATH=/reeldeal`.
  Steps and approvals: `docs/launch-domain.md`.
- **Terms and Privacy:** first draft written for a New Zealand business (Privacy Act 2020, CGA and FTA
  business-use exclusions, NZ law). Labelled "Draft for legal review" on screen and kept out of search
  engines until a lawyer signs it off.
