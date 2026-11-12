# Development

Added in Phase 0. The handoff docs in this folder are unchanged.

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Dev server |
| `npm run build` | Validates `config/pricing.json` (prebuild), then builds |
| `npm run validate:pricing` | Pricing check on its own. Accepts a path: `npm run validate:pricing -- other.json` |
| `npm run typecheck` | Generates route types, then `tsc` |
| `npm run lint` | ESLint |
| `npm test` | Vitest |
| `npm run check` | All of the above except the build |

Node 22 or newer.

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
src/lib/theme.ts            palette and mode class names
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
