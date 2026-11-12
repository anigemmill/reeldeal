# Website sitemap

Five items in the main nav. Design files in `design/website/`.

| Route | Page | Design file | Notes |
|---|---|---|---|
| `/` | Home | `W-Home.dc.html` | Arc hero + prompt, prompt wall, How it works (index on blue), bento, tourism, pricing teaser |
| `/product` | Product | `W-Product.dc.html` | One long page with anchors: `#autopilot`, `#studio`, `#brand`, `#library`, `#export` |
| `/solutions/tourism` | Tourism and hospitality | `W-Solutions.dc.html` | "Find your fit" switcher, seasons, agency panel. Template for future industry pages |
| `/showcase` | Showcase | `W-Showcase.dc.html` | Search, filters, masonry grid, featured story |
| `/pricing` | Pricing | `W-Pricing.dc.html` | Driven by `config/pricing.json` |
| `/about` | About | `W-About.dc.html` | |
| `/demo` | Book a demo and contact | `W-Demo.dc.html` | Form, team size, time slots, confirmation |
| `/login`, `/signup` | Sign in / Create account | `W-Auth.dc.html` | Last public pages; app starts after |
| — | Mobile menu | `W-Menu.dc.html` | Full-screen overlay |

Later (not built): `/solutions/agencies`, `/solutions` hub, case study pages, resources/blog, Privacy, Terms.

Shared website components (`design/components/`): `Nav`, `Footer`, `ArcHero`, `PromptWall`,
`Kinetic`, `Orbit`, `Scene` (placeholder footage).

Conversion paths: every page ends in **Start free** (self-serve → `/signup`) and **Book a demo**
(sales-led → `/demo`).
