# Security architecture

Status: **designed in Phase 1, implemented in Phase 3** (auth, database, storage). The Phase 1 foundation
(environment handling, headers, secret checks) is already in the code and is marked ✅ below.

Principles: deny by default, isolate every customer organisation, keep secrets on the server, give the browser
only short-lived, narrowly scoped access to media.

## 1. Tenancy model

- An **organisation** (workspace) is the tenant. A user can belong to several organisations through
  **memberships** with a role: `owner`, `admin`, `editor`, `viewer`.
- Every table that holds customer data has a non-null `org_id` referencing `organisations.id`.
  This includes brand profiles, media, media analysis, projects, timelines, versions, render jobs, exports,
  comments and usage records.
- Per-user data (profile, theme preferences) is keyed by `user_id = auth.uid()`.
- The active organisation is chosen in the app, but **never trusted from the client**: every query is filtered by
  Row Level Security using the signed-in user's memberships.

## 2. Supabase Row Level Security

RLS is enabled on **every** table in the `public` schema, with no permissive default. A table without policies
returns nothing. A CI check (Phase 3) fails if any public table has RLS disabled.

```sql
-- Membership lookup used by every policy. SECURITY DEFINER so it can read memberships
-- without granting users direct access to them; search_path pinned against hijacking.
create function public.is_org_member(target_org uuid, min_role text default 'viewer')
returns boolean
language sql stable security definer set search_path = public, pg_temp
as $$
  select exists (
    select 1 from memberships m
    where m.org_id = target_org
      and m.user_id = auth.uid()
      and m.role_rank >= role_rank(min_role)
  );
$$;
revoke all on function public.is_org_member(uuid, text) from public;
grant execute on function public.is_org_member(uuid, text) to authenticated;

alter table media enable row level security;

create policy "members read media" on media
  for select to authenticated using (is_org_member(org_id));
create policy "editors add media" on media
  for insert to authenticated with check (is_org_member(org_id, 'editor'));
create policy "editors change media" on media
  for update to authenticated using (is_org_member(org_id, 'editor')) with check (is_org_member(org_id, 'editor'));
create policy "admins delete media" on media
  for delete to authenticated using (is_org_member(org_id, 'admin'));

-- Per-user preferences (the Appearance screen's saved theme).
create table user_preferences (
  user_id uuid primary key references auth.users on delete cascade,
  palette text not null default 'crossroads',
  mode text not null default 'workspace',
  type text not null default 'a',
  updated_at timestamptz not null default now()
);
alter table user_preferences enable row level security;
create policy "own preferences" on user_preferences
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
```

Rules that go with it:

- `with check` on every insert and update policy, so a user cannot move a row into another organisation by
  changing `org_id`.
- Views use `security_invoker = true` so they respect the caller's RLS.
- The **service role key bypasses RLS**. It is used only by server-side jobs (processing pipeline, render
  workers, webhooks) and never reaches the browser. Jobs still scope every query by `org_id` explicitly.
- Usage and credit records are written only by the server (render success, analysis completion), never by
  client inserts, so users cannot grant themselves credits.

### Isolation tests (Phase 3, required before launch)

Two test organisations (A and B) with users in each. For every table and every operation: a user in A
reads, inserts, updates and deletes nothing in B, including by guessing ids and by changing `org_id` on
update. Storage signing is tested the same way. These run in CI against a local Supabase.

## 3. Media storage: private Cloudflare R2

- **One private bucket.** No public access, no public bucket URL, no custom domain serving raw objects.
- **Object keys** are namespaced by tenant: `org/{org_id}/media/{media_id}/{variant}`
  (variants: `original`, `proxy`, `poster`, `thumb`, `render/{job_id}`).
- **Uploads**: the browser asks the app server for an upload URL. The server checks
  `is_org_member(org_id, 'editor')`, creates the media record, then returns a **presigned PUT URL** for that exact
  key with a short lifetime (`R2_SIGNED_URL_TTL_SECONDS`, default 300s), an allowed content type and a maximum
  size. Large files use multipart uploads, each part signed the same way. The client never chooses the key.
- **Playback and downloads**: the server checks membership, then returns a **presigned GET URL** for one object
  with a short lifetime. URLs are never stored in the database or cached publicly; they are minted on demand.
- **Credentials**: `R2_ACCESS_KEY_ID` and `R2_SECRET_ACCESS_KEY` are server-only, scoped by an R2 API token to
  this one bucket with object read/write only (no bucket admin).
- Processing workers read and write with their own scoped credentials. Temporary proxies and intermediate
  renders are excluded from storage billing (`config/pricing.json`, `storageExclusions`) and cleaned up by
  lifecycle rules.
- The CSP gains the R2 endpoint in `img-src`, `media-src` and `connect-src` (uploads) when this lands.

## 4. Environment variables and secrets ✅

- All variables are declared and validated with Zod in `src/env/schema.ts`. Integration groups are
  all-or-nothing (Supabase URL plus anon key; all four R2 values), so a half-configured integration fails.
- `npm run validate:env` runs before every build (`prebuild`); an invalid environment stops the build.
- **Public** values (`NEXT_PUBLIC_*`) are read only in `src/env/public.ts`. The Supabase anon key is public by
  design; RLS is what protects data.
- **Server** values are read only in `src/env/server.ts`, which imports `server-only`, so importing it from browser
  code fails the build.
- `npm run check:secrets` fails if credentials appear in tracked files, or if code reads `process.env` outside
  `src/env/`, `next.config.ts` and `scripts/`.
- `.env*` files are git-ignored; `.env.example` documents every variable with no values. Production secrets live
  in the hosting provider's secret store.

## 5. HTTP security headers ✅

Set for every route in `next.config.ts`: Content-Security-Policy, `X-Content-Type-Options: nosniff`,
`X-Frame-Options: DENY` (and `frame-ancestors 'none'`), `Referrer-Policy: strict-origin-when-cross-origin`, a
restrictive `Permissions-Policy`, `Cross-Origin-Opener-Policy: same-origin`, and HSTS in production. The
`X-Powered-By` header is off.

CSP currently allows inline scripts, which Next.js needs for its inline bootstrap and the no-flash theme script
on statically rendered pages. When auth lands and app pages render per request, move to a nonce-based CSP.

## 6. Hidden routes until auth ✅

`src/proxy.ts` returns 404 for `/design-system` and the app routes in production unless
`REELDEAL_DESIGN_REVIEW=1`. The app routes only show labelled sample data in Phase 1. In Phase 3 the proxy
becomes the auth gate (session check and redirect to sign in), and the review flag stays for `/design-system`.

## 7. Phase 3 checklist

- [ ] Supabase project, auth providers, `organisations`, `memberships`, `user_preferences` with RLS and the
      helper function above
- [ ] RLS enabled check in CI; two-organisation isolation tests in CI
- [ ] R2 bucket (private), scoped API token, presigned PUT/GET endpoints with membership checks, lifecycle rules
- [ ] Proxy auth gate; nonce-based CSP; R2 and Supabase origins in CSP
- [ ] Theme preference saved to `user_preferences` (Appearance screen), cookie kept as a cache
- [ ] Server-only credit and usage writes; audit log for role changes and exports
