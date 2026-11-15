import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Platform } from "../context";
import { claimNextJob, failJob, heartbeat, releaseJob, requeueStaleJobs, type JobKind, type JobRow } from "../services/jobs";
import { runMediaAnalysis } from "./analysis";
import { runRender, type RenderOptions } from "./render";

/*
  Job worker: claims queued jobs (SKIP LOCKED, so several workers can run safely),
  runs them in a private temp directory and records the outcome. Runs as its own
  process in production (npm run worker); the local STDIO server can run one
  in-process when it uses the embedded database.

  Reliability: jobs live in Postgres, so they survive restarts of the app and of
  workers. While a job runs the worker heartbeats every heartbeatMs; a job whose
  heartbeat is older than staleAfterSeconds is requeued by any worker (or failed,
  with credits released, after max_attempts claims). On shutdown the worker stops
  claiming, waits up to graceMs and otherwise hands its job straight back to the queue.
*/
export type Worker = { start(): void; stop(opts?: { graceMs?: number }): Promise<void>; runOnce(): Promise<JobRow | null>; readonly running: boolean; readonly workerId: string };

export type WorkerOptions = { kinds?: JobKind[]; workerId?: string; pollMs?: number; render?: RenderOptions; heartbeatMs?: number; staleAfterSeconds?: number };

export function createWorker(p: Platform, opts: WorkerOptions = {}): Worker {
  const kinds = opts.kinds ?? ["media_analysis", "render"];
  const workerId = opts.workerId ?? `worker-${process.pid}-${Math.random().toString(36).slice(2, 8)}`;
  const log = p.log.child({ worker: workerId });
  let timer: NodeJS.Timeout | null = null;
  let active: Promise<unknown> | null = null;
  let running = false;
  let current: JobRow | null = null;
  const heartbeatMs = opts.heartbeatMs ?? 15_000;

  async function runOnce(): Promise<JobRow | null> {
    const requeued = await p.db.system((sql) => requeueStaleJobs(sql, opts.staleAfterSeconds));
    if (requeued.length) log.warn("recovered jobs from stopped workers", { job_ids: requeued.map((j) => j.id) });
    const job = await p.db.system((sql) => claimNextJob(sql, kinds, workerId));
    if (!job) return null;
    current = job;
    const beat = setInterval(() => {
      p.db.system((sql) => heartbeat(sql, job.id, workerId)).then(
        (ok) => !ok && log.warn("lost the claim on a job; its result will be discarded", { job_id: job.id }),
        (e) => log.warn("heartbeat failed", { job_id: job.id, error: (e as Error).message }),
      );
    }, heartbeatMs);
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
      clearInterval(beat);
      current = null;
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
    workerId,
    start() {
      if (running) return;
      running = true;
      log.info("worker started", { kinds });
      void tick();
    },
    async stop({ graceMs = Infinity } = {}) {
      running = false;
      if (timer) clearTimeout(timer);
      if (!active) return;
      const finished = await Promise.race([active.then(() => true, () => true), new Promise<boolean>((r) => setTimeout(() => r(false), Math.min(graceMs, 2 ** 31 - 1)))]);
      if (!finished && current) {
        const job = current;
        const released = await p.db.system((sql) => releaseJob(sql, job.id, workerId)).catch(() => false);
        log.warn("shutting down mid-job; handed it back to the queue", { job_id: job.id, released });
      }
    },
    runOnce,
  };
}
