import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import { verifyOAuthToken, remoteJwks, type OAuthConfig } from "@/server/auth/oauth";
import { SCOPES, type Principal } from "@/server/auth/principal";
import { looksLikePat, verifyAccessToken } from "@/server/auth/tokens";
import type { Platform } from "@/server/context";
import { AppError } from "@/server/errors";
import { createMcpServer } from "./server";

/*
  Remote MCP over Streamable HTTP (MCP spec 2025-11-25), using web-standard
  Request/Response so it runs in a Next.js route handler on Vercel and in the
  standalone Node server alike.

  - Stateless: a fresh MCP server per request, JSON responses, no in-memory sessions,
    so any instance can serve any request and nothing long-lived runs in a function.
  - Every request needs a Bearer token: a personal access token (development/pilot)
    or an OAuth 2.1 access token from the authorization server (Supabase Auth).
  - Missing/invalid tokens get 401 with WWW-Authenticate pointing at the protected
    resource metadata (RFC 9728), as the MCP authorization spec requires.
  - Origin header checked against an allow-list (DNS-rebinding protection).
*/
export type HttpConfig = {
  /** Public URL of the MCP endpoint (resource identifier), e.g. https://app.example.com/api/mcp */
  resourceUrl: string;
  oauth?: { issuer: string; jwksUrl: string; audience?: string } | null;
  allowedOrigins?: string[];
  /** Personal access tokens accepted over HTTP (on for development and the private pilot). */
  allowPats?: boolean;
};

export function protectedResourceMetadata(cfg: HttpConfig) {
  return {
    resource: cfg.resourceUrl,
    authorization_servers: cfg.oauth ? [cfg.oauth.issuer] : [],
    scopes_supported: [...SCOPES],
    bearer_methods_supported: ["header"],
    resource_name: "Reeldeal video platform",
    resource_documentation: "https://github.com/anigemmill/reeldeal/blob/main/docs/mcp.md",
  };
}

export function metadataUrl(cfg: HttpConfig) {
  const u = new URL(cfg.resourceUrl);
  return `${u.origin}/.well-known/oauth-protected-resource${u.pathname === "/" ? "" : u.pathname}`;
}

function unauthorized(cfg: HttpConfig, error?: "invalid_token" | "insufficient_scope", description?: string) {
  const parts = [`resource_metadata="${metadataUrl(cfg)}"`, `scope="${SCOPES.join(" ")}"`];
  if (error) parts.push(`error="${error}"`, `error_description="${(description ?? "").replace(/"/g, "'")}"`);
  return new Response(JSON.stringify({ error: error ?? "unauthorized", error_description: description ?? "Authentication required" }), {
    status: 401,
    headers: { "content-type": "application/json", "www-authenticate": `Bearer ${parts.join(", ")}` },
  });
}

const jsonError = (status: number, message: string) => new Response(JSON.stringify({ error: message }), { status, headers: { "content-type": "application/json" } });

export async function authenticate(p: Platform, cfg: HttpConfig, req: Request): Promise<Principal> {
  const header = req.headers.get("authorization") ?? "";
  const m = header.match(/^Bearer\s+(.+)$/i);
  if (!m) throw new AppError("unauthenticated", "Authentication required");
  const token = m[1].trim();
  if (looksLikePat(token)) {
    if (cfg.allowPats === false) throw new AppError("unauthenticated", "Personal access tokens are not accepted on this endpoint");
    return verifyAccessToken(p.db, token);
  }
  if (!cfg.oauth) throw new AppError("unauthenticated", "Invalid or expired access token");
  const oauth: OAuthConfig = { issuer: cfg.oauth.issuer, jwks: remoteJwks(cfg.oauth.jwksUrl), audience: cfg.oauth.audience ?? cfg.resourceUrl };
  return verifyOAuthToken(p.db, token, oauth, req.headers.get("x-reeldeal-organisation"));
}

export async function handleMcpHttp(p: Platform, cfg: HttpConfig, req: Request, opts: { workersRunning?: boolean | null } = {}): Promise<Response> {
  const origin = req.headers.get("origin");
  if (origin) {
    const allowed = new Set([new URL(cfg.resourceUrl).origin, ...(cfg.allowedOrigins ?? [])]);
    if (!allowed.has(origin)) return jsonError(403, "Origin not allowed");
  }
  if (req.method !== "POST" && req.method !== "GET" && req.method !== "DELETE") return jsonError(405, "Method not allowed");

  let principal: Principal;
  try {
    principal = await authenticate(p, cfg, req);
  } catch (e) {
    const err = e as AppError;
    if (err.code === "forbidden" || err.code === "invalid_input") return jsonError(403, err.message);
    return unauthorized(cfg, req.headers.has("authorization") ? "invalid_token" : undefined, err.message);
  }

  const server = createMcpServer(p, {
    // Re-verified per call by the server; for a single stateless request the verified principal is reused.
    resolvePrincipal: async () => principal,
    workersRunning: opts.workersRunning ?? null,
  });
  const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
  await server.connect(transport);
  const authInfo: AuthInfo = { token: "[verified]", clientId: principal.clientId ?? principal.tokenId ?? principal.userId, scopes: principal.scopes, extra: { orgId: principal.orgId, userId: principal.userId } };
  try {
    return await transport.handleRequest(req, { authInfo });
  } finally {
    void server.close().catch(() => {});
  }
}
