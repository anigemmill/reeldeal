/*
  One-command local setup for the MCP server: database (embedded by default, or
  DATABASE_URL), migrations, demo workspaces with real generated footage, analysis
  of all footage with the real worker, and demo access tokens.
    npm run dev:setup            first time
    npm run dev:setup -- --reset start over (deletes .data/pglite and .data/storage only)
  Demo tokens are written to .data/dev-tokens.json (git-ignored).
*/
import { existsSync } from "node:fs";
import { chmod, rm, writeFile } from "node:fs/promises";
import { serverEnv as env } from "../src/env/server";
import { verifyAccessToken } from "../src/server/auth/tokens";
import { createPgliteDb } from "../src/server/db/pglite";
import { migrate } from "../src/server/db/migrate";
import { createPostgresDb, execPostgresFile } from "../src/server/db/postgres";
import type { Db } from "../src/server/db/types";
import { createPlatform } from "../src/server/platform";
import { seedDemoData } from "../src/server/seed";
import { requestAnalysis } from "../src/server/services/media";
import { createWorker } from "../src/server/workers/runner";

async function main() {
  const reset = process.argv.includes("--reset");
  let db: Db;
  if (env.DATABASE_URL) {
    const url = env.DATABASE_URL;
    db = createPostgresDb(url);
    await migrate(db, (sql) => execPostgresFile(url, sql), (m) => console.log(`✓ ${m}`));
    const [{ n }] = await db.system((sql) => sql.query<{ n: number }>("select count(*)::int as n from public.organisations"));
    if (n > 0 && !reset) throw new Error("This database already has workspaces. Use a fresh database for demo data.");
  } else {
    if (existsSync(env.PGLITE_DIR) && !reset) {
      console.log(`Already set up (${env.PGLITE_DIR}). Use --reset to start over.`);
      return;
    }
    if (reset) {
      await rm(env.PGLITE_DIR, { recursive: true, force: true });
      await rm(env.LOCAL_STORAGE_DIR, { recursive: true, force: true });
    }
    const pg = await createPgliteDb(env.PGLITE_DIR);
    await migrate(pg, (sql) => pg.exec(sql), (m) => console.log(`✓ ${m}`));
    db = pg;
  }
  const platform = await createPlatform({ db });
  console.log("Generating demo footage and workspaces…");
  const demo = await seedDemoData(platform);
  console.log(`✓ ${demo.media.length} clips, 2 workspaces, 4 demo users`);

  console.log("Analysing footage with the real worker (FFmpeg)…");
  for (const [tokenName, org] of [["aroha_owner_full", "a"], ["dev_harbour_full", "b"]] as const) {
    const ctx = { ...platform, principal: await verifyAccessToken(db, demo.tokens[tokenName]) };
    for (const m of demo.media.filter((x) => x.org === org)) await requestAnalysis(ctx, m.id);
  }
  const worker = createWorker(platform);
  let done = 0;
  while (await worker.runOnce()) done++;
  console.log(`✓ ${done} analysis jobs finished`);

  const tokenFile = env.DATABASE_URL ? ".data/dev-tokens.postgres.json" : ".data/dev-tokens.json";
  await writeFile(tokenFile, JSON.stringify({ note: "Local demo tokens. Never use outside development.", ...demo.tokens }, null, 2));
  await chmod(tokenFile, 0o600);
  console.log(`\nDemo access tokens saved to ${tokenFile} (git-ignored).`);
  console.log("  aroha_owner_full      Lakeside Lodge owner, can render");
  console.log("  ben_editor_no_render  Lakeside Lodge editor, cannot start renders");
  console.log("  cleo_viewer_read      Lakeside Lodge viewer, read only");
  console.log("  dev_harbour_full      Harbour Café owner (a separate workspace)");
  console.log("\nNext: see docs/mcp.md to connect Claude.");
  await db.close();
}
main().catch((e) => {
  console.error(`✗ ${(e as Error).message}`);
  process.exit(1);
});
