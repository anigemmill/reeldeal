import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, rename, rm, stat } from "node:fs/promises";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { dirname } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { serverEnv as env } from "@/env/server";
import { createPlatform } from "@/server/platform";
import type { createLocalStorage } from "@/server/storage/local";
import { createWorker } from "@/server/workers/runner";
import { UPLOAD_TYPES } from "@/server/services/media";
import { handleMcpHttp, protectedResourceMetadata, type HttpConfig } from "./http";

/*
  Standalone Streamable HTTP MCP server (Node). Use it for local development and
  for hosting the remote MCP endpoint on a long-running server; on Vercel the same
  handler runs as a route (src/app/api/mcp/route.ts).

    POST/GET/DELETE /mcp                              MCP endpoint (Bearer token required)
    GET  /.well-known/oauth-protected-resource[/mcp]   RFC 9728 metadata
    GET  /healthz                                      liveness
    GET/PUT /media/<key>?exp&sig                       signed links for LOCAL storage only (development)

  Flags: --worker also runs the job worker in this process.
*/
async function main() {
  const platform = await createPlatform();
  const port = env.MCP_HTTP_PORT;
  const resourceUrl = env.MCP_PUBLIC_URL ?? `http://localhost:${port}/mcp`;
  const cfg: HttpConfig = {
    resourceUrl,
    oauth: env.SUPABASE_JWT_ISSUER && env.SUPABASE_JWKS_URL ? { issuer: env.SUPABASE_JWT_ISSUER, jwksUrl: env.SUPABASE_JWKS_URL } : null,
    allowedOrigins: (env.MCP_ALLOWED_ORIGINS ?? "").split(",").map((s) => s.trim()).filter(Boolean),
    allowPats: true,
  };
  const worker = process.argv.includes("--worker") || platform.db.driver === "pglite" ? createWorker(platform) : null;
  worker?.start();
  const local = platform.storage.driver === "local" ? (platform.storage as ReturnType<typeof createLocalStorage>) : null;
  const mcpPath = new URL(resourceUrl).pathname;

  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
      if (url.pathname === "/healthz") return send(res, 200, { ok: true });
      if (url.pathname.startsWith("/.well-known/oauth-protected-resource")) return send(res, 200, protectedResourceMetadata(cfg));
      if (url.pathname === mcpPath) return forward(res, await handleMcpHttp(platform, cfg, toRequest(req, url), { workersRunning: worker ? true : null }));
      if (local && url.pathname.startsWith("/media/")) return serveLocalMedia(local, req, res, url);
      send(res, 404, { error: "Not found" });
    } catch (e) {
      platform.log.error("http error", { error: (e as Error).message });
      if (!res.headersSent) send(res, 500, { error: "Internal error" });
      else res.end();
    }
  });
  server.listen(port, () => platform.log.info("reeldeal MCP server listening (streamable http)", { url: resourceUrl, oauth: Boolean(cfg.oauth), worker: Boolean(worker), storage: platform.storage.driver }));

  const shutdown = async () => {
    server.close();
    await worker?.stop();
    await platform.db.close().catch(() => {});
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

function send(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { "content-type": "application/json", "cache-control": "no-store" });
  res.end(JSON.stringify(body));
}

function toRequest(req: IncomingMessage, url: URL): Request {
  const headers = new Headers();
  for (const [k, v] of Object.entries(req.headers)) if (v !== undefined) headers.set(k, Array.isArray(v) ? v.join(", ") : v);
  const hasBody = req.method !== "GET" && req.method !== "HEAD";
  return new Request(url, { method: req.method, headers, body: hasBody ? (Readable.toWeb(req) as ReadableStream) : undefined, duplex: "half" } as RequestInit);
}

async function forward(res: ServerResponse, web: Response) {
  res.writeHead(web.status, Object.fromEntries(web.headers.entries()));
  if (web.body) await pipeline(Readable.fromWeb(web.body as never), res);
  else res.end();
}

async function serveLocalMedia(local: ReturnType<typeof createLocalStorage>, req: IncomingMessage, res: ServerResponse, url: URL) {
  const key = decodeURIComponent(url.pathname.slice("/media/".length));
  const exp = url.searchParams.get("exp") ?? "";
  const sig = url.searchParams.get("sig") ?? "";
  if (req.method === "GET") {
    const filename = url.searchParams.get("filename") ?? "";
    if (!local.verify("GET", key, exp, sig, filename)) return send(res, 403, { error: "Link invalid or expired" });
    const path = local.pathFor(key);
    const s = await stat(path).catch(() => null);
    if (!s) return send(res, 404, { error: "Not found" });
    const type = key.endsWith(".jpg") ? "image/jpeg" : key.endsWith(".mp4") ? "video/mp4" : "application/octet-stream";
    res.writeHead(200, { "content-type": type, "content-length": s.size, "cache-control": "private, no-store", ...(filename ? { "content-disposition": `attachment; filename="${filename.replace(/["\\\r\n]/g, "")}"` } : {}) });
    return void createReadStream(path).pipe(res);
  }
  if (req.method === "PUT") {
    const ct = url.searchParams.get("ct") ?? "";
    if (!local.verify("PUT", key, exp, sig, ct) || req.headers["content-type"] !== ct) return send(res, 403, { error: "Link invalid or expired" });
    const max = UPLOAD_TYPES[ct]?.maxBytes ?? 0;
    const path = local.pathFor(key);
    if (await stat(path).catch(() => null)) return send(res, 409, { error: "Already uploaded" });
    await mkdir(dirname(path), { recursive: true });
    const tmp = `${path}.part-${process.pid}`;
    let size = 0;
    req.on("data", (c: Buffer) => {
      size += c.length;
      if (size > max) req.destroy(new Error("too large"));
    });
    try {
      await pipeline(req, createWriteStream(tmp, { flags: "wx" }));
      await rename(tmp, path);
    } catch {
      await rm(tmp, { force: true });
      return send(res, 413, { error: "Upload failed or too large" });
    }
    return send(res, 200, { ok: true, size });
  }
  send(res, 405, { error: "Method not allowed" });
}

main().catch((e) => {
  process.stderr.write(`reeldeal MCP HTTP server failed to start: ${(e as Error).message}\n`);
  process.exit(1);
});
