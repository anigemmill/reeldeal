/*
  Environment flags. Phase 1 only needs the review flag; the Zod-checked
  environment module (server secrets, Supabase, R2) replaces this file later in Phase 1.
*/

/**
 * Design review pages, and the app routes until auth exists, are available in
 * development and hidden in production unless REELDEAL_DESIGN_REVIEW=1.
 */
export const designReviewEnabled =
  process.env.NODE_ENV !== "production" || process.env.REELDEAL_DESIGN_REVIEW === "1";
