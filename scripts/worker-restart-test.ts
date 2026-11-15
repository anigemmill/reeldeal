/*
  Kills a real worker process mid-render and checks the job survives: another worker
  recovers it and the organisation is charged exactly once. Postgres only.

    npm run worker:restart-test -- --kill "<command that kills the worker>" --start "<command that starts one>" [--signal KILL|TERM]

  Example with the worker container and the local stack:
    --kill "docker kill -s KILL rd-worker" --start "docker start rd-worker"
  Uses the most recent renderable storyboard of the "Integration A" workspace
  (npm run integration:live creates it). Spends one credit.
*/
import { execSync } from "node:child_process";
import { parseArgs } from "node:util";
import { createAccessToken, revokeAccessToken, verifyAccessToken } from "../src/server/auth/tokens";
import { createPlatform } from "../src/server/platform";
import { createVideo } from "../src/server/services/render";
import { getUsage } from "../src/server/services/usage";

const { values: args } = parseArgs({ options: { kill: { type: "string" }, start: { type: "string" }, timeout: { type: "string" } } });
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  if (!args.kill || !args.start) throw new Error('--kill "<cmd>" and --start "<cmd>" are required');
  const p = await createPlatform();
  if (p.db.driver !== "postgres") throw new Error("Needs DATABASE_URL (a worker in another process must share the database)");
  const sys = <T>(q: string, params: unknown[] = []) => p.db.system((sql) => sql.query<T & Record<string, unknown>>(q, params));
  let tokenId = "";
  try {
    const [sb] = await sys<{ org_id: string; user_id: string; project_id: string; storyboard_id: string }>(
      `select o.id as org_id, m.user_id, s.project_id, s.id as storyboard_id from public.organisations o
         join public.memberships m on m.org_id = o.id and m.role = 'owner'
         join public.storyboards s on s.org_id = o.id
        where o.name = 'Integration A' order by s.created_at desc limit 1`,
    );
    if (!sb) throw new Error('No "Integration A" storyboard: run npm run integration:live first');
    const t = await createAccessToken(p.db, { userId: sb.user_id, orgId: sb.org_id, name: "restart test", scopes: ["mcp:read", "mcp:write", "mcp:render"], expiresInDays: 1 });
    tokenId = t.id;
    const ctx = { ...p, principal: await verifyAccessToken(p.db, t.token) };
    const before = (await getUsage(ctx)).video_credits.available;
    const q = await createVideo(ctx, { project_id: sb.project_id, storyboard_id: sb.storyboard_id });
    if (q.status !== "confirmation_required") throw new Error("expected a quote");
    const go = (await createVideo(ctx, { project_id: sb.project_id, storyboard_id: sb.storyboard_id, confirm: true, quote_token: q.quote.quote_token })) as { job: { job_id: string } };
    const jobId = go.job.job_id;
    console.log(`queued render ${jobId} (${q.quote.credits} credit(s); ${before} available)`);

    const job = async () => (await sys<{ status: string; locked_by: string | null; claim_count: number; stage: string | null }>("select status, locked_by, claim_count, stage from public.jobs where id = $1", [jobId]))[0];
    for (let i = 0; i < 600; i++) {
      const j = await job();
      if (j.status === "running" && /scene/.test(j.stage ?? "")) break;
      if (j.status !== "queued" && j.status !== "running") throw new Error(`job ended early: ${j.status}`);
      await sleep(100);
    }
    const victim = await job();
    console.log(`worker ${victim.locked_by} is mid-render ("${victim.stage}"): ${args.kill}`);
    execSync(args.kill, { stdio: "inherit" });
    const afterKill = await job();
    console.log(`after the kill: status ${afterKill.status}, stage "${afterKill.stage}"`);
    await sleep(1000);
    console.log(`starting a worker: ${args.start}`);
    execSync(args.start, { stdio: "inherit" });

    const deadline = Date.now() + Number(args.timeout ?? 300) * 1000;
    let j = await job();
    while (!["succeeded", "failed"].includes(j.status) && Date.now() < deadline) {
      await sleep(1000);
      j = await job();
    }
    const ledger = (await sys<{ kind: string }>("select kind from public.credit_transactions where job_id = $1 order by kind", [jobId])).map((r) => r.kind);
    const exportsN = (await sys<{ n: number }>("select count(*)::int as n from public.exports where job_id = $1", [jobId]))[0].n;
    const after = (await getUsage(ctx)).video_credits.available;
    console.log(`final: ${j.status}, claimed ${j.claim_count} time(s), finished by ${j.locked_by}; exports ${exportsN}; ledger [${ledger.join(", ")}]; credits ${before} → ${after}`);
    // Either the stopping worker finished inside its grace period (graceful SIGTERM), or another worker took over.
    const how = j.claim_count >= 2 ? "recovered by a new worker" : afterKill.status === "succeeded" ? "finished inside the shutdown grace period" : "unexpected";
    const pass = j.status === "succeeded" && how !== "unexpected" && exportsN === 1 && ledger.join() === "charge,hold,release" && after === before - q.quote.credits;
    console.log(pass ? `✓ the job survived the worker stopping (${how}) and was charged exactly once` : "✗ restart check FAILED");
    if (!pass) process.exitCode = 1;
  } finally {
    if (tokenId) await revokeAccessToken(p.db, tokenId).catch(() => {});
    await p.db.close();
  }
}
main().catch((e) => {
  console.error(`✗ ${(e as Error).message}`);
  process.exit(1);
});
