import { AppError, forbidden } from "../errors";

export type MemberRole = "viewer" | "editor" | "admin" | "owner";
export const SCOPES = ["mcp:read", "mcp:write", "mcp:render"] as const;
export type Scope = (typeof SCOPES)[number];

/**
 * Who is calling, established from trusted authentication data only (a verified
 * token), never from tool arguments. orgId is the organisation the token is bound
 * to (personal access tokens) or the verified membership chosen for the request (OAuth).
 */
export type Principal = {
  userId: string;
  orgId: string;
  role: MemberRole;
  scopes: Scope[];
  via: "pat" | "oauth";
  tokenId?: string;
  clientId?: string;
};

const RANK: Record<MemberRole, number> = { viewer: 1, editor: 2, admin: 3, owner: 4 };

export function requireScope(p: Principal, scope: Scope) {
  if (!p.scopes.includes(scope)) {
    throw new AppError("forbidden", `This connection is not allowed to do that (needs the ${scope} scope). Create a token with that scope.`);
  }
}

export function requireRole(p: Principal, min: MemberRole) {
  if (RANK[p.role] < RANK[min]) throw forbidden(`Your role (${p.role}) cannot do that; ${min} or above is required.`);
}

export function permissionsFor(p: Principal) {
  const canWrite = p.scopes.includes("mcp:write") && RANK[p.role] >= RANK.editor;
  return {
    role: p.role,
    scopes: p.scopes,
    can_read: p.scopes.includes("mcp:read"),
    can_create_and_edit: canWrite,
    can_start_renders: canWrite && p.scopes.includes("mcp:render"),
    can_manage_workspace: RANK[p.role] >= RANK.admin,
  };
}
