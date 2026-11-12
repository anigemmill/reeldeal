"use client";

import { MessageSquare, Scissors, SplitSquareHorizontal, Type, Wand2 } from "lucide-react";
import { useRef, type PointerEvent as RPointerEvent, type KeyboardEvent as RKeyboardEvent } from "react";
import { MediaArt } from "@/components/media/media-art";
import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/tooltip";
import { getMedia } from "@/content/media";
import { STUDIO_CLIPS, STUDIO_COMMENTS, STUDIO_TEXT, STUDIO_WAVE, timecode } from "@/content/sample/studio";
import { cn } from "@/lib/utils";

/*
  Studio timeline: ruler with review comments, then Video, Text, Captions and
  Music tracks. Click or drag on the ruler or tracks to scrub; the playhead is a
  keyboard slider (arrows ±0.5s, Shift ±5s, Home/End). Clips are buttons that
  select the shot for the Inspector.
*/
const TRACKS = [
  { id: "video", label: "Video", h: "h-11" },
  { id: "text", label: "Text", h: "h-[22px]" },
  { id: "captions", label: "Captions", h: "h-[22px]" },
  { id: "music", label: "Music", h: "h-[30px]" },
] as const;

export function Timeline({
  time,
  duration,
  onSeek,
  selected,
  onSelect,
}: {
  time: number;
  duration: number;
  onSeek: (t: number) => void;
  selected: number | null;
  onSelect: (i: number) => void;
}) {
  const lane = useRef<HTMLDivElement>(null);
  const pct = (t: number) => `${(t / duration) * 100}%`;

  const timeAt = (clientX: number) => {
    const r = lane.current!.getBoundingClientRect();
    return ((clientX - r.left) / r.width) * duration;
  };
  const onPointerDown = (e: RPointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest("button")) return; // clip buttons select instead
    e.currentTarget.setPointerCapture(e.pointerId);
    onSeek(timeAt(e.clientX));
  };
  const onPointerMove = (e: RPointerEvent<HTMLDivElement>) => {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) onSeek(timeAt(e.clientX));
  };
  const onKey = (e: RKeyboardEvent) => {
    const step = e.shiftKey ? 5 : 0.5;
    const map: Record<string, number> = { ArrowLeft: time - step, ArrowDown: time - step, ArrowRight: time + step, ArrowUp: time + step, Home: 0, End: duration };
    if (e.key in map) {
      e.preventDefault();
      onSeek(map[e.key]);
    }
  };

  return (
    <section aria-label="Timeline" className="mx-2 mb-2 flex flex-col gap-2 rounded-xl bg-surface px-3.5 pt-2.5 pb-3.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-1" role="group" aria-label="Edit view">
          <span aria-current="page" className="rounded-[8px] bg-surface-muted px-3 py-1.5 font-semibold">
            Timeline
          </span>
          <span className="px-3 py-1.5 text-ink-muted" title="Storyboard view arrives in Phase 4">
            Storyboard · soon
          </span>
        </div>
        <div className="flex gap-1" role="group" aria-label="Edit tools (arrive in Phase 4)">
          {[
            ["Split", SplitSquareHorizontal],
            ["Trim", Scissors],
            ["Text", Type],
            ["Transition", Wand2],
          ].map(([label, Icon]) => {
            const I = Icon as typeof Scissors;
            return (
              <Button key={label as string} variant="secondary" size="sm" disabled className="h-8 px-2.5 text-xs">
                <I aria-hidden />
                {label as string}
              </Button>
            );
          })}
        </div>
        <span className="inline-flex items-center gap-1.5 text-xs text-ink-muted">
          <MessageSquare className="size-3.5 text-ai" aria-hidden />
          {STUDIO_COMMENTS.length} review comments
        </span>
      </div>

      <div className="grid grid-cols-[64px_minmax(0,1fr)] gap-x-2">
        {/* Labels column */}
        <div className="flex flex-col gap-[5px] pt-[22px]" aria-hidden>
          {TRACKS.map((t) => (
            <span key={t.id} className={cn("flex items-center text-[11px] text-ink-muted", t.h)}>
              {t.label}
            </span>
          ))}
        </div>

        {/* Lanes: ruler + tracks share one coordinate space, and the playhead spans them. */}
        <div ref={lane} className="relative cursor-col-resize touch-none select-none" onPointerDown={onPointerDown} onPointerMove={onPointerMove}>
          <div className="relative mb-1.5 h-4 font-mono text-[10px] text-ink-muted" aria-hidden>
            {Array.from({ length: duration / 5 + 1 }, (_, i) => i * 5).map((s) => (
              <span key={s} className="absolute -translate-x-1/2 first:translate-x-0 last:-translate-x-full" style={{ left: pct(s) }}>
                {timecode(s).slice(0, 5)}
              </span>
            ))}
          </div>
          {STUDIO_COMMENTS.map((c) => (
            <Tooltip key={c.id} content={`${timecode(c.at).slice(0, 5)} · ${c.by}: ${c.text}`}>
              <button
                type="button"
                aria-label={`Review comment at ${timecode(c.at).slice(0, 5)}: ${c.text}`}
                onClick={() => onSeek(c.at)}
                className="absolute top-0.5 z-10 size-2.5 -translate-x-1/2 rounded-full bg-ai ring-2 ring-surface"
                style={{ left: pct(c.at) }}
              />
            </Tooltip>
          ))}

          <div className="flex flex-col gap-[5px]">
            {/* Video */}
            <div className="relative h-11 rounded-[8px] bg-bg">
              {STUDIO_CLIPS.map((c, i) => (
                <button
                  key={c.id}
                  type="button"
                  aria-pressed={selected === i}
                  aria-label={`Shot ${i + 1}: ${c.name}, ${timecode(c.start).slice(0, 5)} to ${timecode(c.end).slice(0, 5)}`}
                  onClick={() => onSelect(i)}
                  className={cn(
                    "absolute inset-y-0 overflow-hidden rounded-[7px] bg-primary text-left text-primary-foreground transition-shadow",
                    selected === i && "ring-2 ring-ai ring-offset-1 ring-offset-surface",
                  )}
                  style={{ left: pct(c.start), width: `calc(${pct(c.end - c.start)} - 3px)` }}
                >
                  <span className="absolute inset-y-0 left-0 w-10 overflow-hidden">
                    <MediaArt asset={getMedia(c.media)} />
                  </span>
                  <span className="absolute top-1/2 right-1.5 left-[46px] -translate-y-1/2 truncate text-[10px]">{c.name}</span>
                </button>
              ))}
            </div>
            {/* Text */}
            <div className="relative h-[22px] rounded-[6px] bg-bg" aria-label="Text track" role="group">
              {STUDIO_TEXT.map((t) => (
                <span
                  key={t.id}
                  className="absolute inset-y-0 flex items-center truncate rounded-[6px] bg-tint px-2 text-[10px] text-on-tint"
                  style={{ left: pct(t.start), width: pct(t.end - t.start) }}
                >
                  {t.label}
                </span>
              ))}
            </div>
            {/* Captions */}
            <div className="relative h-[22px] rounded-[6px] bg-bg">
              <span className="absolute inset-0 flex items-center rounded-[6px] bg-surface-muted px-2 text-[10px] text-ink-muted">
                Auto captions · EN · brand style
              </span>
            </div>
            {/* Music */}
            <div className="flex h-[30px] items-center gap-[2px] rounded-[6px] bg-bg px-1.5" aria-label="Music: Morning Lake" role="img">
              {STUDIO_WAVE.map((h, i) => (
                <span key={i} className="flex-1 rounded-[2px] bg-primary/70" style={{ height: `${h * 100}%` }} />
              ))}
            </div>
          </div>

          {/* Playhead */}
          <div className="pointer-events-none absolute -top-0.5 bottom-0 z-20" style={{ left: pct(time) }}>
            <div
              role="slider"
              tabIndex={0}
              aria-label="Playhead"
              aria-valuemin={0}
              aria-valuemax={duration}
              aria-valuenow={Math.round(time * 10) / 10}
              aria-valuetext={timecode(time)}
              onKeyDown={onKey}
              className="pointer-events-auto absolute -top-1 -left-1.5 size-3 rounded-[3px] bg-ai"
            />
            <div className="absolute top-0 bottom-0 -left-px w-0.5 bg-ai" />
          </div>
        </div>
      </div>
    </section>
  );
}
