# Reeldeal — handoff for Claude Code

Everything designed so far, packaged so Claude Code can build it.

## How to use

1. Unzip this folder somewhere on your computer (or copy its contents into your local `reeldeal` repo).
2. Open the folder in Claude Code. It reads `CLAUDE.md` automatically.
3. Start with this prompt:

> Read CLAUDE.md, docs/decisions.md and docs/build-plan.md. Then do Phase 0 only: inspect the
> folder, scaffold the Next.js app, wire in the tokens and fonts, and add the pricing config loader.
> Show me the plan before you write code, and stop when Phase 0 is done.

4. Work phase by phase. Review each phase before moving on.
5. When you're happy, push to GitHub (`anigemmill/reeldeal`).

## What's in here

| Folder | Contents |
|---|---|
| `CLAUDE.md` | Project context and rules Claude Code follows |
| `docs/` | Original brief, decisions log, sitemap, app flow, build plan, pricing source |
| `design/website/` | Approved website pages (Crossroads Blue) |
| `design/components/` | Shared website components |
| `design/app/` | Editing and processing app screens |
| `design/explorations/` | Earlier rounds, reference only |
| `tokens/` | CSS variables and Tailwind preset |
| `config/pricing.json` | Plans, credits, add-ons, rollover rules |

The live, clickable designs stay on the design canvas.
