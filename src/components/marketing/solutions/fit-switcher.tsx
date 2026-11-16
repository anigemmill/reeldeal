"use client";

import Link from "next/link";
import { useId, useRef, useState, type KeyboardEvent } from "react";
import { MediaArt, PlaceholderTag } from "@/components/media/media-art";
import { getMedia } from "@/content/media";
import type { SolutionSegment } from "@/content/solutions";
import { cn } from "@/lib/utils";

/*
  "Find your fit": a tablist of business types. Arrow keys, Home and End move
  between tabs (automatic activation); the panel shows that segment's example.
*/
export function FitSwitcher({ segments }: { segments: SolutionSegment[] }) {
  const [index, setIndex] = useState(0);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const base = useId();
  const current = segments[index];

  function select(i: number) {
    const next = (i + segments.length) % segments.length;
    setIndex(next);
    tabs.current[next]?.focus();
  }

  function onKeyDown(e: KeyboardEvent<HTMLButtonElement>) {
    const keys: Record<string, number> = { ArrowRight: index + 1, ArrowDown: index + 1, ArrowLeft: index - 1, ArrowUp: index - 1, Home: 0, End: segments.length - 1 };
    if (e.key in keys) {
      e.preventDefault();
      select(keys[e.key]);
    }
  }

  return (
    <div>
      <div role="tablist" aria-label="Business type" className="mb-12 flex flex-wrap justify-center gap-2">
        {segments.map((s, i) => {
          const selected = i === index;
          return (
            <button
              key={s.id}
              ref={(el) => {
                tabs.current[i] = el;
              }}
              type="button"
              role="tab"
              id={`${base}-tab-${s.id}`}
              aria-selected={selected}
              aria-controls={`${base}-panel`}
              tabIndex={selected ? 0 : -1}
              onClick={() => setIndex(i)}
              onKeyDown={onKeyDown}
              className={cn(
                "rounded-pill border border-ink px-5 py-3 text-[15px] font-medium transition-colors motion-reduce:transition-none",
                selected ? "bg-ink text-bg" : "bg-transparent text-ink hover:bg-surface-muted",
              )}
            >
              {s.label}
            </button>
          );
        })}
      </div>

      <div
        role="tabpanel"
        id={`${base}-panel`}
        aria-labelledby={`${base}-tab-${current.id}`}
        tabIndex={0}
        className="flex flex-wrap items-stretch gap-4 rounded-2xl"
      >
        <div className="relative min-h-[440px] min-w-0 flex-[1.3_1_520px] overflow-hidden rounded-2xl text-on-media">
          <MediaArt asset={getMedia(current.media)} />
          <PlaceholderTag className="top-4 left-4" />
          <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-media-veil/70 via-media-veil/10 to-transparent" />
          <div className="absolute right-7 bottom-7 left-7">
            <h3 className="mb-2 font-display text-[40px] leading-none font-semibold tracking-[-0.03em]">{current.label}</h3>
            <p className="max-w-[460px] text-base leading-normal">{current.description}</p>
          </div>
        </div>

        <div className="mode-studio flex min-w-0 flex-[1_1_380px] flex-col gap-3.5 rounded-2xl bg-bg p-7.5 text-ink">
          <h4 className="font-mono text-[11px] tracking-label text-ink-muted uppercase">Videos they make most</h4>
          <ul className="flex flex-col gap-3.5">
            {current.videos.map((v) => (
              <li key={v.title} className="mode-workspace flex items-center gap-3 rounded-pill bg-surface py-2 pr-2 pl-4 text-ink">
                <span className="flex-1 text-[15px]">{v.title}</span>
                <span className="font-mono text-[11px] text-ink-muted">{v.format}</span>
                <span aria-hidden className="size-8 shrink-0 rounded-full bg-ai" />
              </li>
            ))}
          </ul>
          <Link href="/showcase" className="mt-auto w-fit rounded-sm pt-4 font-semibold hover:underline">
            See examples in the showcase →
          </Link>
        </div>
      </div>
    </div>
  );
}
