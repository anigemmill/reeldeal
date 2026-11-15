import type { Metadata } from "next";
import { Suspense } from "react";
import { LibraryScreen, type LibraryItem } from "@/components/app/library/library-screen";
import { PageLoading } from "@/components/app/page-loading";
import { requireAppContext } from "@/server/app/session";
import { usageFor } from "@/server/app/view";
import { permissionsFor } from "@/server/auth/principal";
import { listMediaActivity, searchMedia } from "@/server/services/media";
import { getMyWorkspace } from "@/server/services/workspace";

export const metadata: Metadata = { title: "Library" };

async function Library({ searchParams }: PageProps<"/library">) {
  const { ctx } = await requireAppContext("/library");
  const q = await searchParams;
  const [ws, first, activity, usage] = await Promise.all([
    getMyWorkspace(ctx),
    searchMedia(ctx, { sort: "newest", limit: 48 }, { includeThumbnails: true }),
    listMediaActivity(ctx, { limit: 20 }),
    usageFor(ctx),
  ]);
  const perms = permissionsFor(ctx.principal);
  return (
    <LibraryScreen
      initial={first.results as LibraryItem[]}
      hasMore={first.has_more}
      total={ws.contents.media}
      activity={activity.items}
      canEdit={perms.can_create_and_edit}
      canManage={perms.can_manage_workspace}
      aiConsent={ws.organisation.ai_media_analysis_consent}
      aiConfigured={Boolean(ctx.ai)}
      analysis={{ usedMinutes: usage.analysis_minutes.used, allowanceMinutes: usage.analysis_minutes.allowance }}
      initialMedia={typeof q.media === "string" ? q.media : null}
    />
  );
}

export default function LibraryPage(props: PageProps<"/library">) {
  return (
    <Suspense fallback={<PageLoading label="Loading your library" />}>
      <Library {...props} />
    </Suspense>
  );
}
