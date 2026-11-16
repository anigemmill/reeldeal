import { Accent } from "@/components/marketing/shared";
import { MediaArt, PlaceholderTag } from "@/components/media/media-art";
import { Container } from "@/components/ui/misc";
import { getMedia } from "@/content/media";

/*
  Featured customer story (W-Showcase). Every fact here is still owner copy in
  [BRACKETS]: no pilot story is approved yet, and no case study page exists, so the
  "Read the story" button is shown disabled rather than linking nowhere.
*/
export function FeaturedStory() {
  const stats = [
    { value: "[N]", label: "raw clips in" },
    { value: "[N]", label: "videos out" },
    { value: "[T]", label: "total time" },
  ];
  return (
    <section aria-labelledby="story-title" className="mode-studio bg-bg py-20 text-ink sm:py-28">
      <Container className="flex flex-wrap items-center gap-12">
        <div className="relative h-[360px] min-w-0 flex-[1.2_1_520px] overflow-hidden rounded-2xl sm:h-[520px]">
          <MediaArt asset={getMedia("coast-sail")} />
          <span className="absolute top-5 left-5 rounded-pill bg-primary px-3 py-1.5 font-mono text-[11px] text-primary-foreground">FEATURED STORY</span>
          <PlaceholderTag className="top-auto bottom-4 left-5" />
        </div>
        <div className="min-w-0 flex-[1_1_400px]">
          <h2 id="story-title" className="mb-4.5 font-display text-[clamp(40px,4.4vw,62px)] leading-[0.98] font-semibold tracking-[-0.04em]">
            [Customer] made a summer <Accent>campaign from one afternoon.</Accent>
          </h2>
          <p className="mb-8 text-[17px] leading-relaxed text-ink-muted">
            [Short story of a pilot customer: what they shot, what they asked for, and what happened next.]
          </p>
          <dl className="mb-8 grid grid-cols-3 gap-2.5">
            {stats.map((s) => (
              <div key={s.label} className="flex flex-col-reverse rounded-lg bg-surface p-4">
                <dt className="mt-1 text-xs text-ink-muted">{s.label}</dt>
                <dd className="font-mono text-2xl">{s.value}</dd>
              </div>
            ))}
          </dl>
          <button
            type="button"
            disabled
            aria-describedby="story-note"
            className="rounded-pill bg-primary px-6 py-3.5 font-semibold text-primary-foreground disabled:opacity-50"
          >
            Read the story
          </button>
          <p id="story-note" className="mt-2.5 text-sm text-ink-muted">
            Customer stories are coming soon.
          </p>
        </div>
      </Container>
    </section>
  );
}
