import { getPlan } from "@/lib/pricing";
import { asUser, iso, type Ctx } from "../context";
import { permissionsFor } from "../auth/principal";
import { AppError } from "../errors";
import { getUsage } from "./usage";

/** The caller's workspace: organisation, role and permissions, plan and credits. Only their own data. */
export async function getMyWorkspace(ctx: Ctx) {
  const data = await asUser(ctx, async (sql) => {
    const [org] = await sql.query<{ id: string; name: string; slug: string; plan_id: string; ai_media_analysis_consent: boolean; created_at: string }>(
      "select id, name, slug, plan_id, ai_media_analysis_consent, created_at from public.organisations where id = $1",
      [ctx.principal.orgId],
    );
    if (!org) throw new AppError("forbidden", "Workspace not available");
    const others = await sql.query<{ id: string; name: string; role: string }>(
      `select o.id, o.name, m.role from public.memberships m join public.organisations o on o.id = m.org_id
        where m.user_id = $1 order by o.name`,
      [ctx.principal.userId],
    );
    const [counts] = await sql.query<{ brands: number; media: number; projects: number }>(
      `select (select count(*) from public.brand_profiles where org_id = $1)::int as brands,
              (select count(*) from public.media_assets where org_id = $1)::int as media,
              (select count(*) from public.projects where org_id = $1)::int as projects`,
      [org.id],
    );
    return { org, others, counts };
  });
  const usage = await getUsage(ctx);
  const plan = getPlan(data.org.plan_id);
  return {
    organisation: {
      id: data.org.id,
      name: data.org.name,
      slug: data.org.slug,
      created_at: iso(data.org.created_at),
      ai_media_analysis_consent: data.org.ai_media_analysis_consent,
    },
    connection: { authenticated_via: ctx.principal.via === "pat" ? "personal access token" : "OAuth" },
    permissions: permissionsFor(ctx.principal),
    plan: plan
      ? { id: plan.id, name: plan.name, video_credits_per_period: plan.videoCredits.amount, brand_profiles: plan.brandProfiles ?? null, users: plan.users ?? null }
      : { id: data.org.plan_id, name: data.org.plan_id },
    credits: usage.video_credits,
    contents: data.counts,
    other_workspaces: data.others.filter((o) => o.id !== data.org.id).map((o) => ({ id: o.id, name: o.name, role: o.role })),
  };
}
