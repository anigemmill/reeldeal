import { createHash, randomBytes } from "node:crypto";
import type { Db } from "../db/types";
import { AppError } from "../errors";
import { SCOPES, type MemberRole, type Principal, type Scope } from "./principal";

/*
  Personal access tokens (PATs) for MCP clients during development and the
  private pilot. Format: rdl_pat_<43 url-safe chars> (256 bits). Only the SHA-256
  hash is stored; the token is shown once at creation. A token is bound to one
  user and one organisation, carries scopes, can expire and can be revoked.
*/
const PREFIX = "rdl_pat_";
const FORMAT = /^rdl_pat_[A-Za-z0-9_-]{43}$/;

export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");
export const looksLikePat = (token: string) => token.startsWith(PREFIX);

export async function createAccessToken(
  db: Db,
  input: { userId: string; orgId: string; name: string; scopes?: Scope[]; expiresInDays?: number },
): Promise<{ token: string; id: string; prefix: string; expiresAt: Date | null }> {
  const token = PREFIX + randomBytes(32).toString("base64url");
  const scopes = input.scopes ?? ["mcp:read", "mcp:write"];
  if (scopes.some((s) => !SCOPES.includes(s))) throw new AppError("invalid_input", "Unknown scope");
  const expiresAt = input.expiresInDays ? new Date(Date.now() + input.expiresInDays * 86400_000) : null;
  const [row] = await db.system((sql) =>
    sql.query<{ id: string }>(
      "insert into public.api_tokens (user_id, org_id, name, token_prefix, token_hash, scopes, expires_at) values ($1, $2, $3, $4, $5, $6, $7) returning id",
      [input.userId, input.orgId, input.name, token.slice(0, 12), hashToken(token), scopes, expiresAt],
    ),
  );
  return { token, id: row.id, prefix: token.slice(0, 12), expiresAt };
}

/** Verify a PAT. Returns the principal or throws unauthenticated (one generic message for every failure). */
export async function verifyAccessToken(db: Db, token: string): Promise<Principal> {
  const fail = () => new AppError("unauthenticated", "Invalid or expired access token");
  if (!FORMAT.test(token)) throw fail();
  const rows = await db.system((sql) =>
    sql.query<{ id: string; user_id: string; org_id: string; scopes: Scope[]; role: MemberRole; last_used_at: Date | null }>(
      `select t.id, t.user_id, t.org_id, t.scopes, m.role, t.last_used_at
         from public.api_tokens t
         join public.memberships m on m.org_id = t.org_id and m.user_id = t.user_id
        where t.token_hash = $1 and t.revoked_at is null and (t.expires_at is null or t.expires_at > now())`,
      [hashToken(token)],
    ),
  );
  const row = rows[0];
  if (!row) throw fail();
  if (!row.last_used_at || Date.now() - new Date(row.last_used_at).getTime() > 60_000) {
    await db.system((sql) => sql.query("update public.api_tokens set last_used_at = now() where id = $1", [row.id]));
  }
  return { userId: row.user_id, orgId: row.org_id, role: row.role, scopes: row.scopes, via: "pat", tokenId: row.id };
}

export async function revokeAccessToken(db: Db, tokenId: string) {
  await db.system((sql) => sql.query("update public.api_tokens set revoked_at = now() where id = $1 and revoked_at is null", [tokenId]));
}
