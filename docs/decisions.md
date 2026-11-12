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
