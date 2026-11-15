import "server-only";
import type { Ctx } from "../context";
import { getUsage } from "../services/usage";
import type { AppContext } from "./session";

/* Shapes the shared services' results for the app chrome. No business rules here. */

export type UsageMeter = { id: string; label: string; value: string; pct: number };
export type NavData = {
  workspace: { name: string; initials: string; kind: string };
  user: { name: string; initials: string; email: string | null };
  planName: string;
  meters: UsageMeter[];
  usageLabel: string;
  workspaces: { id: string; name: string; current: boolean }[];
};

export const initials = (s: string) =>
  s
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("") || "?";

const pct = (used: number, total: number | null) => (total ? Math.max(0, Math.min(100, (used / total) * 100)) : 0);

export function usageMeters(u: Awaited<ReturnType<typeof getUsage>>): UsageMeter[] {
  const v = u.video_credits;
  const once = v.allowance_period === "once";
  return [
    { id: "videos", label: "Videos", value: v.allowance === null ? `${v.available} left` : `${v.available} of ${v.allowance} left${once ? "" : ""}`, pct: pct(v.available, v.allowance) },
    { id: "analysis", label: "Media analysis", value: u.analysis_minutes.allowance === null ? `${u.analysis_minutes.used} min` : `${u.analysis_minutes.used} of ${u.analysis_minutes.allowance} min`, pct: pct(u.analysis_minutes.used, u.analysis_minutes.allowance) },
    { id: "storage", label: "Storage", value: u.storage_gb.allowance === null ? `${u.storage_gb.used.toFixed(2)} GB` : `${u.storage_gb.used.toFixed(2)} of ${u.storage_gb.allowance} GB`, pct: pct(u.storage_gb.used, u.storage_gb.allowance) },
  ];
}

export async function navData(c: AppContext, ctx: Ctx = c.ctx): Promise<NavData> {
  const usage = await getUsage(ctx);
  const ws = c.memberships.find((m) => m.org_id === ctx.principal.orgId)!;
  const name = c.user.displayName ?? c.user.email ?? "You";
  return {
    workspace: { name: ws.name, initials: initials(ws.name), kind: `${ws.role[0]!.toUpperCase()}${ws.role.slice(1)} · ${usage.plan.name}` },
    user: { name, initials: initials(name), email: c.user.email },
    planName: usage.plan.name,
    meters: usageMeters(usage),
    usageLabel: usage.video_credits.allowance_period === "once" ? "Trial credits" : `This month`,
    workspaces: c.memberships.map((m) => ({ id: m.org_id, name: m.name, current: m.org_id === ctx.principal.orgId })),
  };
}
