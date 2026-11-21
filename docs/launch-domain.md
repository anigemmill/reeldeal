# Going live at theoutsidein.nz/reeldeal

Status at 2026-11-21: **the Reeldeal code is ready; nothing in Vercel, DNS or the main site has
changed.** Every step below needs the owner's go-ahead.

## How it fits together

```
visitor ──> www.theoutsidein.nz/reeldeal/...      (main site: Vercel project tourism-ai-growth-platform)
                 │  rewrite /reeldeal/*
                 ▼
            reeldeal.theoutsidein.nz/reeldeal/... (Reeldeal: Vercel project reeldeal, basePath /reeldeal)
```

The visitor only ever sees `www.theoutsidein.nz/reeldeal`. This is Vercel's standard "multi-zone"
set-up: two projects behind one domain.

What exists today (read-only check, 2026-11-21):

| Thing | Where |
|---|---|
| `www.theoutsidein.nz` (apex redirects to www) and `app.theoutsidein.nz` | Vercel project `tourism-ai-growth-platform`, team ANI |
| Reeldeal | Vercel project `reeldeal`, only on `reeldeal-three.vercel.app`, with Vercel Authentication on everything except custom domains |
| DNS for theoutsidein.nz | Freeparking (`ns.freeparking.co.nz`), part of Crazy Domains |

## Why Reeldeal needs its own subdomain

The main site has to forward requests to an address that answers without a Vercel login.
`reeldeal-three.vercel.app` is behind Vercel Authentication, so forwarding there would show a login
page. A custom domain on the `reeldeal` project is not behind that protection, so the main site
forwards to `reeldeal.theoutsidein.nz` instead. (`app.theoutsidein.nz` is already used by the main
site.)

## Steps

1. **DNS (owner, Crazy Domains / Freeparking):** add a CNAME record
   `reeldeal` → `cname.vercel-dns.com`.
2. **Vercel, project `reeldeal`:**
   - add the domain `reeldeal.theoutsidein.nz`
   - Production environment variables:
     - `NEXT_PUBLIC_BASE_PATH=/reeldeal`
     - `NEXT_PUBLIC_SITE_URL=https://www.theoutsidein.nz/reeldeal`
   - redeploy production.
3. **Main site, project `tourism-ai-growth-platform`:** add to its `next.config` (or the equivalent
   Vercel rewrites):

   ```ts
   async rewrites() {
     return [
       { source: "/reeldeal", destination: "https://reeldeal.theoutsidein.nz/reeldeal" },
       { source: "/reeldeal/:path*", destination: "https://reeldeal.theoutsidein.nz/reeldeal/:path*" },
     ];
   }
   ```

   and to its `robots.txt`: `Sitemap: https://www.theoutsidein.nz/reeldeal/sitemap.xml`, plus the
   `Disallow` lines Reeldeal's own `/reeldeal/robots.txt` lists (crawlers only read the domain's root
   robots file).
4. **Supabase Auth:** Site URL `https://www.theoutsidein.nz/reeldeal`; redirect URL
   `https://www.theoutsidein.nz/reeldeal/auth/callback`.
5. **R2 CORS:** add the origin `https://www.theoutsidein.nz` (separate approval, as for localhost).
6. **Check:** every website page, sign-up, the email link, sign-in, an upload and a download, all at
   `www.theoutsidein.nz/reeldeal`.

## What changed in the code

- `NEXT_PUBLIC_BASE_PATH` (validated: `/reeldeal`, leading slash, no trailing slash) sets Next.js's
  `basePath`. Unset locally and in tests, so nothing else changes there.
- Hand-built URLs use `withBasePath()` (`src/lib/base-path.ts`): the sign-in guard in
  `src/proxy.ts`, the email-link callback, the MCP resource URL, and `<img>` sources for files in
  `/public`. `<Link>`, `redirect()` and the router add the base path by themselves.
- `siteUrl()` includes the base path, so email links, the sitemap and page metadata are correct.
- Form posts (server actions) are allowed from the host in `NEXT_PUBLIC_SITE_URL`, because they
  arrive through the main site.
- Verified locally under `/reeldeal`: 11 website and auth pages load with no failed requests, every
  internal link keeps the prefix, redirects (`/dashboard`, `/login`, `/signup`) keep it, and the
  production build passes.

## Things to know

- Reeldeal also answers at `reeldeal.theoutsidein.nz/reeldeal`. Search engines are pointed at the
  www address by the sitemap and page metadata.
- Cookies are shared on `www.theoutsidein.nz` with the main site. Names don't collide (Reeldeal's
  are `sb-<project>-…` and `rd_…`), but anything the main site sets on `/` is also sent to Reeldeal.
