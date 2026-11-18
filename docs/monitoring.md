# Error monitoring (Sentry): prepared, off

Status 2026-11-18 (Mission 6). **No Sentry project exists and nothing is sent.** Creating the
project, and choosing where its data is stored, are yours to approve.

## What's built

| Source | Hook | What's reported |
|---|---|---|
| Server: pages, server actions, route handlers, `/api/mcp` | `src/instrumentation.ts` → `onRequestError` (Next.js) | Error type, message and stack; tags `route` (the route **pattern**, e.g. `/app/(app)/(shell)/settings/team`), `route_type`, `method`; the path **without** its query string |
| Browser | `src/app/(app)/error.tsx` (error boundary) → server action `reportClientError` | Error name and message, digest, page path. At most 30 a minute per server process |
| Worker: analysis and render failures | `createWorker({ onError })` in `scripts/worker.ts` | Job kind, job id, workspace id, attempt, retryable, duration |
| Worker loop errors | same | Error only |

The reporter is `src/server/monitoring/sentry.ts`: one HTTPS request per event (Sentry's envelope
format), no SDK, nothing added to browser bundles. It never throws and gives up after 2 seconds.

## Redaction (tested: `src/server/monitoring/sentry.test.ts`)

**Never sent:** request bodies, server-action arguments, headers, cookies, query strings, the user,
breadcrumbs.

**Scrubbed from every message and tag before sending:**
- access tokens (`rdl_pat_…`) and invitation tokens (`rdl_inv_…`)
- JWTs
- Supabase secret keys, Resend, Stripe and AWS keys
- anything the log redactor treats as a secret (keys named token, secret, password, cookie, …)
- **email addresses** (replaced with `[email]`)

**Context is allow-listed:** only `job_id`, `attempt`, `max_attempts`, `retryable`, `stage`,
`duration_ms`, `digest`, `route`, `status` and the workspace, media, project and storyboard ids.
Anything else is dropped.

Workspace and job ids are identifiers, not personal data, and they make a failure traceable. They
are sent. Remove `org_id` from the allow-list if you'd rather not.

## The Next.js development log

The earlier finding: the dev server printed server-action arguments, including invitation tokens.
It's fixed by `logging: { serverFunctions: false }` in `next.config.ts`. Mission 6 re-checked it
across every logging path after a full browser run:

- the dev server log
- the worker log
- the app logger, which now also redacts `rdl_inv_` and secret-key shapes

The results are in `docs/production-plan.md` (section 00). Production builds never log action
arguments.

## To turn it on (your approval)

1. Create a Sentry organisation and project (platform "Node.js"). **Choose the EU or US data
   region deliberately**: it's where error data lives. Note it in the Privacy Policy's processors.
2. Project settings → Security & Privacy: turn on **"Data scrubber"** and **"Use default
   scrubbers"**, and **turn off "Store client IP addresses"**. These are a second layer behind the
   app's own scrubbing.
3. Set environment variables (Vercel Production, and the worker host):
   - `SENTRY_DSN`: the project's DSN
   - `SENTRY_ENVIRONMENT`: `production` (and e.g. `preview` on previews, if they report at all)
   - `SENTRY_SAMPLE_RATE`: `1` for the pilot
4. Deploy, then trigger a test error on a preview to confirm it arrives with no personal data.

Alerts to set up in Sentry: a new issue in `service:worker` with `job_kind:render` (renders failing
costs customers time), and an error spike on `route_type:action`.
