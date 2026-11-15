# Reeldeal MCP server

The Reeldeal MCP server lets an AI client (Claude Desktop, Claude Code, the MCP Inspector or any MCP client)
work in a Reeldeal workspace: read brand profiles, search the media library, upload and analyse clips, create
projects, write briefs and storyboards, and render real MP4 videos after the user agrees to the credit cost.

- Built on the official TypeScript SDK (`@modelcontextprotocol/sdk` 1.32.2, protocol 2025-11-25).
- Two transports: **STDIO** (local) and **Streamable HTTP** (remote). The deprecated HTTP+SSE transport is
  not offered.
- Every tool calls the same service layer the app will use (`src/server/services/`). The MCP layer only
  maps tools to services; no business rule lives in it.
- Architecture, data flow and the trust boundaries: [`docs/architecture/mcp.md`](architecture/mcp.md).

## Quick start (local, STDIO)

Needs Node 22+ and `ffmpeg`/`ffprobe` on the PATH (for analysis and rendering).

```bash
npm install
```

```bash
npm run dev:setup
```

`dev:setup` creates the embedded database in `.data/pglite`, applies the migrations, loads the demo
workspaces (real clips generated from the placeholder stills) and writes four demo tokens to
`.data/dev-tokens.json` (git-ignored):

| Token | User and workspace | Scopes | What it shows |
|---|---|---|---|
| `aroha_owner_full` | Aroha, owner of Lakeside Lodge | read, write, render | Everything |
| `ben_editor_no_render` | Ben, editor at Lakeside Lodge | read, write | Can quote but not start renders |
| `cleo_viewer_read` | Cleo, viewer at Lakeside Lodge | read | Read-only |
| `dev_harbour_full` | Dev, owner of Harbour Café | read, write, render | A second organisation, for isolation |

Check it end to end with the SDK client (read-only unless you add flags):

```bash
npm run mcp:smoke
```

```bash
npm run mcp:smoke -- --render
```

`--render` submits a two-scene storyboard, quotes it, confirms and waits for a real 1080×1920 MP4.

Step-by-step guide with checks and troubleshooting: [`docs/connect-claude.md`](connect-claude.md).

### Claude Desktop

Edit `claude_desktop_config.json` (Settings → Developer → Edit Config). Use the absolute path of your
checkout; in this environment it is `/home/user/reeldeal`.

```json
{
  "mcpServers": {
    "reeldeal": {
      "command": "/home/user/reeldeal/scripts/mcp-stdio.sh",
      "env": {
        "REELDEAL_MCP_TOKEN": "rdl_pat_… (from .data/dev-tokens.json)"
      }
    }
  }
}
```

Restart Claude Desktop. The server appears as **reeldeal** with 22 tools (25 when an AI provider is set).
On Windows, use `"command": "node"` with the arguments from `scripts/mcp-stdio.sh` and `"cwd"` set to the repo.

### Claude Code

```bash
claude mcp add reeldeal --env REELDEAL_MCP_TOKEN=rdl_pat_REPLACE_ME -- /home/user/reeldeal/scripts/mcp-stdio.sh
```

Then `/mcp` in Claude Code lists the server and its tools.

### AI tools

`create_video_brief`, `generate_video_concepts` and `generate_storyboard` need an AI provider. Put
`OPENAI_API_KEY` (and optionally `OPENAI_MODEL`, `OPENAI_BASE_URL`) in `.env.local`, or in the client's
`env` block. Without a key those three tools are not listed and `get_platform_status` reports
`ai.configured: false`. Nothing is simulated.

The smoke test can exercise them live (this makes paid calls, three per run):

```bash
npm run mcp:smoke -- --ai
```

## Tokens

Personal access tokens (`rdl_pat_…`) are the development and private-pilot mechanism. Only a SHA-256 hash is
stored; the token is shown once. Each token belongs to one user **and one organisation**, has scopes, an
expiry and can be revoked; the user's role comes from their membership at call time, so demoting a user
takes effect immediately.

```bash
npm run mcp:token -- --email aroha@lakeside.example --scopes mcp:read,mcp:write --name "Claude Desktop" --days 30
```

```bash
npm run mcp:token -- --list --email aroha@lakeside.example
```

```bash
npm run mcp:token -- --revoke <token-id>
```

| Scope | Allows |
|---|---|
| `mcp:read` | All read tools |
| `mcp:write` | Creating and changing brands, uploads, projects, briefs, storyboards; starting analysis |
| `mcp:render` | Starting renders and retries (credit-spending) |

Roles still apply on top of scopes: viewers cannot write, editors and above can.

## Remote (Streamable HTTP)

Two ways to serve the same endpoint:

| | Command | Endpoint |
|---|---|---|
| Next.js (Vercel) | `npm run dev` / deployed app | `/api/mcp` |
| Standalone Node | `npm run mcp:http` | `http://localhost:3333/mcp` |

**Remote authentication is development-only until the OAuth authorisation server is connected.**
Personal access tokens are accepted only by `npm run dev` and by the standalone server, which listens on
`127.0.0.1` only. A production build (any Vercel deployment, preview included) refuses tokens and answers
`503` until OAuth is configured. Nothing is deployed.

Both are stateless Streamable HTTP with JSON responses, so they run on serverless platforms. Neither
accepts unauthenticated requests: without a valid bearer token the server answers `401` with
`WWW-Authenticate: Bearer resource_metadata="…/.well-known/oauth-protected-resource/…"` (RFC 9728), which
is what MCP clients use to discover how to sign in. Browser origins not in `MCP_ALLOWED_ORIGINS` are refused.

The standalone server also serves `/healthz` and, with local storage, the signed `/media` URLs. The Next.js
route needs `DATABASE_URL` (no embedded database on serverless) and returns `503` until the platform is
configured.

Connect Claude Code to a remote endpoint with a PAT:

```bash
claude mcp add --transport http reeldeal-remote http://localhost:3333/mcp --header "Authorization: Bearer rdl_pat_REPLACE_ME"
```

### OAuth 2.1

For public use, clients sign in through OAuth instead of pasting a token. The server is an OAuth **resource
server**; the authorisation server is the Supabase Auth OAuth 2.1 server. Set:

- `MCP_PUBLIC_URL`: the public URL of the endpoint, e.g. `https://app.example/api/mcp` (the token audience,
  RFC 8707)
- `SUPABASE_JWT_ISSUER` and `SUPABASE_JWKS_URL`: from the Supabase project

The verifier checks signature (JWKS), issuer, audience and expiry, then resolves the organisation from the
user's memberships. A user in several workspaces picks one with the `X-Reeldeal-Organisation` header; the
choice is checked against their memberships, never trusted. Production builds accept OAuth tokens only.

Status: verifier implemented and tested against a local JWKS server; not yet connected to a live Supabase
OAuth server.

## Uploads

`create_media_upload` returns either one signed PUT (`upload.method: "PUT"`, with headers that must be sent,
including `If-None-Match: *` on R2) or, above 100 MiB on R2, a multipart plan (`upload.method: "multipart"`):
equal-sized parts with a signed URL and byte range each. Parts can be sent in any order or in parallel.
`complete_media_upload` checks the stored parts itself; if any are missing it returns
`status: "awaiting_upload"` with fresh URLs for just those parts. Originals are never overwritten. Upload
links last `UPLOAD_URL_TTL_SECONDS` (default 1 hour); download links `R2_SIGNED_URL_TTL_SECONDS`.

## Credits and confirmation

Rendering spends video credits, so `create_video` works in two steps:

1. Call without `confirm`: returns a quote (credits, current balance from the ledger, `quote_token`, expiry
   15 minutes). Nothing is held or charged.
2. Show the cost to the user. Only after they agree, call again with `confirm: true` and the `quote_token`.

The quote token is signed by the server and bound to the organisation, user, project, storyboard version,
formats and cost. A changed storyboard, a different user or an expired quote is refused. Confirming the same
quote twice returns the same job. Credits are **held** when the render starts, **charged** only when it
succeeds and **released** if it fails; `retry_render` retries a platform failure on the same hold. The
client never supplies a balance or a cost.

Analysis (`analyse_media`) uses the plan's analysis allowance, counted in seconds.

## Tools

| Group | Tools |
|---|---|
| A. Workspace | `get_platform_status`, `get_my_workspace`, `get_usage` |
| B. Brand | `list_brands`, `get_brand_profile`, `create_brand_profile`, `update_brand_profile` |
| C. Media | `search_media`, `get_media_details`, `create_media_upload`, `complete_media_upload`, `analyse_media`, `get_media_analysis` |
| D. Projects and creative | `list_projects`, `get_project`, `create_project`, `create_video_brief`\*, `generate_video_concepts`\*, `generate_storyboard`\*, `submit_storyboard` |
| E. Render and export | `create_video`, `get_render_status`, `list_exports`, `get_export`, `retry_render` |

\* Listed only when an AI provider is configured.

`submit_storyboard` lets the client write a storyboard itself (for example when Claude drafts it) using
real asset ids; it is validated exactly like a generated one.

Every tool has input and output schemas, MCP annotations (read-only, idempotent) and returns structured
content plus a JSON text copy. Errors come back as tool errors with a code (`not_found`, `forbidden`,
`invalid_input`, `insufficient_credits`, `confirmation_required`, `capability_unavailable`, …) and a safe
message; internal details stay in the server log.

## What is real and what is not

| Capability | Status |
|---|---|
| Database, RLS, organisation isolation | Real. Verified on PGlite, PostgreSQL 16 and the `supabase/postgres` 17 image with Supabase Auth (`infra/local`). Not yet run on a hosted Supabase project |
| Uploads and downloads with signed URLs | Real. R2 driver verified against an S3-compatible server (SigV4, multipart, conditional PUT). Not yet run against a Cloudflare R2 bucket |
| Analysis | Real FFmpeg: technical metadata, scene cuts, keyframes, quality heuristics (sharpness, exposure, black frames, audio). AI description only with the organisation's consent and a provider |
| Briefs, concepts, storyboards | Real AI calls (OpenAI structured outputs) when configured; otherwise unavailable |
| Rendering | Real FFmpeg MP4 (H.264/AAC, 1080p, cuts, text overlays, brand-colour title cards). No music, voice-over or captions yet |
| Credits | Real ledger with holds; amounts from `config/pricing.json` |
| OAuth | Verifier real; authorisation server not configured |

## Testing

| Command | What |
|---|---|
| `npm test` | All unit tests, including the server and MCP suites on embedded PGlite (AI mocked) |
| `npm run test:postgres` | The server and MCP suites against a throwaway database on a local PostgreSQL 16 |
| `npm run test:supabase-local` | The same suites on the `supabase/postgres` image (`npm run stack:up` first) |
| `npm run test:storage` | R2 driver and large uploads against the local S3-compatible server |
| `npm run integration:live` | Full workflow on real infrastructure: see [`docs/infrastructure-setup.md`](infrastructure-setup.md) |
| `npm run worker:restart-test` | Kills a real worker mid-render and checks recovery and single charging |
| `npm run infra:check` | Read-only check of every configured credential |
| `npm run mcp:smoke` | SDK client against the real STDIO server (add `--http <url>` for HTTP) |
| `npx @modelcontextprotocol/inspector scripts/mcp-stdio.sh` | Interactive inspection (set `REELDEAL_MCP_TOKEN` first) |

`npm run db:local` starts a local PostgreSQL 16 in `.data/postgres` (port 54329) if you want the Postgres
path for development: set `DATABASE_URL=postgres://postgres@localhost:54329/reeldeal`, run
`npm run db:migrate`, `npm run dev:setup`, and run `npm run worker` alongside the server (the embedded
database runs the worker in-process instead).
