# Going live at theoutsidein.nz/reeldeal

Status at 2026-11-22: **the website is live at https://theoutsidein.nz/reeldeal** (DNS CNAME, the
Netlify proxy in `anigemmill/outside-in-website` and the production deployment from `main` are all in
place; both addresses answer 200). **Sign-in is not open yet:** see "Opening sign-in" below.

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

## Opening sign-in (checked 2026-11-22, read-only)

What is already true:

| Thing | State |
|---|---|
| Supabase project `jzshbaqfrrgsyiciuzfe` (`reeldeal`, Sydney, Postgres 17) | Healthy. The connector reaches it again |
| Migrations | All 10 in the repo are applied (both trackers agree), through `20261119000001_credit_rollover` |
| Tables | 22 in `public`, RLS on every one, 0 rows, 0 `anon` grants, 0 auth users |
| Security advisor | One INFO: `reeldeal_meta.migrations` has RLS on and no policies. Intended (no client should read it) |
| Runtime roles `reeldeal_web`, `reeldeal_worker` | Exist, **cannot log in yet** (no password set) |
| Vercel production variables | Only `NEXT_PUBLIC_BASE_PATH` and `NEXT_PUBLIC_SITE_URL`. **No Supabase URL or key, no `DATABASE_URL`, no `SIGNING_SECRET`**, so the sign-in pages can't reach Supabase in production |
| Email | Nothing connected (`docs/email-resend.md`). Root domain mail is Google Workspace (MX `aspmx.l.google.com`) |

Order (each step needs the owner, or the owner's go-ahead for me to do it). **Steps 1–3 done 2026-11-22; steps 4–5 done 2026-11-23** (`reeldeal_web` can log in; production has `DATABASE_URL` and `SIGNING_SECRET` as sensitive variables, plus the Supabase URL and publishable key). Remaining: step 6.

1. **Resend** (owner): create the account, add the domain `mail.theoutsidein.nz` in the
   Asia-Pacific region, create the production API key (sending only). Values: `docs/email-resend.md` §3.
2. **DNS at Freeparking** (owner): add the four records Resend shows (§4). Additions only.
3. **Supabase Auth** (dashboard, owner, or me with a short-lived access token):
   - URL Configuration: Site URL `https://theoutsidein.nz/reeldeal`; Redirect URLs
     `https://theoutsidein.nz/reeldeal/auth/callback`
   - SMTP, templates, email settings and rate limits as in `docs/email-resend.md` §6. The templates
     build links from `{{ .SiteURL }}`, so they already include `/reeldeal`.
4. **Database login for the app** (owner, SQL editor; the password never goes in chat or git):
   `alter role reeldeal_web with login password '…';`
   Production `DATABASE_URL` is then the transaction pooler (port 6543) with user
   `reeldeal_web.jzshbaqfrrgsyiciuzfe`, saved in Vercel as a **sensitive** variable.
5. **Vercel production variables** (I can add these on approval):
   - `NEXT_PUBLIC_SUPABASE_URL=https://jzshbaqfrrgsyiciuzfe.supabase.co`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = the project's publishable key (public by design)
   - `SIGNING_SECRET`: 32+ random characters, generated straight into Vercel as sensitive, never shown
   - `DATABASE_URL` from step 4 (owner pastes it into Vercel)

   Add these only after steps 1–3: before that, a visit to `/reeldeal/sign-up` would send
   confirmation emails through Supabase's built-in mailer with the wrong link address.
6. **Test with addresses you own** (`docs/auth.md`, "Live test plan"), then flip
   `SIGN_UP_OPEN = true` in `src/content/site.ts` and redeploy.

Notes from 2026-11-23:

- Vercel runs Reeldeal's functions in `iad1` (Washington, US) while the database is in Sydney, so every
  database call crosses the Pacific. Setting the project's Function Region to `syd1` (Settings →
  Functions) would cut that latency. Not changed yet: owner's call.
- Findable's Vercel project (`tourism-ai-growth-platform`) has its own `DATABASE_URL`. Check the project
  name at the top of the page before adding variables.
