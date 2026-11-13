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

    /* ---- Platform services (MCP server, workers, API routes) ---- */
    /** Postgres connection (Supabase: the pooler URL). Without it, local tools use embedded PGlite. */
    DATABASE_URL: z.string().regex(/^postgres(ql)?:\/\//, "must be a postgres:// URL").optional(),
    /** Embedded database directory for local development without DATABASE_URL. */
    PGLITE_DIR: z.string().min(1).default(".data/pglite"),
    /** OAuth 2.1 access tokens (Supabase Auth) for remote MCP: issuer and JWKS. */
    SUPABASE_JWT_ISSUER: optionalUrl,
    SUPABASE_JWKS_URL: optionalUrl,
    /** Public URL of the remote MCP endpoint; also its OAuth resource identifier (RFC 8707). */
    MCP_PUBLIC_URL: optionalUrl,
    /** Comma-separated browser origins allowed to call the remote MCP endpoint (DNS-rebinding protection). */
    MCP_ALLOWED_ORIGINS: optionalString,
    /** Personal access token the local STDIO server authenticates with. Set in the MCP client config, never committed. */
    REELDEAL_MCP_TOKEN: optionalString,
    MCP_HTTP_PORT: z.coerce.number().int().min(1).max(65535).default(3333),
    MCP_LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
    /** HMAC secret for credit quotes and local signed URLs. Required in production. */
    SIGNING_SECRET: z.string().min(32, "use at least 32 random characters").optional(),
    /** OpenAI (customer-facing AI provider). Without a key, AI tools report that AI is not configured. */
    OPENAI_API_KEY: optionalString,
    OPENAI_BASE_URL: optionalUrl,
    OPENAI_MODEL: z.string().min(1).default("gpt-4.1-mini"),
    OPENAI_TIMEOUT_MS: z.coerce.number().int().min(1000).max(120000).default(45000),
    /** Media storage: "r2" (production) or "local" (development files under LOCAL_STORAGE_DIR). */
    STORAGE_DRIVER: z.enum(["local", "r2"]).optional(),
    LOCAL_STORAGE_DIR: z.string().min(1).default(".data/storage"),
    /** Base URL that serves signed local media links (the dev MCP HTTP server). */
    LOCAL_MEDIA_BASE_URL: optionalUrl,
    FFMPEG_PATH: z.string().min(1).default("ffmpeg"),
    FFPROBE_PATH: z.string().min(1).default("ffprobe"),
  })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV === "production" && env.DATABASE_URL && !env.SIGNING_SECRET) {
      ctx.addIssue({ code: "custom", path: ["SIGNING_SECRET"], message: "Required in production when the platform database is configured" });
    }
    if (env.STORAGE_DRIVER === "r2" && !env.R2_BUCKET) {
      ctx.addIssue({ code: "custom", path: ["STORAGE_DRIVER"], message: "STORAGE_DRIVER=r2 needs the R2_* variables" });
    }
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
