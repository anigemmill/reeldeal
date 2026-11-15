import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PageLoading } from "@/components/app/page-loading";
import { StudioPicker } from "@/components/app/studio/studio-picker";
import { StudioWorkspace } from "@/components/app/studio/studio-workspace";
import { requireAppContext } from "@/server/app/session";
import { permissionsFor } from "@/server/auth/principal";
import { AppError } from "@/server/errors";
import { getBrand } from "@/server/services/brands";
import { mediaThumbnails, searchMedia } from "@/server/services/media";
import { getProject, listProjects } from "@/server/services/projects";

export const metadata: Metadata = { title: "Studio" };

// Full-screen editor: outside the sidebar shell.
async function Studio({ searchParams }: PageProps<"/studio">) {
  const q = await searchParams;
  const { ctx, memberships } = await requireAppContext("/studio");
  const canEdit = permissionsFor(ctx.principal).can_create_and_edit;
  const id = typeof q.project === "string" && /^[0-9a-f-]{36}$/.test(q.project) ? q.project : null;
  if (!id) {
    const list = await listProjects(ctx, { limit: 30 });
    const thumbs = await mediaThumbnails(ctx, list.projects.map((p) => p.cover_media_id).filter((x): x is string => Boolean(x)));
    return <StudioPicker canEdit={canEdit} projects={list.projects.map((p) => ({ id: p.id, name: p.name, status: p.status, updated_at: p.updated_at, format: p.latest_format ?? null, thumbnail: p.cover_media_id ? (thumbs[p.cover_media_id] ?? null) : null }))} />;
  }
  const project = await getProject(ctx, id).catch((e) => {
    if (e instanceof AppError && e.code === "not_found") notFound();
    throw e;
  });
  const scenes = (project.storyboard?.scenes ?? []) as { asset_id: string | null }[];
  const [thumbnails, library, brand] = await Promise.all([
    mediaThumbnails(ctx, [...scenes.map((s) => s.asset_id), ...project.media.map((m) => m.id)].filter((x): x is string => Boolean(x))),
    searchMedia(ctx, { kind: "video", status: "ready", sort: "newest", limit: 30 }, { includeThumbnails: true }),
    project.brand ? getBrand(ctx, project.brand.id).catch(() => null) : null,
  ]);
  return (
    <StudioWorkspace
      key={project.id}
      initial={{ project, thumbnails }}
      library={library.results as never}
      brand={brand ? { name: (brand as { name: string }).name, colours: ((brand as { colours?: { name: string; hex: string }[] }).colours ?? []), typography: ((brand as { typography?: { headings?: string; body?: string } }).typography ?? null) } : null}
      workspaceName={memberships.find((m) => m.org_id === ctx.principal.orgId)?.name ?? ""}
      canEdit={canEdit}
      aiConfigured={Boolean(ctx.ai)}
    />
  );
}

export default function StudioPage(props: PageProps<"/studio">) {
  return (
    <Suspense fallback={<PageLoading label="Opening Studio" />}>
      <Studio {...props} />
    </Suspense>
  );
}
