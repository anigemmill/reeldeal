/* Background job worker (media analysis, rendering). Usage: npm run worker */
import { createPlatform } from "../src/server/platform";
import { createWorker } from "../src/server/workers/runner";

async function main() {
  const platform = await createPlatform();
  if (platform.db.driver === "pglite") {
    platform.log.warn("Using the embedded database: run the worker inside the MCP server instead (it starts one automatically).");
  }
  const worker = createWorker(platform);
  worker.start();
  const stop = async () => {
    await worker.stop();
    await platform.db.close();
    process.exit(0);
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
}
main();
