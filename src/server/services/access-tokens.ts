import { z } from "zod";
import { createAccessToken, currentTokenEnvironment, MAX_ACTIVE_TOKENS } from "../auth/tokens";
import { SCOPES, type Scope } from "../auth/principal";
import { asUser, iso, type Ctx } from "../context";
import { AppError, invalid, parseInput } from "../errors";

/*
  Settings → Access tokens (D6; screen: src/components/app/settings/tokens-screen.tsx).
  A person manages only their own tokens for the current workspace:
    - scopes are limited by role: viewers get read only; create/edit and render need Editor+
      (a token never does more than its owner's role, and verifyAccessToken re-reads the role
      on every call, so a later demotion applies immediately)
    - expiry is required: 7, 30, 90 or 365 days
    - the token is returned once; only its SHA-256 and first 12 characters are stored
    - bound to this workspace and to this server's environment (development / production)
  Public remote MCP stays off until OAuth is complete: these tokens work with the local
  STDIO connector (and the dev HTTP endpoint, which production builds refuse).
*/
export const TOKEN_EXPIRY_DAYS = [7, 30, 90, 365] as const;
const CreateInput = z.object({
  name: z.string().trim().min(1, "Name the token").max(80),
  scopes: z.array(z.enum(SCOPES)).min(1),
  expires_in_days: z.union(TOKEN_EXPIRY_DAYS.map((n) => z.literal(n)) as unknown as [z.ZodLiteral<7>, z.ZodLiteral<30>, z.ZodLiteral<90>, z.ZodLiteral<365>]),
});

export type MyToken = { id: string; name: string; prefix: string; scopes: Scope[]; created_at: string | null; expires_at: string | null; last_used_at: string | null; revoked_at: string | null; environment: string; status: "active" | "expired" | "revoked" };

/** This person's tokens for the current workspace, newest first. Never includes the hash. */
export async function listMyTokens(ctx: Ctx): Promise<MyToken[]> {
  const rows = await asUser(ctx, (sql) =>
    sql.query<Omit<MyToken, "status" | "prefix"> & { token_prefix: string }>(
      `select id, name, token_prefix, scopes, created_at, expires_at, last_used_at, revoked_at, environment
         from public.api_tokens where user_id = $1 and org_id = $2 order by created_at desc limit 100`,
      [ctx.principal.userId, ctx.principal.orgId],
    ),
  );
  const now = Date.now();
  return rows.map(({ token_prefix, ...r }) => ({
    ...r,
    prefix: token_prefix,
    created_at: iso(r.created_at),
    expires_at: iso(r.expires_at),
    last_used_at: iso(r.last_used_at),
    revoked_at: iso(r.revoked_at),
    status: r.revoked_at ? "revoked" : r.expires_at && new Date(r.expires_at).getTime() <= now ? "expired" : "active",
  }));
}

/** Create a token for the signed-in person in the current workspace. The token is in the result once and nowhere else. */
export async function createMyToken(ctx: Ctx, raw: z.input<typeof CreateInput>) {
  if (ctx.principal.via !== "session") throw new AppError("forbidden", "Access tokens are created from the web app while signed in.");
  const i = parseInput(CreateInput, raw);
  const scopes = [...new Set<Scope>(["mcp:read", ...i.scopes])];
  // Role from the database, not the session's cached copy.
  const [m] = await asUser(ctx, (sql) => sql.query<{ role: string }>("select role from public.memberships where org_id = $1 and user_id = $2", [ctx.principal.orgId, ctx.principal.userId]));
  if (!m) throw new AppError("forbidden", "You're not a member of this workspace.");
  if (m.role === "viewer" && scopes.some((s) => s !== "mcp:read")) throw invalid("As a Viewer you can create read-only tokens.");
  const active = (await listMyTokens(ctx)).filter((t) => t.status === "active").length;
  if (active >= MAX_ACTIVE_TOKENS) throw new AppError("conflict", `You have ${active} active tokens. Revoke one you no longer use first.`);
  const t = await createAccessToken(ctx.db, { userId: ctx.principal.userId, orgId: ctx.principal.orgId, name: i.name, scopes, expiresInDays: i.expires_in_days });
  return { id: t.id, token: t.token, prefix: t.prefix, scopes, expires_at: t.expiresAt?.toISOString() ?? null, environment: currentTokenEnvironment() };
}

/** Revoke one of your own tokens (RLS: users can only update their own, and only revoked_at). */
export async function revokeMyToken(ctx: Ctx, tokenId: string) {
  const id = parseInput(z.uuid(), tokenId);
  const rows = await asUser(ctx, (sql) =>
    sql.query("update public.api_tokens set revoked_at = now() where id = $1 and user_id = $2 and org_id = $3 and revoked_at is null returning id", [id, ctx.principal.userId, ctx.principal.orgId]),
  );
  if (!rows.length) {
    const [exists] = await asUser(ctx, (sql) => sql.query("select 1 from public.api_tokens where id = $1 and user_id = $2 and org_id = $3", [id, ctx.principal.userId, ctx.principal.orgId]));
    if (!exists) throw new AppError("not_found", "Token not found");
  }
  return { revoked: true };
}
