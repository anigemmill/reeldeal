/*
  Feature flags readable anywhere, including src/proxy.ts. Kept separate from
  server.ts because the proxy must not import "server-only" code paths.
*/

/**
 * Design review pages, and the app routes until auth exists, are available in
 * development and hidden in production unless REELDEAL_DESIGN_REVIEW=1.
 */
export const designReviewEnabled = process.env.NODE_ENV !== "production" || process.env.REELDEAL_DESIGN_REVIEW === "1";
