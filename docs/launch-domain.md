# Going live at theoutsidein.nz/reeldeal

Status at 2026-11-21: **the Reeldeal code is ready (on branch `claude/eloquent-bohr-5zzwa2`, not yet on
`main`). Vercel: domain and production variables added (owner approved). DNS and the main site are
unchanged.**

**Correction (2026-11-21):** the live main site is on **Netlify**, not Vercel. `theoutsidein.nz` (apex,
75.2.60.5) is served by Netlify and `www` redirects to it. Only `app.theoutsidein.nz` points at the
Vercel project `tourism-ai-growth-platform`. So the public address is **theoutsidein.nz/reeldeal** and
the forwarding rule goes on the Netlify site.

## How it fits together

```
visitor ──> theoutsidein.nz/reeldeal/...          (main site: Netlify)
                 │  proxy rewrite /reeldeal/*
                 ▼
            reeldeal.theoutsidein.nz/reeldeal/... (Reeldeal: Vercel project reeldeal, basePath /reeldeal)
```

The visitor only ever sees `theoutsidein.nz/reeldeal`.

What exists today (read-only check, 2026-11-21):

| Thing | Where |
|---|---|
| `theoutsidein.nz` (live site; `www` redirects to it) | Netlify (`outsideinnz.netlify.app`) |
| `app.theoutsidein.nz` | Vercel project `tourism-ai-growth-platform`, team ANI |
| Reeldeal | Vercel project `reeldeal`, on `reeldeal-three.vercel.app` and now `reeldeal.theoutsidein.nz`, with Vercel Authentication on everything except custom domains. **No production deployment yet** (every build so far is a branch preview) |
| DNS for theoutsidein.nz | Freeparking (`ns.freeparking.co.nz`), part of Crazy Domains |

## Why Reeldeal needs its own subdomain

The main site has to forward requests to an address that answers without a Vercel login.
`reeldeal-three.vercel.app` is behind Vercel Authentication, so forwarding there would show a login
page. A custom domain on the `reeldeal` project is not behind that protection, so the main site
forwards to `reeldeal.theoutsidein.nz` instead. (`app.theoutsidein.nz` is already used by the main
site.)

## Steps

1. **DNS (owner, Crazy Domains / Freeparking):** add a CNAME record
   `reeldeal` → `cname.vercel-dns.com`. (Vercel also offers the project-specific
   `626fb0dbf86fea55.vercel-dns-016.com`; either works.)
2. **Vercel, project `reeldeal`: done 2026-11-21.**
   - domain `reeldeal.theoutsidein.nz` added
   - Production variables: `NEXT_PUBLIC_BASE_PATH=/reeldeal`,
     `NEXT_PUBLIC_SITE_URL=https://theoutsidein.nz/reeldeal`
3. **Production deployment:** merge the branch into `main` (production builds from `main`), then
   check the deployment at `reeldeal.theoutsidein.nz/reeldeal`.
4. **Main site on Netlify:** add a proxy rule. In `public/_redirects` (or the publish folder):

   ```
   /reeldeal    https://reeldeal.theoutsidein.nz/reeldeal          200!
   /reeldeal/*  https://reeldeal.theoutsidein.nz/reeldeal/:splat   200!
   ```

   or in `netlify.toml`:

   ```toml
   [[redirects]]
   from = "/reeldeal/*"
   to = "https://reeldeal.theoutsidein.nz/reeldeal/:splat"
   status = 200
   force = true
   ```

   (plus the same block for `/reeldeal` on its own). Put them above any catch-all rule such as
   `/* /index.html 200`. Also add to the main site's `robots.txt`:
   `Sitemap: https://theoutsidein.nz/reeldeal/sitemap.xml`, plus the `Disallow` lines Reeldeal's own
   `/reeldeal/robots.txt` lists (crawlers only read the domain's root robots file).
5. **When the app opens to customers:** Supabase Auth Site URL `https://theoutsidein.nz/reeldeal`;
   redirect URL `https://theoutsidein.nz/reeldeal/auth/callback`. R2 CORS origin
   `https://theoutsidein.nz` (separate approval).
6. **Check:** every website page at `theoutsidein.nz/reeldeal`; later sign-up, the email link,
   sign-in, an upload and a download.

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

- Reeldeal also answers at `reeldeal.theoutsidein.nz/reeldeal`. Search engines are pointed at
  `theoutsidein.nz/reeldeal` by the sitemap and page metadata.
- Cookies are shared on `theoutsidein.nz` with the main site. Names don't collide (Reeldeal's
  are `sb-<project>-…` and `rd_…`), but anything the main site sets on `/` is also sent to Reeldeal.
