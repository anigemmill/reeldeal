import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Ctx } from "../context";
import { claimNextJob, requeueStaleJobs, type JobRow } from "../services/jobs";
import { requestAnalysis } from "../services/media";
import { submitStoryboard } from "../services/projects";
import { createVideo } from "../services/render";
import { getUsage } from "../services/usage";
import { createTestPlatform } from "../testing";
import { runRender } from "./render";
import { createWorker } from "./runner";

/*
  Job reliability: crashes, restarts, lost claims and shutdown. Real renders (FFmpeg),
  real ledger. A worker "crash" is simulated by claiming a job and never finishing it;
  the process-level kill test is in scripts/integration-live.ts.
*/
let t: Awaited<ReturnType<typeof createTestPlatform>>;
let aroha: Ctx;
beforeAll(async () => {
  t = await createTestPlatform({ clips: 2 });
  aroha = await t.ctxFor(t.demo.tokens.aroha_owner_full);
  await requestAnalysis(aroha, t.demo.media.find((m) => m.org === "a")!.id);
  await createWorker(t.p).runOnce();
}, 180_000);
afterAll(async () => t?.p.db.close());

const sys = <T>(q: string, params: unknown[] = []) => t.p.db.system((sql) => sql.query<T & Record<string, unknown>>(q, params));
const available = async () => (await getUsage(aroha)).video_credits.available;
const ledger = async (jobId: string) => (await sys<{ kind: string }>("select kind from public.credit_transactions where job_id = $1 order by kind", [jobId])).map((r) => r.kind);
const age = (jobId: string) => sys("update public.jobs set heartbeat_at = now() - interval '1 hour' where id = $1", [jobId]);

async function queueRender(): Promise<string> {
  const [{ id: clip }] = await sys<{ id: string }>("select id from public.media_assets where org_id = $1 and duration_seconds is not null limit 1", [t.demo.ids.orgA]);
  const sb = await submitStoryboard(aroha, { project_id: t.demo.ids.projectA, title: "Reliability", format: "9:16", scenes: [{ duration_seconds: 1, asset_id: clip }, { duration_seconds: 1, on_screen_text: "Book direct" }] });
  const q = await createVideo(aroha, { project_id: t.demo.ids.projectA, storyboard_id: sb.storyboard_id });
  if (q.status !== "confirmation_required") throw new Error("expected a quote");
  const go = await createVideo(aroha, { project_id: t.demo.ids.projectA, storyboard_id: sb.storyboard_id, confirm: true, quote_token: q.quote.quote_token });
  return (go as { job: { job_id: string } }).job.job_id;
}

describe("job reliability", () => {
  it("a job whose worker died is picked up by another worker and charged exactly once", async () => {
    const before = await available();
    const jobId = await queueRender();
    const dead = await t.p.db.system((sql) => claimNextJob(sql, ["render"], "worker-that-crashed"));
    expect(dead?.id).toBe(jobId);
    await age(jobId); // the crashed worker stops heartbeating

    const done = await createWorker(t.p, { workerId: "worker-b" }).runOnce();
    expect(done).toMatchObject({ id: jobId, status: "succeeded", locked_by: "worker-b", claim_count: 2 });
    expect(await ledger(jobId)).toEqual(["charge", "hold", "release"]);
    expect(await available()).toBe(before - 1);
  }, 120_000);

  it("a job that keeps killing its worker fails after max_attempts, with credits released", async () => {
    const before = await available();
    const jobId = await queueRender();
    for (let i = 1; i <= 3; i++) {
      await t.p.db.system((sql) => claimNextJob(sql, ["render"], `crashing-${i}`));
      await age(jobId);
      await t.p.db.system((sql) => requeueStaleJobs(sql, 60));
    }
    const [job] = await sys<{ status: string; claim_count: number; error: { code: string; retryable: boolean } }>("select status, claim_count, error from public.jobs where id = $1", [jobId]);
    expect(job).toMatchObject({ status: "failed", claim_count: 3, error: { code: "worker_lost", retryable: true } });
    expect(await ledger(jobId)).toEqual(["hold", "release"]);
    expect(await available()).toBe(before);
  }, 60_000);

  it("a worker that lost its claim cannot write results or move credits", async () => {
    const before = await available();
    const jobId = await queueRender();
    const mine = (await t.p.db.system((sql) => claimNextJob(sql, ["render"], "slow-worker"))) as JobRow;
    // Presumed dead: the job went back to the queue and another worker took it.
    await sys("update public.jobs set locked_by = 'other-worker' where id = $1", [jobId]);
    const err = await runRender(t.p, mine, await mkdtemp(join(tmpdir(), "rd-lost-"))).catch((e) => e);
    expect((err as { lostClaim?: boolean }).lostClaim).toBe(true);
    expect(await sys("select id from public.exports where job_id = $1", [jobId])).toEqual([]);
    expect(await ledger(jobId)).toEqual(["hold"]);
    expect(await available()).toBe(before - 1); // still held for the worker that owns it
    // The owner finishes normally.
    await sys("update public.jobs set locked_by = null, status = 'queued' where id = $1", [jobId]);
    expect((await createWorker(t.p).runOnce())?.status).toBe("succeeded");
    expect(await ledger(jobId)).toEqual(["charge", "hold", "release"]);
  }, 120_000);

  it("the ledger refuses a second charge for the same job at the database level", async () => {
    const [j] = await sys<{ id: string }>("select id from public.jobs where status = 'succeeded' and kind = 'render' limit 1");
    const err = await sys("insert into public.credit_transactions (org_id, wallet, kind, amount, period, job_id) values ($1, 'video', 'charge', -1, '2026-11', $2)", [t.demo.ids.orgA, j.id]).then(() => null, (e: Error) => e.message);
    expect(err).toMatch(/credit_transactions_once_per_job/);
  });

  it("on shutdown a worker hands an unfinished job back to the queue", async () => {
    const jobId = await queueRender();
    const w = createWorker(t.p, { workerId: "stopping-worker", pollMs: 10 });
    w.start();
    for (let i = 0; i < 200; i++) {
      const [j] = await sys<{ status: string }>("select status from public.jobs where id = $1", [jobId]);
      if (j.status === "running") break;
      await new Promise((r) => setTimeout(r, 5));
    }
    await w.stop({ graceMs: 0 });
    const [j] = await sys<{ status: string; locked_by: string | null }>("select status, locked_by from public.jobs where id = $1", [jobId]);
    // Either it was released, or it was so quick it had already finished.
    if (j.status !== "succeeded") expect(j).toMatchObject({ status: "queued", locked_by: null });
    // The abandoned in-process run must not finalise; a fresh worker completes it once.
    await new Promise((r) => setTimeout(r, 3000));
    if (j.status !== "succeeded") expect((await createWorker(t.p).runOnce())?.status).toBe("succeeded");
    expect(await ledger(jobId)).toEqual(["charge", "hold", "release"]);
  }, 120_000);
});
