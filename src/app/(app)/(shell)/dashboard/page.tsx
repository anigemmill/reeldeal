import type { Metadata } from "next";
import { Suspense } from "react";
import { DashboardScreen, type DashboardData } from "@/components/app/dashboard/dashboard-screen";
import { PageLoading } from "@/components/app/page-loading";
import { briefSuggestions } from "@/content/briefs";
import { requireAppContext } from "@/server/app/session";
import { usageFor, usageMeters } from "@/server/app/view";
import { listBrands } from "@/server/services/brands";
import { listMediaActivity, mediaThumbnails, searchMedia } from "@/server/services/media";
import { listProjects } from "@/server/services/projects";
import { listExports } from "@/server/services/render";
import { getMyWorkspace } from "@/server/services/workspace";
import { getOnboardingState } from "@/server/services/workspace-settings";

export const metadata: Metadata = { title: "Home" };

async function Dashboard({ searchParams }: PageProps<"/dashboard">) {
  const { ctx, user } = await requireAppContext("/dashboard");
  const q = await searchParams;
  const [ws, brands, usage, projects, activity, best, exp, onboarding] = await Promise.all([
    getMyWorkspace(ctx),
    listBrands(ctx),
    usageFor(ctx),
    listProjects(ctx, { limit: 5 }),
    listMediaActivity(ctx, { limit: 5 }),
    searchMedia(ctx, { kind: "video", status: "ready", sort: "best_quality", limit: 4 }, { includeThumbnails: true }),
    listExports(ctx, { limit: 5 }),
    getOnboardingState(ctx, ctx.principal.userId, ctx.principal.orgId).catch(() => null),
  ]);
  const thumbs = await mediaThumbnails(ctx, projects.projects.map((p) => p.cover_media_id).filter((x): x is string => Boolean(x)));
  const brand = brands.brands[0] ?? null;
  // A failed render that was later re-rendered successfully is no longer news.
  const failed = exp.failed_renders.filter((f) => !exp.exports.some((e) => e.project_id === f.project_id && e.created_at && f.finished_at && e.created_at > f.finished_at));
  const data: DashboardData = {
    greetingName: user.displayName,
    workspace: { name: ws.organisation.name, plan: ws.plan.name },
    brand: brand ? { id: brand.id, name: brand.name, industry: brand.industry } : null,
    brandCount: brands.brands.length,
    meters: usageMeters(usage),
    credits: {
      available: usage.video_credits.available,
      held: usage.video_credits.held_for_renders_in_progress,
      allowanceLabel: usage.video_credits.allowance_period === "once" ? `${usage.plan.name} plan trial` : `${usage.video_credits.allowance ?? "custom"} a month`,
    },
    counts: { media: ws.contents.media, projects: ws.contents.projects },
    projects: projects.projects.map((p) => ({ id: p.id, name: p.name, status: p.status, format: p.latest_format ?? p.formats[0] ?? null, duration_seconds: p.duration_seconds, updated_at: p.updated_at, thumbnail: p.cover_media_id ? (thumbs[p.cover_media_id] ?? null) : null })),
    activity: activity.items.filter((a) => a.status !== "ready" || a.analysis?.status === "running").slice(0, 4),
    moments: best.results.map((m) => ({ id: m.id, title: m.title, quality_score: m.quality_score, thumbnail_url: (m as { thumbnail_url?: string | null }).thumbnail_url })),
    exports: exp.exports.slice(0, 4),
    failedRenders: failed,
    history: usage.recent_transactions,
    suggestions: briefSuggestions(brand?.industry),
    welcome: q.welcome === "1",
    setup:
      onboarding?.stage === "setup" && onboarding.next_step && onboarding.next_step !== "done"
        ? { step: onboarding.next_step, label: ({ business: "business details", brand: "your brand", assets: "logo and assets", preferences: "preferences" } as Record<string, string>)[onboarding.next_step] ?? "setup" }
        : null,
  };
  return <DashboardScreen data={data} />;
}

export default function DashboardPage(props: PageProps<"/dashboard">) {
  return (
    <Suspense fallback={<PageLoading label="Loading your dashboard" />}>
      <Dashboard {...props} />
    </Suspense>
  );
}
