import "server-only";
import type { Platform } from "../context";
import { createPlatform } from "../platform";

/*
  One platform per server process, shared by the customer web app and the
  remote MCP endpoint (src/mcp/next.ts): the same services, database pool and
  storage driver. Requires DATABASE_URL: the web app never uses the embedded
  development database, and background jobs run in the separate worker.
*/
let platform: Promise<Platform> | null = null;

export async function getPlatform(): Promise<Platform> {
  platform ??= createPlatform({ autoMigrateEmbedded: false, service: "web" });
  try {
    return await platform;
  } catch (e) {
    platform = null; // retry initialisation on the next request
    throw e;
  }
}
