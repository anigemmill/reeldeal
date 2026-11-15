"use client";

import { ArrowDown, ArrowLeft, ArrowUp, Monitor, Pause, Play, Plus, Redo2, Search, Smartphone, Sparkles, Square, Trash2, Undo2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { projectState, saveScenes, writeStoryboard } from "@/app/(app)/_actions/creative";
import { searchLibrary } from "@/app/(app)/_actions/media";
import { exportDownload } from "@/app/(app)/_actions/render";
import { loadVersion, restoreVersion, scenePreviews } from "@/app/(app)/_actions/studio";
import { Thumb } from "@/components/app/media/thumb";
import { RenderPanel } from "@/components/app/render/render-panel";
import { LogoMark } from "@/components/brand/logo";
import { AiBadge, Badge } from "@/components/ui/badge";
import { Button, IconButton } from "@/components/ui/button";
import { Modal } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input, Textarea } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/components/ui/toast";
import { duration, relativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";

/*
  Studio on real project data (layout from design/app/A-Studio.dc.html, Dark Studio).
  The timeline is the project's storyboard; the preview plays the actual source
  clips scene by scene, or the rendered MP4. Edits are kept as a draft and saved as a
  new storyboard version (versions are never overwritten). The assistant revises
  through the shared creative service. Not built yet, and shown disabled: cutting
  inside clips, music, voice-over recording, captions, colour, undo, review links.
*/

type Scene = { scene_number?: number; duration_seconds: number; purpose: string | null; on_screen_text: string | null; voiceover: string | null; visual_description: string | null; asset_id: string | null; asset_title?: string; source_in_seconds: number | null; transition: "cut" | "dissolve" | "fade"; audio_notes: string | null };
type State = Extract<Awaited<ReturnType<typeof projectState>>, { ok: true }>["data"];
type LibItem = { id: string; title: string; duration_seconds: number | null; thumbnail_url?: string | null; status: string; kind: string };
type Brand = { name: string; colours: { name: string; hex: string }[]; typography: { headings?: string; body?: string } | null } | null;

const RATIO_CSS: Record<string, string> = { "9:16": "9 / 16", "1:1": "1 / 1", "16:9": "16 / 9", "4:5": "4 / 5" };
const panelTab = "h-8 flex-1 rounded-[8px] border-0 px-2 text-xs data-[state=active]:bg-surface-muted";
const tc = (t: number) => `${String(Math.floor(t / 60)).padStart(2, "0")}:${(t % 60).toFixed(1).padStart(4, "0")}`;

export function StudioWorkspace({ initial, library, brand, workspaceName, canEdit, aiConfigured }: { initial: State; library: LibItem[]; brand: Brand; workspaceName: string; canEdit: boolean; aiConfigured: boolean }) {
  const router = useRouter();
  const [state, setState] = useState(initial);
  const project = state.project;
  const saved = project.storyboard;
  const [viewing, setViewing] = useState<{ id: string; version: number; title: string; format: string; scenes: Scene[]; created_at: string | null } | null>(null);
  const base = viewing ?? (saved ? { id: saved.id, version: saved.version, title: saved.title, format: saved.format, scenes: saved.scenes as Scene[], created_at: saved.created_at } : null);
  const [draft, setDraft] = useState<Scene[]>((base?.scenes ?? []) as Scene[]);
  const [title, setTitle] = useState(base?.title ?? project.name);
  const format = (base?.format ?? project.formats[0] ?? "9:16") as "9:16" | "1:1" | "16:9" | "4:5";
  const dirty = JSON.stringify(draft) !== JSON.stringify(base?.scenes ?? []) || title !== (base?.title ?? project.name);
  const [selected, setSelected] = useState<number | null>(draft.length ? 0 : null);
  const [tab, setTab] = useState<"assistant" | "inspector" | "versions">("inspector");
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [previews, setPreviews] = useState<Record<string, string | null>>({});
  const [thumbs, setThumbs] = useState<Record<string, string | null>>({ ...state.thumbnails, ...Object.fromEntries(library.map((l) => [l.id, l.thumbnail_url ?? null])) });
  const [saving, setSaving] = useState(false);
  const [showRender, setShowRender] = useState(false);
  const [mode, setMode] = useState<"scenes" | "rendered">("scenes");

  const total = draft.reduce((a, s) => a + s.duration_seconds, 0);
  const starts = useMemo(() => draft.reduce<number[]>((acc, s, i) => (acc.push(i === 0 ? 0 : acc[i - 1]! + draft[i - 1]!.duration_seconds), acc), []), [draft]);
  const sceneAt = (t: number) => Math.max(0, starts.findLastIndex((s) => t >= s));
  const current = draft.length ? (playing || selected === null ? sceneAt(time) : selected) : -1;
  const scene = current >= 0 ? draft[current] : null;
  const latestExport = (project.exports as { id: string; status: string; job_id: string }[]).find((e) => e.status === "ready");
  const lastRender = project.renders[0] as { job_id: string; status: string; stage: string | null; progress_percent: number; error: { message: string; retryable: boolean } | null } | undefined;

  const reload = useCallback(async () => {
    const r = await projectState(project.id);
    if (!r.ok) return toast({ title: "Couldn't refresh the project", description: r.error.message, tone: "danger" });
    setState(r.data);
    setThumbs((t) => ({ ...t, ...r.data.thumbnails }));
    setViewing(null);
    const sb = r.data.project.storyboard;
    setDraft((sb?.scenes ?? []) as Scene[]);
    setTitle(sb?.title ?? r.data.project.name);
    router.refresh();
  }, [project.id, router]);

  // Signed links for the clips used in the draft (fetched when the set of clips changes).
  const assetKey = [...new Set(draft.map((s) => s.asset_id).filter(Boolean))].sort().join(",");
  useEffect(() => {
    const missing = assetKey.split(",").filter((id) => id && !(id in previews));
    if (!missing.length) return;
    let live = true;
    scenePreviews(missing).then((r) => live && r.ok && setPreviews((p) => ({ ...p, ...r.data })));
    return () => {
      live = false;
    };
  }, [assetKey, previews]);

  // Playback clock (scene preview mode).
  const last = useRef(0);
  useEffect(() => {
    if (!playing || mode !== "scenes") return;
    let raf = 0;
    last.current = performance.now();
    const frame = (now: number) => {
      const dt = (now - last.current) / 1000;
      last.current = now;
      setTime((t) => (t + dt >= total ? (setPlaying(false), 0) : t + dt));
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [playing, total, mode]);

  const seek = (t: number) => setTime(Math.max(0, Math.min(Math.max(0, total - 0.01), t)));
  const update = (i: number, patch: Partial<Scene>) => setDraft((d) => d.map((s, k) => (k === i ? { ...s, ...patch } : s)));
  const move = (i: number, by: number) => setDraft((d) => {
    const j = i + by;
    if (j < 0 || j >= d.length) return d;
    const n = [...d];
    [n[i], n[j]] = [n[j]!, n[i]!];
    setSelected(j);
    return n;
  });
  const addScene = (assetId: string | null, assetTitle?: string) => {
    setDraft((d) => [...d, { duration_seconds: 3, purpose: null, on_screen_text: assetId ? null : "Your text", voiceover: null, visual_description: assetTitle ?? null, asset_id: assetId, asset_title: assetTitle, source_in_seconds: assetId ? 0 : null, transition: "cut", audio_notes: null }]);
    setSelected(draft.length);
    setTab("inspector");
  };

  const save = async () => {
    setSaving(true);
    const r = await saveScenes({
      project_id: project.id,
      title,
      format,
      scenes: draft.map((s) => ({ duration_seconds: s.duration_seconds, purpose: s.purpose ?? undefined, on_screen_text: s.on_screen_text || null, voiceover: s.voiceover || null, visual_description: s.visual_description ?? undefined, asset_id: s.asset_id, source_in_seconds: s.asset_id ? (s.source_in_seconds ?? 0) : null, transition: s.transition, audio_notes: s.audio_notes })),
    });
    setSaving(false);
    if (!r.ok) return toast({ title: "Not saved", description: r.error.message, tone: "danger" });
    toast({ title: `Saved as version ${r.data.version}`, description: r.data.renderable ? "Ready to render." : "Some scenes still need footage or text.", tone: "success" });
    await reload();
  };

  return (
    <div className="mode-studio bg-bg text-ink">
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 p-6 text-center lg:hidden">
        <h1 className="font-display text-2xl font-semibold">Studio works best on a larger screen</h1>
        <p className="max-w-md text-ink-muted">The timeline editor needs a screen 1024px or wider. On your phone, Autopilot can revise this project for you.</p>
        <Button asChild variant="action">
          <Link href={`/autopilot?project=${project.id}`}>Open in Autopilot</Link>
        </Button>
      </div>

      <div className="hidden h-dvh min-h-[720px] flex-col text-[13px] lg:flex">
        <header className="flex items-center gap-3 border-b border-line px-4 py-2.5">
          <Link href="/dashboard" aria-label="Back to dashboard" className="inline-flex size-9 items-center justify-center rounded-[10px] bg-surface hover:bg-surface-muted">
            <ArrowLeft className="size-4" aria-hidden />
          </Link>
          <LogoMark className="size-[22px]" />
          <div className="flex min-w-0 flex-col">
            <h1 className="truncate text-sm font-semibold">{project.name}</h1>
            <span className="truncate text-[11px] text-ink-muted">
              {workspaceName} · {base ? `storyboard v${base.version}${viewing ? " (viewing an older version)" : ""} · saved ${relativeTime(base.created_at)}` : "no storyboard yet"}
              {dirty ? " · unsaved changes" : ""}
            </span>
          </div>
          <div className="flex-1" />
          <span className="inline-flex items-center gap-1.5 rounded-md border border-line px-2.5 py-1.5 font-mono text-xs" title="Format of this storyboard">
            {format === "16:9" ? <Monitor className="size-3.5" aria-hidden /> : format === "1:1" ? <Square className="size-3.5" aria-hidden /> : <Smartphone className="size-3.5" aria-hidden />}
            {format}
          </span>
          <IconButton label="Undo: not available yet. Every save is a version you can restore." variant="secondary" size="sm" disabled>
            <Undo2 aria-hidden />
          </IconButton>
          <IconButton label="Redo: not available yet" variant="secondary" size="sm" disabled>
            <Redo2 aria-hidden />
          </IconButton>
          {dirty ? (
            <>
              <Button variant="ghost" size="sm" onClick={() => (setDraft((base?.scenes ?? []) as Scene[]), setTitle(base?.title ?? project.name))}>
                Discard
              </Button>
              <Button variant="primary" size="sm" loading={saving} disabled={!canEdit || draft.length === 0} onClick={save}>
                Save as version {(project.storyboard_versions[0]?.version ?? 0) + 1}
              </Button>
            </>
          ) : null}
          <Button variant="action" size="sm" className="px-4" disabled={!saved || dirty || Boolean(viewing)} title={dirty ? "Save your changes first" : undefined} onClick={() => setShowRender(true)}>
            Render…
          </Button>
        </header>

        <div className="flex min-h-0 flex-1 gap-2 p-2">
          <MediaPanel
            initial={library}
            brand={brand}
            canEdit={canEdit}
            selectedScene={selected}
            onUse={(m) => {
              setThumbs((t) => ({ ...t, [m.id]: m.thumbnail_url ?? null }));
              if (selected !== null && draft[selected]) update(selected, { asset_id: m.id, asset_title: m.title, source_in_seconds: 0 });
              else addScene(m.id, m.title);
            }}
          />

          <section aria-label="Preview" className="flex min-w-0 flex-1 flex-col gap-3 rounded-xl bg-surface p-3.5">
            <div className="flex items-center gap-1.5" role="group" aria-label="Preview source">
              <button type="button" aria-pressed={mode === "scenes"} onClick={() => setMode("scenes")} className={cn("rounded-[8px] px-3 py-1.5", mode === "scenes" ? "bg-surface-muted font-semibold" : "text-ink-muted")}>
                Scene preview
              </button>
              <button type="button" aria-pressed={mode === "rendered"} disabled={!latestExport} onClick={() => (setPlaying(false), setMode("rendered"))} className={cn("rounded-[8px] px-3 py-1.5 disabled:opacity-50", mode === "rendered" ? "bg-surface-muted font-semibold" : "text-ink-muted")} title={latestExport ? "The most recent finished render of this project (may be from an earlier version)" : "No rendered video yet"}>
                Latest render
              </button>
            </div>
            <div className="flex min-h-0 flex-1 items-center justify-center rounded-lg bg-bg p-4">
              {mode === "rendered" && latestExport ? (
                <RenderedVideo exportId={latestExport.id} />
              ) : (
                <div className="relative isolate max-h-full max-w-full overflow-hidden rounded-md bg-primary" style={{ aspectRatio: RATIO_CSS[format], height: format === "16:9" ? "auto" : "100%", width: format === "16:9" ? "100%" : "auto" }}>
                  {scene ? <ScenePlayer scene={scene} src={scene.asset_id ? previews[scene.asset_id] : null} poster={scene.asset_id ? thumbs[scene.asset_id] : null} offset={time - (starts[current] ?? 0)} playing={playing} /> : null}
                  <span aria-hidden className="absolute inset-[6%] rounded border border-dashed border-on-media/30" />
                  {scene?.on_screen_text ? (
                    <p className="absolute inset-x-[8%] bottom-[13%] font-display text-[clamp(18px,2.2vw,28px)] leading-[1.02] font-bold tracking-[-0.02em] text-on-media [text-shadow:0_2px_14px_rgb(0_0_0/0.4)]">{scene.on_screen_text}</p>
                  ) : null}
                  {!scene ? <p className="absolute inset-0 flex items-center justify-center p-6 text-center text-on-media">Add a clip from the media panel, or ask the assistant to draft a storyboard.</p> : null}
                </div>
              )}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2.5">
              <span className="font-mono text-[13px] tabular-nums">
                {tc(time)} <span className="text-ink-muted">/ {tc(total)}</span>
              </span>
              <button type="button" disabled={!draft.length || mode !== "scenes"} onClick={() => (setSelected(null), setPlaying((p) => !p))} aria-label={playing ? "Pause" : "Play"} className="inline-flex size-11 items-center justify-center rounded-full bg-ink text-bg disabled:opacity-40">
                {playing ? <Pause className="size-4 fill-current" aria-hidden /> : <Play className="ml-0.5 size-4 fill-current" aria-hidden />}
              </button>
              <span className="text-[11px] text-ink-muted">{mode === "scenes" ? "Source clips, cut by the storyboard. The render adds transitions and brand cards." : "The most recent rendered MP4 of this project"}</span>
            </div>
          </section>

          <aside aria-label="Tools" className="flex w-[300px] shrink-0 flex-col overflow-hidden rounded-xl bg-surface p-3 xl:w-[340px]">
            <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)} className="flex min-h-0 flex-1 flex-col">
              <TabsList aria-label="Panel" className="gap-0.5 rounded-[10px] border-0 bg-bg p-[3px]">
                {(["assistant", "inspector", "versions"] as const).map((t) => (
                  <TabsTrigger key={t} value={t} className={cn(panelTab, "capitalize")}>
                    {t}
                  </TabsTrigger>
                ))}
              </TabsList>
              <TabsContent value="assistant" className="flex min-h-0 flex-1 flex-col pt-3">
                <Assistant projectId={project.id} baseId={!dirty && !viewing ? saved?.id : undefined} enabled={canEdit && aiConfigured} reason={!aiConfigured ? "AI isn't configured on this server." : !canEdit ? "Your role can't edit this project." : dirty || viewing ? "Save or discard your changes first." : null} onSaved={reload} />
              </TabsContent>
              <TabsContent value="inspector" className="min-h-0 flex-1 overflow-y-auto pt-3">
                <Inspector
                  scene={selected !== null ? draft[selected] : undefined}
                  index={selected}
                  count={draft.length}
                  title={title}
                  setTitle={setTitle}
                  canEdit={canEdit}
                  onChange={(p) => selected !== null && update(selected, p)}
                  onMove={(by) => selected !== null && move(selected, by)}
                  onDelete={() => selected !== null && (setDraft((d) => d.filter((_, k) => k !== selected)), setSelected(null))}
                  onAddText={() => addScene(null)}
                />
              </TabsContent>
              <TabsContent value="versions" className="min-h-0 flex-1 overflow-y-auto pt-3">
                <Versions
                  versions={project.storyboard_versions as { id: string; version: number; title: string; source: string; created_at: string | null }[]}
                  currentId={base?.id ?? null}
                  latestId={saved?.id ?? null}
                  canEdit={canEdit}
                  dirty={dirty}
                  onView={async (id) => {
                    if (id === saved?.id) return (setViewing(null), setDraft((saved?.scenes ?? []) as Scene[]), setTitle(saved?.title ?? project.name));
                    const r = await loadVersion(project.id, id);
                    if (!r.ok) return toast({ title: "Couldn't open that version", description: r.error.message, tone: "danger" });
                    setViewing({ id: r.data.id, version: r.data.version, title: r.data.title, format: r.data.format, scenes: r.data.scenes as Scene[], created_at: r.data.created_at });
                    setDraft(r.data.scenes as Scene[]);
                    setTitle(r.data.title);
                    setSelected(0);
                  }}
                  onRestore={async (id) => {
                    const r = await restoreVersion(project.id, id);
                    if (!r.ok) return toast({ title: "Not restored", description: r.error.message, tone: "danger" });
                    toast({ title: `Restored as version ${r.data.version}`, tone: "success" });
                    await reload();
                  }}
                />
              </TabsContent>
            </Tabs>
          </aside>
        </div>

        <Timeline scenes={draft} starts={starts} total={total} time={time} selected={selected} thumbs={thumbs} onSeek={(t) => (seek(t), setSelected(null))} onSelect={(i) => (setSelected(i), setPlaying(false), seek((starts[i] ?? 0) + 0.05), setTab("inspector"))} />
      </div>

      <Modal open={showRender} onOpenChange={setShowRender} title={`Render “${saved?.title ?? project.name}”`} description={saved ? `Storyboard v${saved.version} · ${duration(saved.total_duration_seconds)} · ${format}` : undefined}>
        {saved ? <RenderPanel key={saved.id} projectId={project.id} storyboardId={saved.id} renderable={(saved.scenes as Scene[]).every((s) => s.asset_id || s.on_screen_text)} canRender={canEdit} initialJob={lastRender && (lastRender.status === "queued" || lastRender.status === "running") ? lastRender : null} onFinished={reload} compact /> : null}
      </Modal>
    </div>
  );
}

/* Plays one scene's source clip from its in-point, kept in step with the timeline clock. */
function ScenePlayer({ scene, src, poster, offset, playing }: { scene: Scene; src: string | null | undefined; poster: string | null | undefined; offset: number; playing: boolean }) {
  const ref = useRef<HTMLVideoElement>(null);
  const target = (scene.source_in_seconds ?? 0) + Math.max(0, offset);
  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    if (Math.abs(v.currentTime - target) > 0.35) v.currentTime = target;
    if (playing) void v.play().catch(() => {});
    else v.pause();
  }, [target, playing, src]);
  if (!scene.asset_id) return null;
  if (!src) {
    // eslint-disable-next-line @next/next/no-img-element -- signed keyframe URL
    return poster ? <img src={poster} alt="" className="absolute inset-0 size-full object-cover" /> : null;
  }
  return <video ref={ref} src={src} poster={poster ?? undefined} muted playsInline preload="auto" className="absolute inset-0 size-full object-cover" aria-label={`Scene clip: ${scene.asset_title ?? "footage"}`} />;
}

function RenderedVideo({ exportId }: { exportId: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    exportDownload(exportId).then((r) => live && r.ok && setUrl(r.data.url));
    return () => {
      live = false;
    };
  }, [exportId]);
  return url ? <video src={url} controls className="max-h-full max-w-full rounded-md" aria-label="Rendered video" /> : <p className="text-ink-muted">Loading the rendered video…</p>;
}

/* ---- Media panel -------------------------------------------------------- */

function MediaPanel({ initial, brand, canEdit, selectedScene, onUse }: { initial: LibItem[]; brand: Brand; canEdit: boolean; selectedScene: number | null; onUse: (m: LibItem) => void }) {
  const [query, setQuery] = useState("");
  const [items, setItems] = useState(initial);
  const [focus, setFocus] = useState<string | null>(null);
  useEffect(() => {
    if (!query) return;
    let live = true;
    const t = setTimeout(async () => {
      const r = await searchLibrary({ query, kind: "video", limit: 24 });
      if (live && r.ok) setItems(r.data.results as LibItem[]);
    }, 300);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [query]);
  const shown = query ? items : initial;
  return (
    <aside aria-label="Media" className="flex w-[220px] shrink-0 flex-col gap-2.5 overflow-hidden rounded-xl bg-surface p-3 xl:w-[250px]">
      <Tabs defaultValue="media" className="flex min-h-0 flex-1 flex-col">
        <TabsList aria-label="Library" className="gap-0.5 border-0">
          <TabsTrigger value="media" className={panelTab}>
            Media
          </TabsTrigger>
          <TabsTrigger value="brand" className={panelTab}>
            Brand
          </TabsTrigger>
          <TabsTrigger value="audio" className={panelTab}>
            Audio
          </TabsTrigger>
        </TabsList>
        <TabsContent value="media" className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto pt-2.5">
          <label className="flex items-center gap-2 rounded-[10px] border border-line bg-bg px-2.5">
            <Search className="size-3.5 text-ink-muted" aria-hidden />
            <span className="sr-only">Search footage</span>
            <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search your footage" className="h-9 min-w-0 flex-1 bg-transparent text-xs text-ink outline-none placeholder:text-ink-muted" />
          </label>
          <p className="text-[11px] text-ink-muted">{selectedScene !== null ? `Choose a clip for scene ${selectedScene + 1}` : "Choose a clip to add a scene"}</p>
          <ul className="grid grid-cols-2 gap-2">
            {shown.filter((m) => m.kind === "video" && m.status === "ready").map((m) => (
              <li key={m.id}>
                <button type="button" disabled={!canEdit} onClick={() => (setFocus(m.id), onUse(m))} className={cn("block w-full text-left disabled:cursor-not-allowed", focus === m.id && "ring-2 ring-primary rounded-[9px]")}>
                  <span className="sr-only">{selectedScene !== null ? `Use in scene ${selectedScene + 1}: ` : "Add a scene with: "}</span>
                  <Thumb src={m.thumbnail_url} alt="" ratio="16:9" className="rounded-[9px]">
                    {m.duration_seconds ? <span className="absolute right-1 bottom-1 rounded-[4px] bg-media-veil/60 px-1 font-mono text-[9px] text-on-media">{duration(m.duration_seconds)}</span> : null}
                  </Thumb>
                  <p className="mt-1 truncate text-[11px] text-ink-muted">{m.title}</p>
                </button>
              </li>
            ))}
          </ul>
          {shown.length === 0 ? (
            <p className="text-xs text-ink-muted">
              {query ? `No analysed clips match “${query}”.` : "No analysed clips yet."}{" "}
              <Link href="/library" className="underline">
                Open the library
              </Link>
            </p>
          ) : null}
        </TabsContent>
        <TabsContent value="brand" className="flex flex-col gap-3 pt-3 text-xs">
          {brand ? (
            <>
              <p className="font-semibold">{brand.name}</p>
              {brand.colours.length ? (
                <div className="flex gap-1.5" aria-label="Brand colours">
                  {brand.colours.slice(0, 6).map((c) => (
                    <span key={c.hex} title={`${c.name} ${c.hex}`} className="h-8 flex-1 rounded-md border border-line" style={{ background: c.hex }} />
                  ))}
                </div>
              ) : (
                <p className="text-ink-muted">No brand colours yet.</p>
              )}
              {brand.typography?.headings ? <p className="text-ink-muted">Headings: {brand.typography.headings}</p> : null}
              <p className="text-ink-muted">The renderer uses the brand&apos;s first colour for text cards.</p>
            </>
          ) : (
            <p className="text-ink-muted">This project has no brand profile.</p>
          )}
        </TabsContent>
        <TabsContent value="audio" className="pt-3 text-xs text-ink-muted">
          Music and voice-over are not part of the renderer yet: rendered videos have a silent audio track. Voiceover lines in scenes are script notes only.
        </TabsContent>
      </Tabs>
    </aside>
  );
}

/* ---- Inspector, assistant, versions --------------------------------------- */

function Inspector(props: { scene: Scene | undefined; index: number | null; count: number; title: string; setTitle: (t: string) => void; canEdit: boolean; onChange: (p: Partial<Scene>) => void; onMove: (by: number) => void; onDelete: () => void; onAddText: () => void }) {
  const { scene: s, index, canEdit } = props;
  return (
    <div className="flex flex-col gap-3.5">
      <Field label="Storyboard title">
        <Input value={props.title} onChange={(e) => props.setTitle(e.target.value)} maxLength={160} disabled={!canEdit} />
      </Field>
      {s && index !== null ? (
        <>
          <div className="flex items-center justify-between">
            <span className="font-mono text-[11px] text-ink-muted">
              SCENE {index + 1} OF {props.count}
            </span>
            <div className="flex gap-1">
              <IconButton label="Move scene earlier" size="sm" disabled={!canEdit || index === 0} onClick={() => props.onMove(-1)}>
                <ArrowUp aria-hidden />
              </IconButton>
              <IconButton label="Move scene later" size="sm" disabled={!canEdit || index === props.count - 1} onClick={() => props.onMove(1)}>
                <ArrowDown aria-hidden />
              </IconButton>
              <IconButton label="Delete scene" size="sm" disabled={!canEdit} onClick={() => confirm("Delete this scene from the draft? (Saved versions are kept.)") && props.onDelete()}>
                <Trash2 aria-hidden />
              </IconButton>
            </div>
          </div>
          <p className="rounded-md bg-bg px-3 py-2 text-xs">
            Footage: {s.asset_id ? (s.asset_title ?? "clip") : "none (brand colour card)"}
            {s.asset_id && canEdit ? (
              <button type="button" className="ml-2 underline" onClick={() => props.onChange({ asset_id: null, asset_title: undefined, source_in_seconds: null })}>
                Remove
              </button>
            ) : null}
          </p>
          <Field label="On-screen text" hint="Up to 80 characters.">
            <Input value={s.on_screen_text ?? ""} maxLength={80} disabled={!canEdit} onChange={(e) => props.onChange({ on_screen_text: e.target.value || null })} />
          </Field>
          <div className="grid grid-cols-2 gap-2.5">
            <Field label="Duration (s)">
              <Input type="number" min={0.5} max={60} step={0.5} value={s.duration_seconds} disabled={!canEdit} onChange={(e) => props.onChange({ duration_seconds: Math.max(0.5, Math.min(60, Number(e.target.value) || 0.5)) })} />
            </Field>
            <Field label="Clip starts at (s)">
              <Input type="number" min={0} step={0.5} value={s.source_in_seconds ?? 0} disabled={!canEdit || !s.asset_id} onChange={(e) => props.onChange({ source_in_seconds: Math.max(0, Number(e.target.value) || 0) })} />
            </Field>
          </div>
          <Field label="Transition in">
            <select aria-label="Transition in" value={s.transition} disabled={!canEdit} onChange={(e) => props.onChange({ transition: e.target.value as Scene["transition"] })} className="h-11 rounded-md border border-field-line bg-surface px-3">
              <option value="cut">Cut</option>
              <option value="dissolve">Dissolve</option>
              <option value="fade">Fade</option>
            </select>
          </Field>
          <Field label="Scene description">
            <Textarea rows={2} value={s.visual_description ?? ""} maxLength={600} disabled={!canEdit} onChange={(e) => props.onChange({ visual_description: e.target.value || null })} />
          </Field>
          <Field label="Voiceover script" hint="A note for now: voice-over isn't recorded or rendered yet.">
            <Textarea rows={2} value={s.voiceover ?? ""} maxLength={600} disabled={!canEdit} onChange={(e) => props.onChange({ voiceover: e.target.value || null })} />
          </Field>
        </>
      ) : (
        <p className="text-xs text-ink-muted">Select a scene on the timeline to edit it.</p>
      )}
      <Button variant="secondary" size="sm" disabled={!canEdit} onClick={props.onAddText}>
        <Plus aria-hidden /> Add a text card
      </Button>
      <p className="text-[11px] text-ink-muted">Edits stay in this draft until you save; each save is a new version.</p>
    </div>
  );
}

function Assistant({ projectId, baseId, enabled, reason, onSaved }: { projectId: string; baseId?: string; enabled: boolean; reason: string | null; onSaved: () => Promise<void> }) {
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState<{ from: "you" | "ai" | "error"; text: string }[]>([]);
  const send = async (text: string) => {
    if (!text.trim() || !enabled) return;
    setLog((l) => [...l, { from: "you", text }]);
    setDraft("");
    setBusy(true);
    const r = await writeStoryboard({ project_id: projectId, base_storyboard_id: baseId, direction: text });
    setBusy(false);
    if (!r.ok) return setLog((l) => [...l, { from: "error", text: r.error.message }]);
    const d = r.data as { version: number; total_duration_seconds: number; scenes: unknown[]; warnings: string[] };
    setLog((l) => [...l, { from: "ai", text: `Saved as version ${d.version}: ${d.scenes.length} scenes, ${duration(d.total_duration_seconds)}.${d.warnings.length ? ` Note: ${d.warnings.join("; ")}` : ""} The previous version is in Versions if you want it back.` }]);
    await onSaved();
  };
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2.5">
      <div className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto" role="log" aria-label="Assistant conversation" aria-live="polite">
        <p className="rounded-xl bg-bg p-3 leading-normal">
          <AiBadge size="sm" className="mr-1.5">
            Assistant
          </AiBadge>
          {baseId ? "Tell me what to change in this storyboard. I'll save the result as a new version." : "Describe the video and I'll draft a storyboard from your footage."}
        </p>
        {log.map((m, i) => (
          <p key={i} className={cn("rounded-xl p-3 leading-normal", m.from === "you" ? "max-w-[85%] self-end bg-primary text-primary-foreground" : m.from === "error" ? "bg-danger/15" : "bg-bg")}>
            {m.text}
          </p>
        ))}
        {busy ? (
          <p className="flex items-center gap-2 text-ink-muted" role="status">
            <Sparkles className="size-4 text-ai" aria-hidden /> Revising the storyboard…
          </p>
        ) : null}
      </div>
      {reason ? <p className="text-[11px] text-ink-muted">{reason}</p> : null}
      <form
        className="flex items-center gap-2 rounded-xl border border-line bg-bg py-1.5 pr-1.5 pl-3"
        onSubmit={(e) => {
          e.preventDefault();
          void send(draft);
        }}
      >
        <label className="sr-only" htmlFor="assistant-input">
          Ask the assistant
        </label>
        <input id="assistant-input" value={draft} onChange={(e) => setDraft(e.target.value)} disabled={!enabled || busy} placeholder="e.g. Make it 15 seconds" className="h-9 min-w-0 flex-1 bg-transparent text-xs outline-none placeholder:text-ink-muted" />
        <Button type="submit" size="sm" variant="primary" disabled={!enabled || busy || draft.trim().length < 3}>
          Send
        </Button>
      </form>
    </div>
  );
}

function Versions({ versions, currentId, latestId, canEdit, dirty, onView, onRestore }: { versions: { id: string; version: number; title: string; source: string; created_at: string | null }[]; currentId: string | null; latestId: string | null; canEdit: boolean; dirty: boolean; onView: (id: string) => void; onRestore: (id: string) => void }) {
  if (!versions.length) return <p className="text-xs text-ink-muted">No saved versions yet.</p>;
  return (
    <ol className="flex flex-col gap-1.5">
      {versions.map((v) => (
        <li key={v.id} className={cn("flex flex-col gap-1.5 rounded-[10px] p-2.5", v.id === currentId ? "bg-surface-muted ring-1 ring-primary" : "bg-bg")}>
          <div className="flex items-center justify-between gap-2">
            <span className="font-semibold">v{v.version}</span>
            {v.id === latestId ? <Badge size="sm">Latest</Badge> : null}
          </div>
          <span className="truncate text-xs">{v.title}</span>
          <span className="font-mono text-[10px] text-ink-muted">
            {v.source === "ai" ? "AI" : "Edited"} · {relativeTime(v.created_at)}
          </span>
          <div className="flex gap-1.5">
            <Button size="sm" variant="secondary" disabled={dirty || v.id === currentId} onClick={() => onView(v.id)}>
              View
            </Button>
            {v.id !== latestId ? (
              <Button size="sm" variant="secondary" disabled={!canEdit || dirty} onClick={() => onRestore(v.id)}>
                Restore as new version
              </Button>
            ) : null}
          </div>
        </li>
      ))}
    </ol>
  );
}

/* ---- Timeline ----------------------------------------------------------- */

function Timeline({ scenes, starts, total, time, selected, thumbs, onSeek, onSelect }: { scenes: Scene[]; starts: number[]; total: number; time: number; selected: number | null; thumbs: Record<string, string | null>; onSeek: (t: number) => void; onSelect: (i: number) => void }) {
  const lane = useRef<HTMLDivElement>(null);
  const pct = (t: number) => `${total ? (t / total) * 100 : 0}%`;
  const timeAt = (x: number) => {
    const r = lane.current!.getBoundingClientRect();
    return ((x - r.left) / r.width) * total;
  };
  return (
    <section aria-label="Timeline" className="mx-2 mb-2 flex flex-col gap-2 rounded-xl bg-surface px-3.5 pt-2.5 pb-3.5">
      <div className="flex items-center justify-between gap-2">
        <span className="rounded-[8px] bg-surface-muted px-3 py-1.5 font-semibold">Timeline</span>
        <span className="text-[11px] text-ink-muted">Split, trim inside clips, captions and music aren&apos;t available yet</span>
      </div>
      <div className="flex gap-2">
        <div className="flex w-16 shrink-0 flex-col gap-1.5 pt-6 text-[11px] text-ink-muted">
          <span className="flex h-12 items-center">Video</span>
          <span className="flex h-6 items-center">Text</span>
        </div>
        <div
          ref={lane}
          className="relative min-w-0 flex-1 touch-none"
          onPointerDown={(e) => {
            if ((e.target as HTMLElement).closest("button") || !total) return;
            e.currentTarget.setPointerCapture(e.pointerId);
            onSeek(timeAt(e.clientX));
          }}
          onPointerMove={(e) => e.currentTarget.hasPointerCapture(e.pointerId) && onSeek(timeAt(e.clientX))}
        >
          <div className="mb-1.5 flex h-5 justify-between font-mono text-[10px] text-ink-muted">
            {[0, 0.25, 0.5, 0.75, 1].map((f) => (
              <span key={f}>{tc(total * f)}</span>
            ))}
          </div>
          <div className="flex h-12 gap-0.5">
            {scenes.map((s, i) => (
              <button key={i} type="button" onClick={() => onSelect(i)} aria-pressed={selected === i} aria-label={`Scene ${i + 1}, ${s.duration_seconds}s${s.asset_title ? `, ${s.asset_title}` : ", text card"}`} className={cn("relative min-w-0 overflow-hidden rounded-[6px] bg-primary/80 text-left", selected === i && "ring-2 ring-ai")} style={{ flex: s.duration_seconds }}>
                {s.asset_id && thumbs[s.asset_id] ? (
                  // eslint-disable-next-line @next/next/no-img-element -- signed keyframe URL
                  <img src={thumbs[s.asset_id]!} alt="" className="absolute inset-0 size-full object-cover opacity-80" />
                ) : null}
                <span className="relative truncate px-1.5 font-mono text-[10px] text-on-media">{i + 1}</span>
              </button>
            ))}
          </div>
          <div className="mt-1.5 flex h-6 gap-0.5">
            {scenes.map((s, i) => (
              <span key={i} className={cn("min-w-0 truncate rounded-[5px] px-1.5 text-[10px] leading-6", s.on_screen_text ? "bg-surface-muted text-ink" : "")} style={{ flex: s.duration_seconds }}>
                {s.on_screen_text ?? ""}
              </span>
            ))}
          </div>
          {total ? (
            <span
              role="slider"
              tabIndex={0}
              aria-label="Playhead"
              aria-valuemin={0}
              aria-valuemax={Math.round(total * 10) / 10}
              aria-valuenow={Math.round(time * 10) / 10}
              aria-valuetext={tc(time)}
              onKeyDown={(e) => {
                const step = e.shiftKey ? 5 : 0.5;
                const map: Record<string, number> = { ArrowLeft: time - step, ArrowRight: time + step, Home: 0, End: total };
                if (e.key in map) {
                  e.preventDefault();
                  onSeek(map[e.key]!);
                }
              }}
              className="absolute top-5 bottom-0 w-0.5 -translate-x-1/2 rounded-pill bg-ai focus-visible:outline-2 focus-visible:outline-ai"
              style={{ left: pct(time) }}
            />
          ) : null}
        </div>
      </div>
      {starts.length === 0 ? <p className="text-xs text-ink-muted">No scenes yet.</p> : null}
    </section>
  );
}
