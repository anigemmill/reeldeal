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
