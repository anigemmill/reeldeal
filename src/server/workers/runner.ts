import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Platform } from "../context";
import { claimNextJob, failJob, requeueStaleJobs, type JobKind, type JobRow } from "../services/jobs";
import { runMediaAnalysis } from "./analysis";
import { runRender, type RenderOptions } from "./render";

/*
  Job worker: claims queued jobs (SKIP LOCKED, so several workers can run safely),
  runs them in a private temp directory and records the outcome. Runs as its own
  process in production (npm run worker); the local STDIO server can run one
  in-process when it uses the embedded database.
*/
export type Worker = { start(): void; stop(): Promise<void>; runOnce(): Promise<JobRow | null>; readonly running: boolean };

export function createWorker(p: Platform, opts: { kinds?: JobKind[]; workerId?: string; pollMs?: number; render?: RenderOptions } = {}): Worker {
  const kinds = opts.kinds ?? ["media_analysis", "render"];
  const workerId = opts.workerId ?? `worker-${process.pid}-${Math.random().toString(36).slice(2, 8)}`;
  const log = p.log.child({ worker: workerId });
  let timer: NodeJS.Timeout | null = null;
  let active: Promise<unknown> | null = null;
  let running = false;

  async function runOnce(): Promise<JobRow | null> {
    await p.db.system((sql) => requeueStaleJobs(sql));
    const job = await p.db.system((sql) => claimNextJob(sql, kinds, workerId));
    if (!job) return null;
    const dir = await mkdtemp(join(tmpdir(), `rd-job-${job.id.slice(0, 8)}-`));
    const started = Date.now();
    log.info("job started", { job_id: job.id, kind: job.kind, org_id: job.org_id });
    try {
      if (job.kind === "media_analysis") await runMediaAnalysis(p, job, dir);
      else await runRender(p, job, dir, opts.render);
      log.info("job succeeded", { job_id: job.id, ms: Date.now() - started });
    } catch (e) {
      log.warn("job failed", { job_id: job.id, error: (e as Error).message, ms: Date.now() - started });
      if (!(e as { handled?: boolean }).handled) {
        const retryable = (e as { retryable?: boolean }).retryable !== false;
        await p.db.system((sql) => failJob(sql, job.id, { message: retryable ? "Processing failed on our side. Please try again." : (e as Error).message, retryable }));
        if (job.kind === "media_analysis" && retryable) await p.db.system((sql) => sql.query("update public.media_assets set status = 'uploaded' where id = $1 and status = 'analysing'", [job.media_id]));
      }
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
    const [after] = await p.db.system((sql) => sql.query<JobRow>("select * from public.jobs where id = $1", [job.id]));
    return after;
  }

  const tick = async () => {
    if (!running) return;
    try {
      active = runOnce();
      const job = await active;
      timer = setTimeout(tick, job ? 0 : (opts.pollMs ?? 1000));
    } catch (e) {
      log.error("worker loop error", { error: (e as Error).message });
      timer = setTimeout(tick, 5000);
    }
  };

  return {
    get running() {
      return running;
    },
    start() {
      if (running) return;
      running = true;
      log.info("worker started", { kinds });
      void tick();
    },
    async stop() {
      running = false;
      if (timer) clearTimeout(timer);
      await active?.catch(() => {});
    },
    runOnce,
  };
}
