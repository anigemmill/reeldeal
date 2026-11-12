# Reeldeal — AI Video Studio

AI video production platform for businesses. Tourism and hospitality first, any industry later.
Two products in one codebase:

1. **Marketing website** (public, SEO, fast)
2. **The app** (logged in): media library, AI analysis, Autopilot, storyboard, Studio editor, render and export

"Reeldeal" is the working name, taken from the repo. Confirm before launch.

## Read first

- `docs/original-brief.md` — the full product and design brief. Its rules still apply (section 11).
- `docs/decisions.md` — every design decision made since the brief, and why.
- `docs/sitemap.md` and `docs/app-flow.md` — what to build.
- `design/` — approved designs as HTML. Treat these as the visual spec (see below).
- `tokens/` — colours, type, radius, spacing. Use these, never raw hex in components.
- `config/pricing.json` — plans and credits. Keep pricing in config, never hard-coded.

## Stack

- Next.js (App Router), React, TypeScript, Tailwind CSS, shadcn/ui where it fits
- Supabase (auth, Postgres, storage metadata). Video files in object storage (R2 is being costed)
- Framer Motion for UI transitions; GSAP only for the homepage curved slider and kinetic type
- Video processing and AI pipeline: to be designed (see `docs/build-plan.md`, phase 3)

## How to read the design files

Files in `design/` are `.dc.html` exports from the design canvas. They will not open standalone
(they need the canvas runtime), but they are plain HTML with inline styles plus a small
`renderVals()` script that holds the data and interactions. Read them for:

- layout, spacing, sizes, copy and colour (inline `style` attributes)
- states and interactions (the `Component` class at the bottom)
- `<dc-import name="X">` means "render component X here" (files in `design/components/` or `design/app/`)
- `<sc-for>` is a loop, `<sc-if>` is a conditional, `{{value}}` comes from `renderVals()`
- `Scene` is a drawn landscape standing in for real footage. Replace with real images or video.

Rebuild them as proper React components using the tokens. Do not copy inline styles verbatim.

`design/explorations/` holds earlier rounds (palette tests, first Studio and Autopilot screens,
gradient concepts). Reference only; the approved versions are in `website/`, `components/` and `app/`.

## Brand rules (approved)

- **Palette: Crossroads Blue.** White and ice-blue surfaces, Clear Sky gradient, charcoal for dark sections.
- **No peach.** `#FFE6D0` is retired everywhere except inside the logo mark.
- **Orange (`#FF5A00`) has one job:** the main action on a screen, or "the AI is doing something"
  (AI tags, generating states, playhead, best-moment markers, one underlined word per headline).
  Target 5–10% of any screen. Never as large backgrounds or body text.
- **Logo mark and footer wordmark** keep the full Crossroads gradient, orange included.
- **Primary nav button ("Start free")** is electric blue, not orange.
- **Studio editor** is dark (charcoal) with blue clips and orange AI accents.
- **Type:** Space Grotesk (headings), Inter (body), Geist Mono (timecodes, labels, data),
  Instrument Serif italic for one or two emphasis words per headline.
- **Motion:** expressive on the website, almost none inside editing. Always respect
  `prefers-reduced-motion`.

## Theme system

The brief requires six user-selectable palettes, each in Light Workspace and Dark Studio modes.
Crossroads Blue is the brand and the default. The six palettes stay available as in-app themes
(Settings → Appearance; see `design/explorations/Appearance.dc.html` for the preview and apply flow).
Build all theming on CSS variables (`tokens/tokens.css`) so a palette is a single class swap.

## Rules for working in this repo

- Inspect what exists before changing structure. Explain any major architectural change.
- Small, phased changes. Follow `docs/build-plan.md`; do not build everything in one pass.
- No fake functionality presented as real. If a feature is mocked, label it in code and UI.
- Accessibility: real buttons and links, labels on inputs, 4.5:1 text contrast, keyboard paths.
- Anything in `[BRACKETS]` in the designs is copy or data still needed from the owner. Keep it bracketed.
