# The customer web app

Sign up, set up a workspace and brand, upload footage, have it analysed, make a video
with Autopilot or Studio, confirm the credits, render, download. Every step runs on
the same platform services as the MCP server.

## Architecture

```
 Browser (React client components: forms, uploads, players, polling)
    │  server actions (POST, same-origin)          direct PUT/GET with signed URLs
    ▼                                                          │
 src/app/(app)/_actions/*   ── thin wrappers, no business rules│
 src/server/app/            ── session → Principal, results    │
    │                                                          ▼
 src/server/services/*  ◄── the SAME services ──  src/mcp/ (MCP tools)      R2 / S3 storage
    │            │             │                                            ▲
 Supabase Postgres (RLS)   OpenAI (metadata only)   jobs table ──► worker (FFmpeg) ─┘
 Supabase Auth (sessions)
```

- **Identity.** `@supabase/ssr` keeps the session in cookies; `src/proxy.ts` refreshes it
  and protects app routes; every page and action verifies the user with Supabase Auth
  (`getUser`) and builds a `Principal` (`via: "session"`) from their real memberships.
  The chosen workspace (cookie) is honoured only if the user is a member. All data access
  then runs as `authenticated` under RLS, exactly like MCP.
- **No second backend.** Pages are server components that call services directly; client
  components call server actions that wrap one service call each. The website never calls
  the MCP server.
- **Files never pass through Next.js.** Uploads go from the browser straight to storage
  (single signed PUT, or parallel multipart parts for large files); downloads and previews
  use short-lived signed GET links minted on request.
- **Long work runs in the worker**: analysis and rendering are jobs; pages poll their real
  status. AI calls (brief, concepts, storyboard) are single requests; the Autopilot screen
  shows a stage as running only while its request is in flight.

## What works

| Area | Status |
|---|---|
| Sign up, sign in, sign out, password reset (email link), session refresh and expiry | Working (Supabase Auth) |
| Onboarding: workspace, industry, website, first brand | Working (Free plan, 2 trial credits) |
| Dashboard | Real workspace, plan, usage, projects, processing, best clips, exports, credits; first-use guide |
| Library | Drag and drop or choose; several files; progress, cancel, retry (missing parts only); search, filters, sort, grid/list; details with preview, metadata, quality checks and keyframes |
| Analysis | Real FFmpeg in the worker; failures shown with the reason; AI scene descriptions only with an admin's consent |
| Autopilot | Brief with real brands and footage → brief, concepts, storyboard (real AI) → review, revise, choose concept → quote → confirm → render → MP4 preview and download |
| Studio | Real timeline, preview of source clips (or the latest render), inspector edits saved as new versions, assistant revisions, version view and restore, render |
| Brands | Create (within plan), edit voice, audiences, colours, fonts, guidelines, restrictions, logo; versions kept |
| Projects, Exports | Real lists; signed downloads; failed renders shown as not charged |

Shown but disabled, with the reason on screen: undo/redo, split/trim inside clips,
captions, music and voice-over (renders keep each clip's own sound; brand cards are silent), colour, review links,
templates.

## Run it locally

Needs Docker, Node 22 and FFmpeg.

```bash
npm install && npm run stack:up
```

```bash
set -a && . infra/local/stack.env && set +a && npm run db:migrate
```

In two terminals (with the same environment):

```bash
npm run worker
```

```bash
AI_PROVIDER=fixture npm run dev
```

Open http://localhost:3000/sign-up. Emails (password reset) arrive at http://localhost:8025.
Use `OPENAI_API_KEY=… npm run dev` instead of `AI_PROVIDER=fixture` for real AI.
`AI_PROVIDER=fixture` gives deterministic test output, labelled in the UI, and is refused
by production builds.

## Tests

| Command | What it covers |
|---|---|
| `npm test` | Service, MCP, privilege and reliability tests on embedded Postgres (AI mocked) |
| `npm run test:e2e` | The whole customer journey in a real browser on the local stack (fixture AI), plus axe on signed-in pages |
| `npm run test:a11y` | All themes on the designed screens (review routes) and the public account pages |

## When things go wrong

| Situation | What the customer sees and can do |
|---|---|
| Network drops during an upload | The file is marked failed with the reason; **Retry** resends only the missing parts |
| Page closed or reloaded mid-upload | The file shows **Upload interrupted**; open it and **Remove unfinished upload**, then upload again |
| A file isn't a real video | **Analysis failed** with the reason; nothing else is affected |
| AI request fails | The stage shows the error, nothing is charged; **Try again** from that stage, or go back with the brief kept |
| Render fails on our side | "You were not charged"; **Retry free** (credits held again, charged only on success) |
| Footage missing from storage | The render names the clip and says to replace it in Studio; no pointless retry; not charged |
| Not enough credits | The quote says so and the Render button is disabled |
| Confirm clicked twice | One render, one charge (the server-signed quote is single-use) |
| Session expired | Sent to sign in with "Your session ended", then back to the page |
| Worker stops mid-job | Another worker picks the job up after the heartbeat timeout; still charged once |

## Render output

Each format is 1080p (9:16 1080×1920, 1:1 1080×1080, 16:9 1920×1080, 4:5 1080×1350),
H.264 at 30 fps capped at 10 Mbit/s, AAC 48 kHz stereo, fast-start. Clips are centre-cropped
to fill the frame and keep their own sound; brand cards use the brand's first colour with
large centred text and are silent. "Cut" joins directly, "fade" fades in from black,
"dissolve" cross-fades picture and sound while keeping each scene's length.
`src/server/workers/render-quality.test.ts` checks these properties on a real render.
