import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Thumb } from "@/components/app/media/thumb";
import { PageLoading } from "@/components/app/page-loading";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { relativeTime } from "@/lib/format";
import { requireAppContext } from "@/server/app/session";
import { mediaThumbnails } from "@/server/services/media";
import { listProjects } from "@/server/services/projects";

export const metadata: Metadata = { title: "Projects" };

const LABEL: Record<string, string> = { draft: "Draft", storyboarding: "Needs footage", ready_to_render: "Ready to render", rendering: "Rendering", completed: "Video ready", archived: "Archived" };

async function Projects() {
  const { ctx } = await requireAppContext("/projects");
  const list = await listProjects(ctx, { limit: 50 });
  const thumbs = await mediaThumbnails(ctx, list.projects.map((p) => p.cover_media_id).filter((x): x is string => Boolean(x)));
  return (
    <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-6 px-4 py-6 sm:px-6 lg:px-10 lg:py-9">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="font-display text-[32px] font-semibold tracking-[-0.03em]">Projects</h1>
        <div className="flex gap-2">
          <Button asChild variant="secondary">
            <Link href="/studio">New in Studio</Link>
          </Button>
          <Button asChild variant="action">
            <Link href="/autopilot">New with Autopilot</Link>
          </Button>
        </div>
      </header>
      {list.projects.length ? (
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {list.projects.map((p) => (
            <li key={p.id} className="flex flex-col gap-2">
              <Link href={`/studio?project=${p.id}`} className="group flex flex-col gap-2">
                <Thumb src={p.cover_media_id ? thumbs[p.cover_media_id] : null} alt="" ratio="4:5" className="rounded-lg">
                  <span className="absolute top-2 left-2">
                    <Badge tone={p.status === "completed" ? "success" : p.status === "rendering" ? "ai" : "neutral"}>{LABEL[p.status] ?? p.status}</Badge>
                  </span>
                </Thumb>
                <span className="truncate text-sm font-medium group-hover:underline">{p.name}</span>
              </Link>
              <span className="font-mono text-[11px] text-ink-muted">
                {p.latest_format ?? "no storyboard"} · {p.storyboard_count} version{p.storyboard_count === 1 ? "" : "s"} · {relativeTime(p.updated_at)}
              </span>
              <Link href={`/autopilot?project=${p.id}`} className="text-xs text-link underline-offset-4 hover:underline">
                Review in Autopilot
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-xl border border-line bg-surface px-5 py-8 text-center text-ink-muted">No projects yet. Start with Autopilot: describe the video in a sentence.</p>
      )}
    </div>
  );
}

export default function ProjectsPage() {
  return (
    <Suspense fallback={<PageLoading label="Loading projects" />}>
      <Projects />
    </Suspense>
  );
}
