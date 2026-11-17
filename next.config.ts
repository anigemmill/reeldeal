import type { NextConfig } from "next";

/*
  Baseline security headers (docs/architecture/security.md).
  CSP note: 'unsafe-inline' scripts are needed for Next.js's inline bootstrap
  and the no-flash theme script while pages are statically rendered. A
  nonce-based CSP requires dynamic rendering; revisit when auth lands (Phase 3).
  Supabase and R2 origins are added to connect-src / img-src / media-src then.
*/
const isDev = process.env.NODE_ENV !== "production";

// Browsers upload to and play from private storage through signed URLs, so its origin
// must be allowed (R2 by default, or R2_ENDPOINT for a jurisdiction or the local stack).
const storageOrigin = (() => {
  const raw = process.env.R2_ENDPOINT || (process.env.R2_ACCOUNT_ID ? `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com` : "");
  try {
    return raw ? new URL(raw).origin : "";
  } catch {
    return "";
  }
})();
const storage = storageOrigin ? ` ${storageOrigin}` : "";

const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob:${storage}`,
  `media-src 'self' blob:${storage}`,
  "font-src 'self'",
  `connect-src 'self'${storage}${isDev ? " ws:" : ""}`,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  ...(isDev ? [] : ["upgrade-insecure-requests"]),
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  ...(isDev ? [] : [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" }]),
];

const nextConfig: NextConfig = {
  // The development server logs server-action arguments. Some carry one-time secrets (invitation
  // tokens), so they must never be written to a terminal or a log file. Production doesn't log them.
  logging: { serverFunctions: false },
  cacheComponents: true,
  experimental: { globalNotFound: true },
  partialPrefetching: true,
  poweredByHeader: false,
  // Server-only packages loaded at runtime rather than bundled (database drivers, WASM).
  serverExternalPackages: ["@electric-sql/pglite", "postgres"],
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  // The website links to /login and /signup (docs/sitemap.md); the auth pages live at /sign-in and /sign-up.
  async redirects() {
    return [
      { source: "/login", destination: "/sign-in", permanent: false },
      { source: "/signup", destination: "/sign-up", permanent: false },
    ];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
