# Build plan

Work in phases. Finish and review each before starting the next. Commit small.

## Phase 0 — Set up (first Claude Code session)
- Inspect the repo. If empty, scaffold Next.js (App Router) + TypeScript + Tailwind + shadcn/ui.
- Add `tokens/tokens.css` to global styles and `tokens/tailwind.preset.ts` to the Tailwind config.
- Load fonts with `next/font`: Space Grotesk, Inter, Geist Mono, Instrument Serif (italic).
- Route groups: `(marketing)` for the website, `(app)` for the logged-in product.
- Add `config/pricing.json` and a typed loader.

## Phase 1 — Design system
- Primitives from tokens: Button (primary blue, action orange, secondary, ghost), Pill, Card,
  Input, Select, Switch, Tabs, Progress, Badge, Tooltip, Modal, Toast.
- Media primitives: `MediaThumb` (image or video, score badge, duration, processing overlay),
  `VideoFrame` (aspect-ratio aware, safe zones).
- `/design-system` preview page listing every component in light and dark.
- Theme switching via CSS variables, including the six user palettes from the brief.

## Phase 2 — Marketing website
- Build `Nav`, `Footer` (gradient panel + giant wordmark), then pages in this order:
  Home, Pricing, Product, Showcase, Solutions, About, Demo, Auth, mobile menu.
- `ArcHero`: CSS 3D transforms + one requestAnimationFrame loop (not setInterval). Only the centre
  tile plays video; others are posters. Pause when off-screen and for reduced motion.
- Pricing page reads `config/pricing.json` (monthly/annual toggle, comparison table, add-ons, credit table).
- SEO: metadata per page, OG images, sitemap.xml, fast LCP (poster images, lazy video).

## Phase 3 — App foundations and processing pipeline
- Supabase auth, organisations (workspaces), brand profiles, plans and usage.
- Upload: resumable uploads direct to object storage; create media records; show per-file progress.
- Processing pipeline (background jobs): proxy generation, thumbnails, AI analysis
  (scenes, shot types, people, quality, steadiness, best moments, tags, brand fit), search index.
- Usage metering: analysis hours, storage, credits (three wallets, rollover rules in pricing.json).
- Library and Clip detail screens wired to real data.

## Phase 4 — Generation and editing
- Brief → storyboard generation (free previews, capped), storyboard review and shot swap.
- Studio editor: timeline model (tracks, clips, text, captions, music), preview player,
  assistant (conversational edits as diffable operations with keep/undo), versions.
- Render service: server-side render, queue, status updates, credit charge on success only,
  free retry on platform failure.
- Export: formats, captions burn-in, logo end card, downloads, review links.

## Phase 5 — Autopilot (mobile) and polish
- Autopilot mobile flow (brief → working → review options), push notifications when ready.
- Motion pass, accessibility pass, performance budget, all six palettes in light and dark.

## Before pricing goes live
Validate real costs (storage, analysis per hour, render per video, AI generation) against the
allowances in `config/pricing.json` and the $100k annual operating profit target.

---

## Updates after Phase 1 (approved scope)
Phase 1 grew, with approval, to include four designed screens on sample data: the marketing homepage,
dashboard, Autopilot and Studio, plus the Appearance screen and an accessibility suite. That moves work out of
later phases:

- **Phase 2** no longer builds the homepage, Nav, Footer, ArcHero or PromptWall; it builds the other website
  pages, SEO, OG images and the sitemap.
- **Phase 3** wires the existing dashboard, AppNav meters and Appearance screen to real data, and implements
  `docs/architecture/security.md` (auth, RLS, organisations, private R2, signed URLs).
- **Phase 4** attaches the edit model, assistant, versions and render service to the existing Studio UI, and
  the render confirmation already shown in Autopilot and Studio.
- **Phase 5** attaches the Autopilot pipeline and notifications to the existing Autopilot screens.

## Platform core and MCP server (built ahead of Phase 3/4)
The overnight MCP mission built a functional slice of Phases 3 and 4 behind an MCP interface, with no UI
changes: database schema with RLS, organisation isolation, tokens, media upload and FFmpeg analysis, brand
profiles, AI briefs and storyboards, FFmpeg rendering, the credit ledger and jobs. See `docs/mcp.md`.
Phase 3 now connects these services to Supabase Auth, R2 and the existing app screens instead of building
them from scratch.
