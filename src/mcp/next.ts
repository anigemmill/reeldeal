import "server-only";
import { serverEnv as env } from "@/env/server";
import type { Platform } from "@/server/context";
import { createPlatform } from "@/server/platform";
import { handleMcpHttp, protectedResourceMetadata, type HttpConfig } from "./http";

/*
  Next.js (Vercel) adapter for the remote MCP endpoint. Stateless Streamable HTTP:
  each request is self-contained, so serverless instances can scale freely.
  Requires DATABASE_URL (Supabase); the embedded development database is never
  used from the web app. Background jobs run in the separate worker process.
*/
let platform: Promise<Platform> | null = null;

export function httpConfig(req: Request): HttpConfig {
  const resourceUrl = env.MCP_PUBLIC_URL ?? new URL("/api/mcp", req.url).toString();
  const issuer = env.SUPABASE_JWT_ISSUER;
  const jwksUrl = env.SUPABASE_JWKS_URL;
  return {
    resourceUrl,
    oauth: issuer && jwksUrl ? { issuer, jwksUrl } : null,
    allowedOrigins: (env.MCP_ALLOWED_ORIGINS ?? "").split(",").map((s) => s.trim()).filter(Boolean),
    allowPats: true,
  };
}

export async function handleNextMcp(req: Request): Promise<Response> {
  if (!env.DATABASE_URL) {
    return Response.json({ error: "The MCP endpoint is not configured on this deployment (DATABASE_URL is not set)." }, { status: 503 });
  }
  platform ??= createPlatform({ autoMigrateEmbedded: false });
  let p: Platform;
  try {
    p = await platform;
  } catch (e) {
    platform = null; // retry initialisation on the next request
    console.error(`MCP endpoint configuration error: ${(e as Error).message}`);
    return Response.json({ error: "The MCP endpoint is not correctly configured on this deployment." }, { status: 503 });
  }
  return handleMcpHttp(p, httpConfig(req), req, { workersRunning: null });
}

export function nextProtectedResourceMetadata(req: Request) {
  return Response.json(protectedResourceMetadata(httpConfig(req)), { headers: { "cache-control": "public, max-age=300" } });
}
