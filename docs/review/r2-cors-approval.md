# Approval request: R2 CORS policy for `reeldeal-dev-media`

**Status: awaiting your approval. Not applied.**

## Why it's needed (verified 2026-11-18)

- A real browser `PUT` from the app's origin (`http://localhost:3000`) to a valid signed upload URL
  for `reeldeal-dev-media` is refused before upload ("Failed to fetch": the CORS preflight gets HTTP
  403 with no CORS headers). No object was written.
- Server-side uploads (the 12-test R2 suite) work, because CORS applies only to browsers.
- Customers upload from the browser, so library uploads, brand logos and onboarding assets need this
  policy.

## The exact policy (`infra/r2/cors.json`)

```json
{
  "rules": [
    {
      "allowed": {
        "origins": ["http://localhost:3000"],
        "methods": ["PUT"],
        "headers": ["content-type", "if-none-match"]
      },
      "maxAgeSeconds": 3600
    }
  ]
}
```

| Setting | Value | Why |
|---|---|---|
| Origins | `http://localhost:3000` only | The app on a developer machine, for the browser upload tests. Preview and production origins are added later, each with its own approval |
| Methods | `PUT` only | The browser only uploads to R2 (single PUT, multipart parts, brand logo). Downloads are page navigations and previews are `<img>`/`<video>` tags; neither uses CORS |
| Headers | `content-type`, `if-none-match` | The two headers the app sends with a single PUT. Both are **part of the signature**, so a browser can't change them |
| Exposed headers | none | No script reads storage responses. The server lists uploaded parts itself |
| Preflight cache | 1 hour | Fewer preflight requests during multi-part uploads |

**Tightened from the earlier draft**, which also allowed `GET` and `HEAD` and exposed `ETag`. The app
doesn't need those from the browser, so they're left out.

## What it does NOT do

- **It doesn't make the bucket public.** CORS only tells browsers which web pages may send requests.
  R2 still refuses every request that isn't validly signed, as verified: unsigned requests are
  refused. Public access (r2.dev or a custom domain) is a separate setting, which stays off.
- **It doesn't weaken signed URLs.** The signature, its expiry (5 minutes for downloads, 1 hour for
  upload links), the signed `content-type` and the signed `if-none-match: *` (never overwrite an
  original) are still enforced by R2 for every request, from any origin.
- **It doesn't affect other buckets.** CORS is a per-bucket setting. The command names
  `reeldeal-dev-media` only. Nothing else in the Cloudflare account changes.
- **It doesn't change any data.**

## How to apply (one of)

**A. Cloudflare dashboard (recommended: no new credentials).** R2 → `reeldeal-dev-media` → Settings →
CORS policy → Add → JSON tab. The dashboard uses the S3 format:

```json
[
  {
    "AllowedOrigins": ["http://localhost:3000"],
    "AllowedMethods": ["PUT"],
    "AllowedHeaders": ["content-type", "if-none-match"],
    "MaxAgeSeconds": 3600
  }
]
```

While you're on that page, please also confirm:

- **Public access** shows Disabled (no r2.dev URL, no custom domain).
- **Object lifecycle** has "abort incomplete multipart uploads after 7 days" (add it if missing:
  `infra/r2/lifecycle.md`).

**B. Wrangler.** The R2 token in this environment is object-only and can't change bucket settings
(by design). Wrangler needs a Cloudflare API token with **Workers R2 Storage: Edit**, which is
account-wide R2 admin. If you choose this route, create it with a short expiry, provide it through
the environment's secret store (never in chat), and revoke it after use:

```bash
npx wrangler r2 bucket cors set reeldeal-dev-media --file infra/r2/cors.json
```

```bash
npx wrangler r2 bucket cors list reeldeal-dev-media
```

## After approval: the browser test

`npm run test:r2-browser` (`scripts/r2-browser-test.ts`) runs the real app against the real bucket,
using the local stack for accounts only. It covers:

- image, video and large multipart (~150 MB) uploads
- cancel (asset failed, parts aborted in the bucket)
- retry after a network failure
- signed download, and refusal without a signature
- expired signed link (30-second lifetime for the test)
- original-file overwrite refused (HTTP 412)
- clean-up of every object and open upload under the test workspace

Re-run the one-line probe first. A browser PUT from `http://localhost:3000` should succeed.
