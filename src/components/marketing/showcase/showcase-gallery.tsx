"use client";

import { Play, Search } from "lucide-react";
import { useId, useState } from "react";
import { MediaArt } from "@/components/media/media-art";
import { Container } from "@/components/ui/misc";
import { getMedia } from "@/content/media";
import { filterShowcase, SHOWCASE_FILTERS, SHOWCASE_ITEMS, type ShowcaseFilter } from "@/content/showcase";
import { cn } from "@/lib/utils";

/*
  Search, filters and masonry grid for /showcase. Filtering runs in the browser over
  the sample items in src/content/showcase.ts. Tiles are not links yet: there are no
  video detail pages, so nothing pretends to open one.
*/
export function ShowcaseGallery() {
  const [filter, setFilter] = useState<ShowcaseFilter>("All");
  const [query, setQuery] = useState("");
  const searchId = useId();
  const items = filterShowcase(SHOWCASE_ITEMS, filter, query);

  return (
    <>
      <Container className="mt-12 flex flex-wrap items-center gap-3">
        <div className="flex min-w-0 flex-[1_1_360px] items-center gap-2.5 rounded-pill border border-line bg-surface py-2.5 pr-2.5 pl-5 focus-within:ring-2 focus-within:ring-focus">
          <Search className="size-4 shrink-0 text-ink-muted" aria-hidden />
          <label htmlFor={searchId} className="sr-only">
            Search sample videos
          </label>
          <input
            id={searchId}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search “kayak”, “menu”, “wedding”…"
            className="min-w-0 flex-1 bg-transparent py-1 text-base text-ink outline-none placeholder:text-ink-muted"
          />
        </div>
        <div role="group" aria-label="Filter videos" className="flex flex-wrap gap-1.5">
          {SHOWCASE_FILTERS.map((f) => {
            const on = f === filter;
            return (
              <button
                key={f}
                type="button"
                aria-pressed={on}
                onClick={() => setFilter(f)}
                className={cn(
                  "rounded-pill border px-4 py-2.5 text-sm font-medium transition-colors",
                  on ? "border-ink bg-ink text-bg" : "border-line bg-surface text-ink hover:bg-surface-muted",
                )}
              >
                {f}
              </button>
            );
          })}
        </div>
      </Container>

      <Container className="pt-10 pb-20 sm:pb-28">
        <p role="status" className="sr-only">
          {items.length === 1 ? "1 video" : `${items.length} videos`} shown
        </p>
        {items.length === 0 ? (
          <div className="rounded-xl border border-dashed border-line-strong px-6 py-16 text-center">
            <p className="font-display text-xl font-semibold">No videos match that yet.</p>
            <p className="mt-2 text-ink-muted">Try another word or clear the filter.</p>
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setFilter("All");
              }}
              className="mt-5 rounded-pill border border-ink px-5 py-2.5 font-semibold"
            >
              Show all videos
            </button>
          </div>
        ) : (
          <ul className="columns-1 gap-4 sm:columns-2 lg:columns-3 xl:columns-4">
            {items.map((it) => (
              <li key={it.id} className="mb-4 break-inside-avoid">
                <article aria-labelledby={`sc-${it.id}`}>
                  <div className={cn("relative overflow-hidden rounded-[18px]", it.height)}>
                    <MediaArt asset={getMedia(it.media)} />
                    <span className="absolute top-3 left-3 rounded-pill bg-media-veil/60 px-2 py-1 font-mono text-[10px] text-on-media">{it.format}</span>
                    <span aria-hidden className="absolute top-3 right-3 flex size-8.5 items-center justify-center rounded-full bg-ai text-ai-foreground">
                      <Play className="size-3 fill-current" />
                    </span>
                    <span className="absolute bottom-3 left-3 rounded-pill bg-media-veil/60 px-2 py-0.5 font-mono text-[10px] tracking-wide text-on-media uppercase">
                      Sample
                    </span>
                  </div>
                  <div className="flex justify-between gap-2 px-1 pt-3">
                    <h3 id={`sc-${it.id}`} className="text-[15px] font-semibold">
                      {it.title}
                    </h3>
                    <span className="font-mono text-[11px] whitespace-nowrap text-ink-muted uppercase">{it.mode}</span>
                  </div>
                  <p className="px-1 pt-1 text-[13px] text-ink-muted">{it.business}</p>
                </article>
              </li>
            ))}
          </ul>
        )}
      </Container>
    </>
  );
}
