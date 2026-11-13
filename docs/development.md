# Development

Added in Phase 0. The handoff docs in this folder are unchanged.

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Dev server |
| `npm run build` | Validates `config/pricing.json` and the environment (prebuild), then builds |
| `npm run validate:pricing` | Pricing check on its own. Accepts a path: `npm run validate:pricing -- other.json` |
| `npm run validate:env` | Environment variables against `src/env/schema.ts` |
| `npm run check:tokens` | Fails on raw colours or fixed brand classes in UI code |
| `npm run check:secrets` | Fails on committed credentials or `process.env` reads outside `src/env/` |
| `npm run test:a11y` | Browser accessibility suite (axe, keyboard, reduced motion). Needs `npm run build` first |
| `npm run typecheck` | Generates route types, then `tsc` |
| `npm run lint` | ESLint |
| `npm test` | Vitest |
| `npm run check` | Validation, token and secret checks, typecheck, lint and unit tests (not the build or a11y) |
| `npm run dev:setup` | Embedded database, migrations, demo workspaces and MCP tokens (`.data/dev-tokens.json`) |
| `npm run mcp:stdio` | MCP server over STDIO (what `scripts/mcp-stdio.sh` runs) |
| `npm run mcp:http` | Standalone Streamable HTTP MCP server on port 3333 |
| `npm run mcp:token` | Create, list or revoke personal access tokens |
| `npm run mcp:smoke` | End-to-end MCP check with the SDK client (`--http`, `--render`, `--upload`, `--ai`) |
| `npm run worker` | Background worker for analysis and render jobs (Postgres setups) |
| `npm run db:local` | Local PostgreSQL 16 in `.data/postgres` on port 54329 |
| `npm run db:migrate` | Apply migrations to `DATABASE_URL` |
| `npm run test:postgres` | Server and MCP suites against a throwaway PostgreSQL database |

Node 22 or newer. Copy `.env.example` to `.env.local` for local settings (none are required in Phase 1).

## Routes

| Route | What |
|---|---|
| `/` | Marketing homepage (always Crossroads Blue) |
| `/dashboard`, `/autopilot`, `/studio`, `/settings/appearance` | App screens with labelled sample data |
| `/design-system` | Review area: components, themes, type, contrast, and every screen in any theme |

App routes and `/design-system` are hidden in production unless `REELDEAL_DESIGN_REVIEW=1`.

## Layout

```
config/pricing.json         plans and credits (validated by src/lib/pricing/schema.ts)
tokens/tokens.css           all design tokens and themes (single source of truth)
tokens/tailwind.preset.ts   original v3 preset, kept for reference; not used by the build
src/app/globals.css         Tailwind v4 @theme mapping onto the tokens
src/app/fonts.ts            next/font setup (exposes --font-* variables)
src/app/(marketing)/        public website, own layout
src/app/(app)/              logged-in product, own layout
src/lib/pricing/            typed pricing loader
src/lib/theme.ts            palette, mode and type class names; theme cookie
src/env/                    Zod-validated environment (public, server-only, flags)
src/content/                media registry, site copy, labelled sample data
docs/architecture/          security and MCP architecture
src/server/                  platform core: db, auth, services, storage, AI, workers
src/mcp/                     MCP server (tools, STDIO, Streamable HTTP)
supabase/migrations/        database schema with RLS
docs/mcp.md                 connecting Claude and other MCP clients
```

## Theming

- Brand default is Crossroads Blue (no palette class).
- User palettes: `palette-01` … `palette-06`. Modes: `mode-workspace` (light) and `mode-studio` (dark).
  Six palettes × two modes = 12 user themes.
- Put the palette and mode classes on `<html>`. A mode class can also go on a subtree,
  e.g. the Studio editor: `<div class="mode-studio">`.
- For anything that should follow the theme, use semantic utilities: `bg-bg`, `bg-surface`,
  `bg-surface-muted`, `text-ink`, `text-ink-muted`, `border-line`, `bg-primary text-primary-foreground`,
  `bg-action text-action-foreground`, `bg-tint`.
- Brand utilities (`bg-electric`, `text-orange`, `bg-dark-*`, `bg-grad-*`) are fixed colours and do not
  change with the palette. Use them only where the brand must stay constant (logo, footer wordmark).
- `studio:` variant applies styles inside Studio mode, e.g. `studio:shadow-none`.
- Never write a colour value outside `tokens/tokens.css`.

## Tailwind v3 preset → v4

`tokens/tailwind.preset.ts` was converted 1:1 to the `@theme inline` block in `src/app/globals.css`.
Class names are the same. The v3 `backgroundImage` entries became `@utility bg-grad-*` because v4
has no background-image theme key. As in v3 (which used `extend`), Tailwind's default palette is
still available. Removing it would enforce token-only colours; that is a later decision.
