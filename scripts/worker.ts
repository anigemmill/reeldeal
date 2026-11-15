/*
  Background job worker (media analysis, rendering). Usage: npm run worker
  Runs anywhere with Node 22 and FFmpeg (see infra/worker/Dockerfile), never inside a
  Vercel function. Needs DATABASE_URL, R2_* and SIGNING_SECRET; OPENAI_API_KEY only for
  consented AI frame descriptions. Run several for throughput: claiming is SKIP LOCKED.
*/
import { createPlatform, platformEnv as env } from "../src/server/platform";
import { createWorker } from "../src/server/workers/runner";

async function main() {
  const platform = await createPlatform();
  if (platform.db.driver === "pglite") {
    platform.log.warn("Using the embedded database: run the worker inside the MCP server instead (it starts one automatically).");
  }
  const worker = createWorker(platform, { staleAfterSeconds: env.WORKER_STALE_SECONDS, heartbeatMs: env.WORKER_HEARTBEAT_SECONDS * 1000 });
  worker.start();
  let stopping = false;
  const stop = async (signal: string) => {
    if (stopping) return;
    stopping = true;
    platform.log.info("worker stopping", { signal, grace_seconds: env.WORKER_SHUTDOWN_GRACE_SECONDS });
    // Container platforms send SIGTERM and kill a few seconds later: finish or hand the job back in time.
    await worker.stop({ graceMs: env.WORKER_SHUTDOWN_GRACE_SECONDS * 1000 });
    await platform.db.close();
    process.exit(0);
  };
  process.on("SIGINT", () => stop("SIGINT"));
  process.on("SIGTERM", () => stop("SIGTERM"));
}
main();
