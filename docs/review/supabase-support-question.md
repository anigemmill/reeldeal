# Question for Supabase support: client IP for Auth rate limits

**Status: drafted, not sent.** Send it from the Supabase account that owns the `reeldeal` project
(dashboard → Support), once that account is reconnected (`docs/supabase-reconnection.md`). It
contains no secrets or customer data. Add the project ref when sending.

---

**Subject:** Hosted Auth: forwarding the end-user IP from a server-side app (Sb-Forwarded-For)

Hello,

Our Next.js app calls Supabase Auth from its own server (server actions using `@supabase/ssr`):
sign-in with password, sign-up, password reset and resend confirmation. Because of this, Auth sees
our hosting provider's server IPs (Vercel), not our customers' IPs. The per-IP rate limits then
throttle all of our customers together, and can't tell one abusive client from another.

We already limit per client IP and per email address in our app before calling Auth. We'd like
Auth's own limits to work per end user as well.

1. Does hosted Supabase Auth support the `Sb-Forwarded-For` header (the
   `GOTRUE_SECURITY_SB_FORWARDED_FOR_ENABLED` setting in the Auth source)? If so, can it be
   enabled for our project, and how?
2. If it's enabled, which requests is it honoured on? Does it require the service-role or secret
   key, or is it accepted with the publishable key? We need to be sure a browser can't set it to
   spoof another IP.
3. If it isn't supported, what do you recommend for server-side apps? For example: raising the
   per-IP limits for sign-in and sign-up (and to what maximum), or another trusted header.
4. Is the rate limit for emails sent per project, or per IP? Will it apply once we use our own SMTP
   (Resend)?
5. Which Auth version is our project on, and is there a schedule for upgrades? We test against
   v2.180.0 locally.

Project ref: [REF]
Region: Sydney (ap-southeast-2)

Thank you.
