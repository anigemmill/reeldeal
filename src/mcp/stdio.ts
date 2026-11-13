import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { serverEnv } from "@/env/server";
import { verifyAccessToken } from "@/server/auth/tokens";
import { createPlatform } from "@/server/platform";
import { createWorker } from "@/server/workers/runner";
import { createMcpServer } from "./server";

/*
  Local MCP server over STDIO, launched by an MCP client (Claude Desktop, Claude Code).
  Start it with scripts/mcp-stdio.sh (see docs/mcp.md). Authenticates with the personal
  access token in REELDEAL_MCP_TOKEN (set in the client's config, never committed).
  stdout carries the MCP protocol only; all logs go to stderr.
  With the embedded database (no DATABASE_URL) it also runs the job worker in-process,
  because the embedded database can only be opened by one process.
*/
async function main() {
  const platform = await createPlatform();
  const token = serverEnv.REELDEAL_MCP_TOKEN;
  if (!token) {
    platform.log.error("REELDEAL_MCP_TOKEN is not set. Create one with `npm run mcp:token` and add it to your MCP client config.");
    process.exit(1);
  }
  const principal = await verifyAccessToken(platform.db, token).catch(() => null);
  if (!principal) {
    platform.log.error("REELDEAL_MCP_TOKEN was rejected (invalid, expired or revoked). Create a new one with `npm run mcp:token`.");
    process.exit(1);
  }

  const worker = platform.db.driver === "pglite" ? createWorker(platform) : null;
  worker?.start();

  const server = createMcpServer(platform, {
    // Re-verified on every call so revocation takes effect immediately.
    resolvePrincipal: () => verifyAccessToken(platform.db, token),
    workersRunning: worker ? true : null,
  });
  await server.connect(new StdioServerTransport());
  platform.log.info("reeldeal MCP server ready (stdio)", { org_id: principal.orgId, database: platform.db.driver, storage: platform.storage.driver, ai: Boolean(platform.ai) });

  const shutdown = async () => {
    await worker?.stop();
    await server.close().catch(() => {});
    await platform.db.close().catch(() => {});
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
  process.stdin.on("close", shutdown);
}

main().catch((e) => {
  process.stderr.write(`reeldeal MCP server failed to start: ${(e as Error).message}\n`);
  process.exit(1);
});
