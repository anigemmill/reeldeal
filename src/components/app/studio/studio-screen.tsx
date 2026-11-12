"use client";

import { ArrowLeft, Monitor, Pause, Play, Redo2, Rewind, FastForward, Smartphone, Sparkles, Square, Undo2 } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { LogoMark } from "@/components/brand/logo";
import { MediaArt, PlaceholderTag } from "@/components/media/media-art";
import { PillToggle } from "@/components/ui/badge";
import { Button, IconButton } from "@/components/ui/button";
import { Modal, ModalClose } from "@/components/ui/dialog";
import { SampleDataNote } from "@/components/ui/misc";
import { SegmentedControl } from "@/components/ui/tabs";
import { toast } from "@/components/ui/toast";
import { Tooltip } from "@/components/ui/tooltip";
import { getMedia } from "@/content/media";
import { STUDIO_CLIPS, STUDIO_PROJECT, timecode } from "@/content/sample/studio";
import { renderCredits } from "@/lib/pricing";
import { MediaPanel, ToolsPanel, type ToolTab } from "./studio-panels";
import { Timeline } from "./studio-timeline";

/*
  Studio (Phase 1 design, design/app/A-Studio.dc.html). Desktop-first editor,
  always Dark Studio mode in the user's palette. DESIGN PREVIEW: playback,
  scrubbing and selection work locally on sample data; editing, the assistant,
  saving and rendering arrive in Phase 4 and say so.
*/
export type Ratio = "9:16" | "1:1" | "16:9";
const RATIO_CSS: Record<Ratio, string> = { "9:16": "9 / 16", "1:1": "1 / 1", "16:9": "16 / 9" };
const DURATION = STUDIO_PROJECT.duration;

export function StudioScreen({ exitHref = "/dashboard" }: { exitHref?: string }) {
  const [ratio, setRatio] = useState<Ratio>("9:16");
  const [time, setTime] = useState(1.8);
  const [playing, setPlaying] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  const [tab, setTab] = useState<ToolTab>("assistant");
  const [captions, setCaptions] = useState(true);
  const [safeZones, setSafeZones] = useState(true);

  // Playback: one animation-frame loop while playing.
  const last = useRef(0);
  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    last.current = performance.now();
    const frame = (now: number) => {
      const dt = (now - last.current) / 1000;
      last.current = now;
      setTime((t) => (t + dt >= DURATION ? 0 : t + dt));
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [playing]);

  // Space plays and pauses, unless the user is typing or on a control that uses Space.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== "Space") return;
      const t = e.target as HTMLElement;
      if (t.closest("input, textarea, select, button, [role=slider], [role=tab], [role=radio], [contenteditable=true]")) return;
      e.preventDefault();
      setPlaying((p) => !p);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const seek = useCallback((t: number) => setTime(Math.max(0, Math.min(DURATION - 0.01, t))), []);
  const atTime = Math.max(0, STUDIO_CLIPS.findIndex((c) => time >= c.start && time < c.end));
  const shown = playing || selected === null ? atTime : selected;
  const clip = STUDIO_CLIPS[shown];
  const credits = renderCredits({ seconds: DURATION, formats: STUDIO_PROJECT.formats.length });

  return (
    <div className="mode-studio bg-bg text-ink">
      {/* Below 1024px: Studio is a desktop workspace. */}
      <NarrowNotice exitHref={exitHref} />

      <div className="hidden h-dvh min-h-[720px] flex-col text-[13px] lg:flex">
        <header className="flex items-center gap-3 border-b border-line px-4 py-2.5">
          <Tooltip content="Back to dashboard">
            <Link href={exitHref} aria-label="Back to dashboard" className="inline-flex size-9 items-center justify-center rounded-[10px] bg-surface hover:bg-surface-muted">
              <ArrowLeft className="size-4" aria-hidden />
            </Link>
          </Tooltip>
          <LogoMark className="size-[22px]" />
          <div className="flex min-w-0 flex-col">
            <h1 className="truncate text-sm font-semibold">{STUDIO_PROJECT.title}</h1>
            <span className="truncate text-[11px] text-ink-muted">
              {STUDIO_PROJECT.workspace} · {STUDIO_PROJECT.option} · saved just now
            </span>
          </div>
          <SampleDataNote className="ml-2 hidden xl:inline-flex" />
          <div className="flex-1" />
          <SegmentedControl
            label="Aspect ratio"
            size="sm"
            value={ratio}
            onValueChange={(v) => setRatio(v as Ratio)}
            options={[
              { value: "9:16", label: <><Smartphone aria-hidden />9:16</> },
              { value: "1:1", label: <><Square aria-hidden />1:1</> },
              { value: "16:9", label: <><Monitor aria-hidden />16:9</> },
            ]}
          />
          <IconButton label="Undo (arrives with editing in Phase 4)" variant="secondary" size="sm" disabled>
            <Undo2 aria-hidden />
          </IconButton>
          <IconButton label="Redo (arrives with editing in Phase 4)" variant="secondary" size="sm" disabled>
            <Redo2 aria-hidden />
          </IconButton>
          <Button variant="secondary" size="sm" disabled title="Review links arrive in Phase 4">
            Share for review · soon
          </Button>
          <Modal
            trigger={
              <Button variant="action" size="sm" className="px-4">
                Render · {credits} credit{credits === 1 ? "" : "s"}
              </Button>
            }
            title="Render this video?"
            description={`${STUDIO_PROJECT.title} · ${timecode(DURATION)} · ${STUDIO_PROJECT.formats.join(", ")}. Uses ${credits} video credit${credits === 1 ? "" : "s"}.`}
            footer={
              <>
                <ModalClose asChild>
                  <Button variant="ghost">Cancel</Button>
                </ModalClose>
                <ModalClose asChild>
                  <Button
                    variant="action"
                    onClick={() => toast({ title: "Design preview", description: "Nothing was rendered or charged. Rendering arrives in Phase 4.", tone: "ai" })}
                  >
                    Render · {credits} credit{credits === 1 ? "" : "s"}
                  </Button>
                </ModalClose>
              </>
            }
          >
            <p className="text-sm text-ink-muted">Credits are only spent when the render succeeds. A failed render on our side is re-rendered free.</p>
          </Modal>
        </header>

        <div className="flex min-h-0 flex-1 gap-2 p-2">
          <MediaPanel />

          <section aria-label="Preview" className="flex min-w-0 flex-1 flex-col gap-3 rounded-xl bg-surface p-3.5">
            <div className="flex min-h-0 flex-1 items-center justify-center rounded-lg bg-bg p-4">
              <div
                className="relative isolate max-h-full max-w-full overflow-hidden rounded-md bg-media-veil"
                style={{ aspectRatio: RATIO_CSS[ratio], height: ratio === "16:9" ? "auto" : "100%", width: ratio === "16:9" ? "100%" : "auto" }}
              >
                <MediaArt asset={getMedia(clip.media)} />
                <PlaceholderTag />
                {safeZones && <span aria-hidden className="absolute inset-[6%] rounded border border-dashed border-on-media/40" />}
                {captions && clip.caption && (
                  <div className="absolute inset-x-[8%] bottom-[13%] text-on-media">
                    <span className="mb-1.5 inline-block rounded-[5px] bg-primary px-1.5 py-0.5 font-mono text-[9px] tracking-[0.06em] text-primary-foreground">
                      LAKESIDE LODGE
                    </span>
                    <p className="font-display text-[clamp(18px,2.2vw,28px)] leading-[1.02] font-bold tracking-[-0.02em] [text-shadow:0_2px_14px_rgb(0_0_0/0.4)]">
                      {clip.caption}
                    </p>
                  </div>
                )}
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2.5">
              <span className="font-mono text-[13px] tabular-nums" aria-live="off">
                {timecode(time)} <span className="text-ink-muted">/ {timecode(DURATION)}</span>
              </span>
              <div className="flex items-center gap-1.5">
                <IconButton label="Back 5 seconds" size="sm" onClick={() => seek(time - 5)}>
                  <Rewind aria-hidden />
                </IconButton>
                <button
                  type="button"
                  onClick={() => setPlaying((p) => !p)}
                  aria-label={playing ? "Pause" : "Play"}
                  aria-keyshortcuts="Space"
                  className="inline-flex size-11 items-center justify-center rounded-full bg-ink text-bg transition-transform active:scale-95"
                >
                  {playing ? <Pause className="size-4 fill-current" aria-hidden /> : <Play className="ml-0.5 size-4 fill-current" aria-hidden />}
                </button>
                <IconButton label="Forward 5 seconds" size="sm" onClick={() => seek(time + 5)}>
                  <FastForward aria-hidden />
                </IconButton>
              </div>
              <div className="flex gap-1.5">
                <PillToggle size="sm" pressed={captions} onClick={() => setCaptions((c) => !c)}>
                  Captions
                </PillToggle>
                <PillToggle size="sm" pressed={safeZones} onClick={() => setSafeZones((s) => !s)}>
                  Safe zones
                </PillToggle>
              </div>
            </div>
          </section>

          <ToolsPanel tab={tab} setTab={setTab} clipIndex={shown} />
        </div>

        <Timeline
          time={time}
          duration={DURATION}
          onSeek={(t) => {
            seek(t);
            setSelected(null);
          }}
          selected={selected}
          onSelect={(i) => {
            setSelected(i);
            setPlaying(false);
            seek(STUDIO_CLIPS[i].start + 0.05);
            setTab("inspector");
          }}
        />
      </div>
    </div>
  );
}

function NarrowNotice({ exitHref }: { exitHref: string }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6 p-6 text-center lg:hidden">
      <div className="relative aspect-video w-full max-w-md overflow-hidden rounded-xl">
        <MediaArt asset={getMedia("forest-ride")} />
        <PlaceholderTag />
      </div>
      <div className="flex max-w-md flex-col gap-2">
        <h1 className="font-display text-2xl font-semibold tracking-tight">Studio works best on a larger screen</h1>
        <p className="text-ink-muted">
          The timeline editor is designed for screens 1024px and wider. On your phone, Autopilot makes and refines videos for you.
        </p>
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        <Button asChild variant="action">
          <Link href="/autopilot">
            <Sparkles aria-hidden />
            Use Autopilot
          </Link>
        </Button>
        <Button asChild variant="secondary">
          <Link href={exitHref}>Back to dashboard</Link>
        </Button>
      </div>
    </div>
  );
}

