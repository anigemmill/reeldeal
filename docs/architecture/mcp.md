# MCP server architecture

How to connect and use it: [`docs/mcp.md`](../mcp.md). Security model for the whole platform:
[`security.md`](security.md).

## Overview

```
 MCP clients                    Transports (src/mcp/)                     Shared core (src/server/)
 ───────────                    ─────────────────────                     ─────────────────────────
                                ┌──────────────────────┐
 Claude Desktop ── stdio ─────▶ │ stdio.ts             │  PAT from env,
 Claude Code                    │ StdioServerTransport │  re-verified per call ─┐
                                └──────────────────────┘                        │
                                ┌──────────────────────┐                        │   ┌───────────────────────┐
 Remote clients ── HTTPS ─────▶ │ http.ts              │  Bearer: PAT or OAuth  │   │ server.ts             │
 (Streamable HTTP,              │  /api/mcp (Next.js)  │  401 + RFC 9728 meta   ├──▶│ McpServer, 25 tools   │
  stateless, JSON)              │  /mcp (http-server)  │  Origin allow-list     │   │ zod in/out schemas    │
                                └──────────────────────┘                        │   │ rate limit per user   │
                                         │ auth/tokens.ts, auth/oauth.ts ───────┘   └──────────┬────────────┘
                                         ▼                                                     │ Principal
                                  Principal {userId, orgId, role, scopes}                      ▼ (never from args)
                                                                                 ┌───────────────────────────┐
                                                                                 │ services/                 │
                                                                                 │  workspace usage brands   │
                                                                                 │  media projects creative  │
                                                                                 │  render jobs platform     │
                                                                                 └───┬──────────┬────────┬───┘
                                                         asUser (RLS, role         │          │        │
                                                         authenticated + JWT claims)│          │        │ ai/ provider
                                                                                   ▼          ▼        ▼
                                                                   ┌────────────────┐ ┌──────────┐ ┌──────────────┐
                                                                   │ Postgres       │ │ storage/ │ │ OpenAI       │
                                                                   │ (Supabase /    │ │ R2 or    │ │ structured   │
                                                                   │  PGlite local) │ │ local    │ │ outputs      │
                                                                   │ RLS on every   │ │ signed   │ │ (metadata    │
                                                                   │ table          │ │ URLs     │ │  only)       │
                                                                   └───────▲────────┘ └────▲─────┘ └──────────────┘
                                                                           │ jobs table     │
                                                                   ┌───────┴────────────────┴─────┐
                                                                   │ workers/ (npm run worker)    │
                                                                   │  analysis: ffprobe, scenes,  │
                                                                   │   keyframes, quality         │
                                                                   │  render: FFmpeg → MP4,       │
                                                                   │   ledger charge / release    │
                                                                   └──────────────────────────────┘
```

## Layers

| Layer | Files | Responsibility |
|---|---|---|
| Transport | `src/mcp/stdio.ts`, `http.ts`, `http-server.ts`, `next.ts`, `src/app/api/mcp/route.ts` | Wire format, authentication, resource metadata, origins |
| MCP adapter | `src/mcp/server.ts`, `tools.ts` | Tool definitions, schemas, annotations, rate limits, error mapping |
| Services | `src/server/services/*` | All business rules: authorisation, validation, credits, idempotency |
| Data | `src/server/db/*`, `supabase/migrations/*` | Postgres with RLS; PGlite for local and tests |
| Storage | `src/server/storage/*` | Org-namespaced keys, signed PUT/GET, never overwrite |
| AI | `src/server/ai/*` | Provider interface, OpenAI strict JSON schema, retries, Zod validation |
| Workers | `src/server/workers/*`, `scripts/worker.ts` | Job claiming (`SKIP LOCKED`), heartbeat, FFmpeg analysis and render |

The app will call the same services; MCP is one client of the service layer, not a second implementation.

## Request path

1. The transport authenticates the bearer token (or the STDIO token) and builds a `Principal` from trusted
   data: the token row or OAuth claims plus the user's **current** membership. Organisation ids in tool
   arguments are never accepted.
2. `server.ts` checks the tool's scope and rate bucket, validates input with Zod and calls the service.
3. The service checks role and scope again, then runs SQL through `asUser`: a transaction with
   `set local role authenticated` and the user's JWT claims, so Postgres RLS applies to every statement.
   Missing rows come back as `not_found`, whether they do not exist or belong to another organisation.
4. Server-owned writes (jobs, analysis, exports, the credit ledger) run through `system` and are read-only to
   users under RLS.
5. Results are mapped to a public shape: no storage keys, token hashes or internal ids beyond the resource ids.

## Data model (migration `20261113000001_platform_core.sql`)

`organisations`, `memberships`, `api_tokens`, `brand_profiles`, `media_assets`, `projects`, `project_media`,
`video_briefs`, `video_concepts`, `storyboards`, `jobs`, `media_analysis`, `exports`, `credit_transactions`.
Every customer table has `org_id`; child tables use composite `(id, org_id)` foreign keys so a row cannot
point at another organisation's row. Policies use `private.is_org_member(org, min_role)`.

## Jobs

`jobs` is the queue: `queued → running → succeeded | failed`, with `(org_id, kind, idempotency_key)` unique.
Workers claim with `FOR UPDATE SKIP LOCKED`, heartbeat while running and requeue stale jobs. Vercel functions
only enqueue; long work runs in `npm run worker` (any Node host with FFmpeg). With the embedded database the
STDIO and standalone HTTP servers run a worker in-process.

## Credits

`credit_transactions` is an append-only ledger per organisation and period: `grant`, `hold`, `release`,
`charge`. Balance = grants − charges − active holds. A render places a hold inside an advisory-locked
transaction; the worker converts it to a charge on success or releases it on failure. Quotes are HMAC-signed
by the server (`SIGNING_SECRET`) and bound to org, user, project, storyboard version, formats and cost.

## Deployment shapes

| Shape | Database | Storage | Worker |
|---|---|---|---|
| Local STDIO (`scripts/mcp-stdio.sh`) | PGlite in `.data/pglite` | Local files | In-process |
| Local HTTP (`npm run mcp:http`) | PGlite or `DATABASE_URL` | Local, served at `/media` | In-process, or `--worker` |
| Next.js / Vercel (`/api/mcp`) | `DATABASE_URL` (Supabase) | R2 | Separate `npm run worker` host |
