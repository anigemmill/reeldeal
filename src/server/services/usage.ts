import { getPlan } from "@/lib/pricing";
import { asUser, iso, type Ctx } from "../context";
import type { Sql } from "../db/types";
import { AppError } from "../errors";

/*
  Credits and allowances. Plans and allowances come from config/pricing.json; balances
  come from the append-only ledger (credit_transactions). Clients never supply balances.
  Video credits: a monthly grant (or a one-off grant on Free), minus holds and charges.
  Analysis: minutes of footage analysed this month against the plan allowance.
*/
export const currentPeriod = (now = new Date()) => now.toISOString().slice(0, 7);

/** Ensure this period's video-credit grant exists (idempotent). System context only. */
export async function ensureGrant(sys: Sql, orgId: string, period = currentPeriod()) {
  const [org] = await sys.query<{ plan_id: string }>("select plan_id from public.organisations where id = $1", [orgId]);
  if (!org) return;
  const plan = getPlan(org.plan_id);
  const amount = plan?.videoCredits.amount ?? 0;
  if (!plan || amount <= 0) return;
  const once = plan.videoCredits.period === "once";
  const [existing] = await sys.query<{ n: number }>(
    `select count(*)::int as n from public.credit_transactions where org_id = $1 and wallet = 'video' and kind = 'grant' ${once ? "" : "and period = $2"}`,
    once ? [orgId] : [orgId, period],
  );
  if (existing.n > 0) return;
  await sys.query("select pg_advisory_xact_lock(hashtext($1))", [`grant:${orgId}`]);
  await sys.query(
    `insert into public.credit_transactions (org_id, wallet, kind, amount, period, note)
     select $1, 'video', 'grant', $2, $3, $4
     where not exists (select 1 from public.credit_transactions where org_id = $1 and wallet = 'video' and kind = 'grant' ${once ? "" : "and period = $3"})`,
    [orgId, amount, period, `${plan.name} plan allowance`],
  );
}

/** Spendable video credits: everything in the ledger for this period (one-off plans: all time). */
export async function availableVideoCredits(sql: Sql, orgId: string, planId: string, period = currentPeriod()): Promise<number> {
  const once = getPlan(planId)?.videoCredits.period === "once";
  const [r] = await sql.query<{ total: number | null }>(
    `select coalesce(sum(amount), 0)::int as total from public.credit_transactions where org_id = $1 and wallet = 'video' ${once ? "" : "and period = $2"}`,
    once ? [orgId] : [orgId, period],
  );
  return Number(r.total ?? 0);
}

export async function getUsage(ctx: Ctx) {
  await ctx.db.system((sys) => ensureGrant(sys, ctx.principal.orgId));
  return asUser(ctx, async (sql) => {
    const [org] = await sql.query<{ plan_id: string }>("select plan_id from public.organisations where id = $1", [ctx.principal.orgId]);
    if (!org) throw new AppError("forbidden", "Workspace not available");
    const plan = getPlan(org.plan_id);
    const period = currentPeriod();
    const once = plan?.videoCredits.period === "once";
    const sums = await sql.query<{ wallet: string; kind: string; total: number }>(
      `select wallet, kind, sum(amount)::int as total from public.credit_transactions
        where org_id = $1 and (period = $2 or ($3 and wallet = 'video')) group by wallet, kind`,
      [ctx.principal.orgId, period, once],
    );
    const sum = (wallet: string, kind: string) => Number(sums.find((s) => s.wallet === wallet && s.kind === kind)?.total ?? 0);
    const videoGranted = sum("video", "grant") + Math.max(0, sum("video", "adjustment")) + sum("video", "refund");
    const videoUsed = -sum("video", "charge") || 0;
    const videoHeld = -(sum("video", "hold") + sum("video", "release")) || 0;
    const available = await availableVideoCredits(sql, ctx.principal.orgId, org.plan_id, period);
    const analysisUsedSeconds = -sum("analysis", "charge") || 0;
    const [storage] = await sql.query<{ bytes: number | null }>(
      `select coalesce((select sum(size_bytes) from public.media_assets where org_id = $1), 0)
            + coalesce((select sum(size_bytes) from public.exports where org_id = $1), 0) as bytes`,
      [ctx.principal.orgId],
    );
    const history = await sql.query<{ created_at: string; wallet: string; kind: string; amount: number; note: string | null; job_id: string | null }>(
      `select created_at, wallet, kind, amount, note, job_id from public.credit_transactions where org_id = $1 order by created_at desc limit 20`,
      [ctx.principal.orgId],
    );
    return {
      period,
      plan: plan ? { id: plan.id, name: plan.name } : { id: org.plan_id, name: org.plan_id },
      video_credits: {
        allowance: plan?.videoCredits.amount ?? null,
        allowance_period: plan?.videoCredits.period ?? null,
        granted: videoGranted,
        used: videoUsed,
        held_for_renders_in_progress: videoHeld,
        available,
      },
      analysis_minutes: {
        allowance: plan?.analysisMinutes ?? null,
        used: Math.round((analysisUsedSeconds / 60) * 10) / 10,
      },
      storage_gb: {
        allowance: plan?.storageGB ?? null,
        used: Math.round((Number(storage.bytes ?? 0) / 1e9) * 1000) / 1000,
      },
      recent_transactions: history.map((h) => ({ at: iso(h.created_at), wallet: h.wallet, kind: h.kind, amount: Number(h.amount), note: h.note, job_id: h.job_id })),
      notes: ["Credits are only spent when a render succeeds. Failed platform renders are free.", "Storyboard previews are free."],
    };
  });
}
