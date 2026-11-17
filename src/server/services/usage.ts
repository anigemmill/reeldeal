import { getPlan } from "@/lib/pricing";
import { asUser, iso, type Ctx } from "../context";
import type { Sql } from "../db/types";
import { AppError } from "../errors";

/*
  Credits and allowances. Plans and allowances come from config/pricing.json; balances
  come from the append-only ledger (credit_transactions). Clients never supply balances.
  Video credits: a monthly grant (or a one-off grant on Free), minus holds and charges, plus
  credits carried over from last month (one month only; closeFinishedPeriods).
  Analysis: minutes of footage analysed this month against the plan allowance.
*/
export const currentPeriod = (now = new Date()) => now.toISOString().slice(0, 7);

/** The month after "YYYY-MM". */
export const nextPeriod = (period: string) => {
  const [y, m] = period.split("-").map(Number);
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
};

/**
  Close every finished month that hasn't been closed yet, oldest first (pricing.json "rollover"):
  what's left of a month carries into the next month, capped at that month's own grant and at the
  current plan's allocation; the rest expires. Credits carried in are spent first (oldest first),
  so the only credits that can carry are unspent credits from the month's own grant: carried
  credits never roll a second time. Runs under the workspace's credit lock (the same lock renders
  take), and unique indexes make a repeat a no-op. System context only.
*/
export async function closeFinishedPeriods(sys: Sql, orgId: string, allocation: number, period = currentPeriod(), wallet: "video" | "ai_generation" = "video") {
  await sys.query("select pg_advisory_xact_lock(hashtext($1))", [`credits:${orgId}`]);
  // Oldest open month first, one at a time: closing a month can open the next one (its carry-in).
  for (;;) {
    const [open] = await sys.query<{ period: string }>(
      `select min(t.period) as period from public.credit_transactions t
        where t.org_id = $1 and t.wallet = $2 and t.period < $3
          and not exists (select 1 from public.credit_period_closes c where c.org_id = t.org_id and c.wallet = t.wallet and c.period = t.period)`,
      [orgId, wallet, period],
    );
    if (!open?.period) return;
    const q = open.period;
    const [r] = await sys.query<{ balance: number; granted: number }>(
      `select coalesce(sum(amount), 0)::int as balance, coalesce(sum(amount) filter (where kind = 'grant'), 0)::int as granted
         from public.credit_transactions where org_id = $1 and wallet = $2 and period = $3`,
      [orgId, wallet, q],
    );
    const balance = Number(r.balance);
    const carried = Math.max(0, Math.min(balance, Number(r.granted), allocation));
    const expired = Math.max(0, balance - carried);
    const next = nextPeriod(q);
    const [closed] = await sys.query<{ period: string }>(
      `insert into public.credit_period_closes (org_id, wallet, period, balance, carried, expired) values ($1, $2, $3, $4, $5, $6)
       on conflict do nothing returning period`,
      [orgId, wallet, q, balance, carried, expired],
    );
    if (!closed) continue; // already closed (can't happen under the lock; kept as a guard)
    if (carried > 0) {
      await sys.query(
        `insert into public.credit_transactions (org_id, wallet, kind, amount, period, note) values
           ($1, $2, 'rollover', $3, $4, $5), ($1, $2, 'rollover', $6, $7, $8)`,
        [orgId, wallet, -carried, q, `Carried to ${next}`, carried, next, `Carried over from ${q} (expires at the end of ${next})`],
      );
    }
    if (expired > 0) {
      await sys.query(`insert into public.credit_transactions (org_id, wallet, kind, amount, period, note) values ($1, $2, 'expiry', $3, $4, $5)`, [
        orgId, wallet, -expired, q, `Expired at the end of ${q}`,
      ]);
    }
  }
}

/** Close finished months (rollover) and ensure this period's video-credit grant exists (idempotent). System context only. */
export async function ensureGrant(sys: Sql, orgId: string, period = currentPeriod()) {
  const [org] = await sys.query<{ plan_id: string }>("select plan_id from public.organisations where id = $1", [orgId]);
  if (!org) return;
  const plan = getPlan(org.plan_id);
  const amount = plan?.videoCredits.amount ?? 0;
  if (!plan || amount <= 0) return;
  const once = plan.videoCredits.period === "once";
  // One-off allowances (Free) never roll over or expire.
  if (!once) await closeFinishedPeriods(sys, orgId, amount, period);
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

export async function getUsage(ctx: Ctx, now = new Date()) {
  const period = currentPeriod(now);
  await ctx.db.system((sys) => ensureGrant(sys, ctx.principal.orgId, period));
  return asUser(ctx, async (sql) => {
    const [org] = await sql.query<{ plan_id: string }>("select plan_id from public.organisations where id = $1", [ctx.principal.orgId]);
    if (!org) throw new AppError("forbidden", "Workspace not available");
    const plan = getPlan(org.plan_id);
    const once = plan?.videoCredits.period === "once";
    const sums = await sql.query<{ wallet: string; kind: string; total: number }>(
      `select wallet, kind, sum(amount)::int as total from public.credit_transactions
        where org_id = $1 and (period = $2 or ($3 and wallet = 'video')) group by wallet, kind`,
      [ctx.principal.orgId, period, once],
    );
    const sum = (wallet: string, kind: string) => Number(sums.find((s) => s.wallet === wallet && s.kind === kind)?.total ?? 0);
    const videoGranted = sum("video", "grant") + Math.max(0, sum("video", "adjustment")) + sum("video", "refund");
    const videoUsed = -sum("video", "charge") || 0;
    // Holds still open, whichever month they were placed in (a render can finish next month).
    const [held] = await sql.query<{ n: number }>(
      `select coalesce(-sum(h.amount), 0)::int as n from public.credit_transactions h
        where h.org_id = $1 and h.wallet = 'video' and h.kind = 'hold'
          and not exists (select 1 from public.credit_transactions r where r.org_id = h.org_id and r.job_id = h.job_id and r.kind = 'release')`,
      [ctx.principal.orgId],
    );
    const videoHeld = Number(held.n);
    const available = await availableVideoCredits(sql, ctx.principal.orgId, org.plan_id, period);
    const carriedIn = once ? 0 : Math.max(0, sum("video", "rollover"));
    const allocation = plan?.videoCredits.amount ?? 0;
    // What happens to today's balance at the end of the month if nothing more is spent.
    const carriesForward = once ? 0 : Math.max(0, Math.min(available, sum("video", "grant"), allocation));
    const expiresAtPeriodEnd = once ? 0 : Math.max(0, available - carriesForward);
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
        carried_over: carriedIn,
        carries_forward_if_unused: carriesForward,
        expires_at_period_end: expiresAtPeriodEnd,
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
