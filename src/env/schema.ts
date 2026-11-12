import { z } from "zod";

/*
  Environment variables, validated with Zod. One place for every variable the
  app reads (enforced by scripts/check-secrets.ts).

  - Public variables (NEXT_PUBLIC_*) are inlined into browser code by Next.js,
    so they must never hold secrets.
  - Server variables are only importable from server code (src/env/server.ts
    imports "server-only", so a client import fails the build).

  Phase 1 uses none of the integration variables yet; each group is optional,
  but all-or-nothing, so a half-configured integration fails loudly.
*/

const optionalUrl = z.string().url().optional();
const optionalString = z.string().min(1).optional();

export const publicSchema = z
  .object({
    NEXT_PUBLIC_SITE_URL: optionalUrl,
    NEXT_PUBLIC_SUPABASE_URL: optionalUrl,
    /** Supabase anon key: public by design; Row Level Security protects data. */
    NEXT_PUBLIC_SUPABASE_ANON_KEY: optionalString,
  })
  .superRefine((env, ctx) => {
    if (Boolean(env.NEXT_PUBLIC_SUPABASE_URL) !== Boolean(env.NEXT_PUBLIC_SUPABASE_ANON_KEY)) {
      ctx.addIssue({ code: "custom", path: ["NEXT_PUBLIC_SUPABASE_URL"], message: "Set both NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY, or neither" });
    }
  });

const R2_KEYS = ["R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET"] as const;

export const serverSchema = z
  .object({
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
    /** "1" shows /design-system and the sample-data app routes in production. */
    REELDEAL_DESIGN_REVIEW: z.enum(["0", "1"]).optional(),
    /** Bypasses Row Level Security. Server-side jobs only; never in browser code. */
    SUPABASE_SERVICE_ROLE_KEY: optionalString,
    R2_ACCOUNT_ID: optionalString,
    R2_ACCESS_KEY_ID: optionalString,
    R2_SECRET_ACCESS_KEY: optionalString,
    /** Private bucket: no public access; files are served through signed URLs only. */
    R2_BUCKET: optionalString,
    /** Lifetime of signed upload/download URLs. Keep short. */
    R2_SIGNED_URL_TTL_SECONDS: z.coerce.number().int().min(30).max(3600).default(300),
  })
  .superRefine((env, ctx) => {
    const set = R2_KEYS.filter((k) => env[k]);
    if (set.length > 0 && set.length < R2_KEYS.length) {
      ctx.addIssue({ code: "custom", path: [R2_KEYS.find((k) => !env[k])!], message: `R2 is partly configured: set all of ${R2_KEYS.join(", ")}, or none` });
    }
  });

export type PublicEnv = z.infer<typeof publicSchema>;
export type ServerEnv = z.infer<typeof serverSchema>;

export function formatEnvIssues(error: z.ZodError): string {
  return error.issues.map((i) => `  • ${i.path.join(".") || "(env)"}: ${i.message}`).join("\n");
}
