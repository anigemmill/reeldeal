import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from "jose";
import type { Db } from "../db/types";
import { AppError } from "../errors";
import { SCOPES, type MemberRole, type Principal, type Scope } from "./principal";

/*
  OAuth 2.1 bearer tokens for remote MCP (MCP authorization spec). The MCP server is
  the resource server; the authorization server is Supabase Auth (its OAuth 2.1
  server). We verify the JWT signature against the issuer's JWKS, the issuer, expiry
  and the audience (RFC 8707: must be this MCP endpoint), then resolve the user's
  organisation from memberships in the database, never from the token alone.
*/
export type OAuthConfig = { issuer: string; jwks: JWTVerifyGetKey; audience: string };

const jwksCache = new Map<string, JWTVerifyGetKey>();
export function remoteJwks(url: string): JWTVerifyGetKey {
  if (!jwksCache.has(url)) jwksCache.set(url, createRemoteJWKSet(new URL(url), { cooldownDuration: 30_000 }));
  return jwksCache.get(url)!;
}

export async function verifyOAuthToken(db: Db, token: string, cfg: OAuthConfig, requestedOrg?: string | null): Promise<Principal> {
  let payload;
  try {
    ({ payload } = await jwtVerify(token, cfg.jwks, { issuer: cfg.issuer, audience: cfg.audience, algorithms: ["RS256", "ES256"] }));
  } catch {
    throw new AppError("unauthenticated", "Invalid or expired access token");
  }
  const userId = typeof payload.sub === "string" ? payload.sub : null;
  if (!userId || !/^[0-9a-f-]{36}$/i.test(userId)) throw new AppError("unauthenticated", "Invalid or expired access token");

  const memberships = await db.asUser(userId, (sql) =>
    sql.query<{ org_id: string; role: MemberRole }>("select org_id, role from public.memberships where user_id = $1 order by created_at", [userId]),
  );
  if (memberships.length === 0) throw new AppError("forbidden", "This account is not a member of any workspace");
  let chosen = memberships[0];
  if (requestedOrg) {
    const match = memberships.find((m) => m.org_id === requestedOrg);
    if (!match) throw new AppError("forbidden", "You are not a member of that workspace");
    chosen = match;
  } else if (memberships.length > 1) {
    throw new AppError("invalid_input", "You belong to several workspaces. Send the X-Reeldeal-Organisation header with the workspace id.", {
      organisations: memberships.map((m) => m.org_id),
    });
  }
  const granted = String(payload.scope ?? "")
    .split(" ")
    .filter((s): s is Scope => (SCOPES as readonly string[]).includes(s));
  return {
    userId,
    orgId: chosen.org_id,
    role: chosen.role,
    scopes: granted.length ? granted : ["mcp:read"],
    via: "oauth",
    clientId: typeof payload.client_id === "string" ? payload.client_id : undefined,
  };
}
