import "server-only";
import { serverEnv as env } from "@/env/server";
import type { Platform } from "@/server/context";
import { getPlatform } from "@/server/app/platform";
import { handleMcpHttp, protectedResourceMetadata, type HttpConfig } from "./http";
import { withBasePath } from "@/lib/base-path";

/*
  Next.js (Vercel) adapter for the remote MCP endpoint. Stateless Streamable HTTP:
  each request is self-contained, so serverless instances can scale freely.
  Requires DATABASE_URL (Supabase); the embedded development database is never
  used from the web app. Background jobs run in the separate worker process.

  Remote authentication is development-only until the OAuth authorisation server is
  connected: personal access tokens are accepted only by `next dev`. A production
  build (any Vercel deployment, preview included) refuses them, and without OAuth
  configured it answers 503 for every MCP request.
*/
const PATS_ALLOWED = env.NODE_ENV !== "production";

export function httpConfig(req: Request): HttpConfig {
  const resourceUrl = env.MCP_PUBLIC_URL ?? new URL(withBasePath("/api/mcp"), req.url).toString();
  const issuer = env.SUPABASE_JWT_ISSUER;
  const jwksUrl = env.SUPABASE_JWKS_URL;
  return {
    resourceUrl,
    oauth: issuer && jwksUrl ? { issuer, jwksUrl } : null,
    allowedOrigins: (env.MCP_ALLOWED_ORIGINS ?? "").split(",").map((s) => s.trim()).filter(Boolean),
    allowPats: PATS_ALLOWED,
  };
}

export async function handleNextMcp(req: Request): Promise<Response> {
  if (!env.DATABASE_URL) {
    return Response.json({ error: "The MCP endpoint is not configured on this deployment (DATABASE_URL is not set)." }, { status: 503 });
  }
  if (!PATS_ALLOWED && !(env.SUPABASE_JWT_ISSUER && env.SUPABASE_JWKS_URL)) {
    return Response.json({ error: "Remote MCP is disabled on this deployment until OAuth sign-in is configured. Use the local STDIO server." }, { status: 503 });
  }
  let p: Platform;
  try {
    p = await getPlatform();
  } catch (e) {
    console.error(`MCP endpoint configuration error: ${(e as Error).message}`);
    return Response.json({ error: "The MCP endpoint is not correctly configured on this deployment." }, { status: 503 });
  }
  return handleMcpHttp(p, httpConfig(req), req, { workersRunning: null });
}

export function nextProtectedResourceMetadata(req: Request) {
  return Response.json(protectedResourceMetadata(httpConfig(req)), { headers: { "cache-control": "public, max-age=300" } });
}
