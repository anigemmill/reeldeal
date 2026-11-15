import type { Metadata } from "next";
import { Suspense } from "react";
import { AutopilotScreen } from "@/components/app/autopilot/autopilot-screen";
import { PageLoading } from "@/components/app/page-loading";
import { requireAppContext } from "@/server/app/session";
import { usageFor } from "@/server/app/view";
import { permissionsFor } from "@/server/auth/principal";
import { listBrands } from "@/server/services/brands";
import { searchMedia } from "@/server/services/media";

export const metadata: Metadata = { title: "Autopilot" };

// Focus mode: Autopilot sits outside the sidebar shell.
async function Autopilot({ searchParams }: PageProps<"/autopilot">) {
  const q = await searchParams;
  const { ctx } = await requireAppContext("/autopilot");
  const [brands, footage, usage] = await Promise.all([listBrands(ctx), searchMedia(ctx, { kind: "video", status: "ready", sort: "newest", limit: 24 }, { includeThumbnails: true }), usageFor(ctx)]);
  const str = (v: unknown) => (typeof v === "string" ? v : null);
  const uuid = (v: string | null) => (v && /^[0-9a-f-]{36}$/.test(v) ? v : null);
  return (
    <AutopilotScreen
      ai={{ configured: Boolean(ctx.ai), provider: ctx.ai?.name ?? null, fixture: Boolean(ctx.ai?.name.startsWith("fixture")) }}
      brands={brands.brands.map((b) => ({ id: b.id, name: b.name, industry: b.industry }))}
      footage={footage.results.map((f) => ({ id: f.id, title: f.title, duration_seconds: f.duration_seconds, thumbnail_url: (f as { thumbnail_url?: string | null }).thumbnail_url }))}
      credits={{ available: usage.video_credits.available, label: usage.video_credits.allowance_period === "once" ? "Trial credits" : "This month" }}
      canEdit={permissionsFor(ctx.principal).can_create_and_edit}
      initial={{ brief: (str(q.brief) ?? "").slice(0, 2000), mediaId: uuid(str(q.media)), projectId: uuid(str(q.project)) }}
    />
  );
}

export default function AutopilotPage(props: PageProps<"/autopilot">) {
  return (
    <Suspense fallback={<PageLoading label="Opening Autopilot" />}>
      <Autopilot {...props} />
    </Suspense>
  );
}
