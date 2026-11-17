import { z } from "zod";
import { getPlan, pricing } from "@/lib/pricing";
import { asUser, iso, type Ctx } from "../context";
import { parseInput } from "../errors";
import { getUsage } from "./usage";

/*
  Settings → Usage and billing (screen: src/components/app/settings/billing-screen.tsx).
  Everything here is REAL account data: the plan comes from organisations.plan_id and
  config/pricing.json, balances and history from the credit ledger (credit_transactions,
  written only by trusted server code), seats and brands from the workspace.
  Subscription details come from billing_accounts (migration 20261118000001), which Stripe
  webhooks will write in the billing stage. Until a row exists the overview says billing is
  unavailable: no status, card, invoice or renewal date is ever invented.
*/
export type BillingOverview = Awaited<ReturnType<typeof getBillingOverview>>;

export async function getBillingOverview(ctx: Ctx) {
  const usage = await getUsage(ctx);
  return asUser(ctx, async (sql) => {
    const [org] = await sql.query<{ plan_id: string }>("select plan_id from public.organisations where id = $1", [ctx.principal.orgId]);
    const plan = getPlan(org!.plan_id);
    const [counts] = await sql.query<{ members: number; invites: number; brands: number; renders: number; analysed_media: number }>(
      `select (select count(*) from public.memberships where org_id = $1)::int as members,
              (select count(*) from public.invitations where org_id = $1 and accepted_at is null and revoked_at is null and expires_at > now())::int as invites,
              (select count(*) from public.brand_profiles where org_id = $1)::int as brands,
              (select count(*) from public.jobs where org_id = $1 and kind = 'render' and status = 'succeeded' and created_at >= date_trunc('month', now()))::int as renders,
              (select count(*) from public.jobs where org_id = $1 and kind = 'media_analysis' and status = 'succeeded' and created_at >= date_trunc('month', now()))::int as analysed_media`,
      [ctx.principal.orgId],
    );
    // RLS: only the owner can read the billing record. Others see the plan and usage, not payment details.
    const [acct] = await sql.query<{
      subscription_status: string; plan_id: string | null; billing_interval: string | null; current_period_start: string | null;
      current_period_end: string | null; cancel_at_period_end: boolean; billing_email: string | null;
    }>("select subscription_status, plan_id, billing_interval, current_period_start, current_period_end, cancel_at_period_end, billing_email from public.billing_accounts where org_id = $1", [ctx.principal.orgId]);
    const live = Boolean(acct && acct.subscription_status !== "none");
    return {
      currency: pricing.currency,
      plan: {
        id: org!.plan_id,
        name: plan?.name ?? org!.plan_id,
        price_monthly: plan?.priceMonthly ?? null,
        price_annual: plan?.priceAnnual ?? null,
        video_credits: plan?.videoCredits.amount ?? null,
        video_credits_period: plan?.videoCredits.period ?? null,
        analysis_minutes: plan?.analysisMinutes ?? null,
        storage_gb: plan?.storageGB ?? null,
        brand_profiles: plan?.brandProfiles ?? null,
        seats: plan?.users ?? null,
      },
      usage: {
        period: usage.period,
        video_credits: usage.video_credits,
        analysis_minutes: usage.analysis_minutes,
        storage_gb: usage.storage_gb,
        brand_profiles: counts!.brands,
        seats: counts!.members + counts!.invites,
        renders_this_month: counts!.renders,
        media_analysed_this_month: counts!.analysed_media,
      },
      billing: live
        ? {
            available: true as const,
            status: acct!.subscription_status,
            interval: acct!.billing_interval,
            current_period_start: iso(acct!.current_period_start),
            current_period_end: iso(acct!.current_period_end),
            cancel_at_period_end: acct!.cancel_at_period_end,
            billing_email: acct!.billing_email,
          }
        : {
            available: false as const,
            reason: ctx.principal.role !== "owner"
              ? "Only the workspace owner sees subscription and payment details."
              : plan?.id === "free" ? "Every workspace is on the Free plan until paid plans can be bought online." : "This workspace's plan was set by Reeldeal; online billing isn't available yet.",
          },
      notes: usage.notes,
    };
  });
}

const HistoryInput = z.object({ wallet: z.enum(["video", "analysis", "ai_generation"]).optional(), before: z.iso.datetime().optional(), limit: z.number().int().min(1).max(100).optional() });

/** The ledger, newest first, with paging. Every row is a real transaction. */
export async function getUsageHistory(ctx: Ctx, raw: z.input<typeof HistoryInput> = {}) {
  const i = parseInput(HistoryInput, raw);
  const limit = i.limit ?? 25;
  const rows = await asUser(ctx, (sql) =>
    sql.query<{ created_at: string; wallet: string; kind: string; amount: number; note: string | null; job_id: string | null }>(
      `select created_at, wallet, kind, amount, note, job_id from public.credit_transactions
        where org_id = $1 and ($2::text is null or wallet = $2) and ($3::timestamptz is null or created_at < $3)
        order by created_at desc limit $4`,
      [ctx.principal.orgId, i.wallet ?? null, i.before ?? null, limit + 1],
    ),
  );
  const page = rows.slice(0, limit);
  return {
    entries: page.map((r) => ({ at: iso(r.created_at), wallet: r.wallet, kind: r.kind, amount: Number(r.amount), note: r.note, job_id: r.job_id })),
    next_before: rows.length > limit ? iso(page[page.length - 1]!.created_at) : null,
  };
}
