"use client";

import { ArrowLeft, Clapperboard } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { newStudioProject } from "@/app/(app)/_actions/studio";
import { Thumb } from "@/components/app/media/thumb";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { SegmentedControl } from "@/components/ui/tabs";
import { relativeTime } from "@/lib/format";

/* Choose a project to open in Studio, or start an empty one. */
export function StudioPicker({ projects, canEdit }: { projects: { id: string; name: string; status: string; updated_at: string | null; thumbnail: string | null; format: string | null }[]; canEdit: boolean }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [format, setFormat] = useState<"9:16" | "1:1" | "16:9" | "4:5">("9:16");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="mode-studio min-h-dvh bg-bg text-ink">
      <main id="main" className="mx-auto flex w-full max-w-[1100px] flex-col gap-8 px-4 py-8 sm:px-6">
        <div className="flex items-center gap-3">
          <Link href="/dashboard" aria-label="Back to dashboard" className="inline-flex size-9 items-center justify-center rounded-[10px] bg-surface hover:bg-surface-muted">
            <ArrowLeft className="size-4" aria-hidden />
          </Link>
          <h1 className="font-display text-3xl font-semibold tracking-tight">Studio</h1>
        </div>
        <section aria-labelledby="new-h" className="flex flex-col gap-4 rounded-xl bg-surface p-5">
          <h2 id="new-h" className="font-display text-lg font-semibold">
            New project
          </h2>
          <form
            className="flex flex-wrap items-end gap-3"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              const r = await newStudioProject(name, format);
              setBusy(false);
              if (!r.ok) return setError(r.error.message);
              router.push(`/studio?project=${r.data.project_id}`);
            }}
          >
            <Field label="Name" className="min-w-[240px] flex-1">
              <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={160} placeholder="Summer reel" />
            </Field>
            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">Format</span>
              <SegmentedControl label="Format" value={format} onValueChange={(v) => setFormat(v as typeof format)} options={["9:16", "1:1", "16:9", "4:5"].map((f) => ({ value: f, label: f }))} />
            </div>
            <Button type="submit" variant="primary" loading={busy} disabled={!canEdit}>
              Create and open
            </Button>
          </form>
          {error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}
        </section>
        <section aria-labelledby="open-h" className="flex flex-col gap-3">
          <h2 id="open-h" className="font-display text-lg font-semibold">
            Open a project
          </h2>
          {projects.length ? (
            <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
              {projects.map((p) => (
                <li key={p.id}>
                  <Link href={`/studio?project=${p.id}`} className="group flex flex-col gap-2">
                    <Thumb src={p.thumbnail} alt="" ratio="4:5" className="rounded-lg" />
                    <span className="truncate text-sm font-medium group-hover:underline">{p.name}</span>
                    <span className="font-mono text-[11px] text-ink-muted">
                      {p.format ?? "no storyboard"} · {relativeTime(p.updated_at)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="flex items-center gap-2 text-ink-muted">
              <Clapperboard className="size-4" aria-hidden /> No projects yet. Create one above, or start with <Link href="/autopilot" className="underline">Autopilot</Link>.
            </p>
          )}
        </section>
      </main>
    </div>
  );
}
