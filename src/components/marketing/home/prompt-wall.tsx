"use client";

import { ArrowUp } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { MediaArt } from "@/components/media/media-art";
import { Button } from "@/components/ui/button";
import { Container, Eyebrow } from "@/components/ui/misc";
import { WALL_FEATURED, WALL_PROMPTS, WALL_WORDS } from "@/content/home";
import { getMedia, type MediaId } from "@/content/media";
import { cn } from "@/lib/utils";

/*
  Prompt wall (design/components/PromptWall.dc.html): a dark section of slowly
  scrolling columns of video cards, each with the prompt that made it, and a
  featured card that types its prompt live. CSS marquee, off for reduced motion.
*/
const SCENES: MediaId[] = ["lake-kayak", "alpine-sunrise", "forest-ride", "geo-valley", "coast-sail", "lodge-night", "vineyard-gold", "beach-turquoise", "harbour-blue"];
const FILLS = ["bg-tint text-on-tint", "bg-surface-muted text-ink", "bg-primary text-primary-foreground", "bg-ai text-ai-foreground", "bg-surface text-ink"];
const COLUMN_ANIM = ["rd-marquee-up 38s", "rd-marquee-down 46s", "rd-marquee-up 52s", "rd-marquee-down 34s"];

type WallCard = { kind: "scene"; media: MediaId; prompt: string } | { kind: "word"; word: string; fill: string; serif: boolean; prompt: string };

function column(ci: number): WallCard[] {
  const cards: WallCard[] = [];
  for (let k = 0; k < 5; k++) {
    const n = ci * 5 + k;
    const prompt = WALL_PROMPTS[n % WALL_PROMPTS.length];
    cards.push(
      n % 3 === 1
        ? { kind: "word", word: WALL_WORDS[n % WALL_WORDS.length], fill: FILLS[n % FILLS.length], serif: n % 2 === 1, prompt }
        : { kind: "scene", media: SCENES[n % SCENES.length], prompt },
    );
  }
  return [...cards, ...cards];
}

function PromptChip({ text, size = "sm" }: { text: string; size?: "sm" | "lg" }) {
  return (
    <span
      className={cn(
        "absolute inset-x-2.5 top-[46%] flex items-center gap-1.5 rounded-pill bg-on-media text-left text-media-veil",
        size === "sm" ? "py-1 pr-1 pl-2.5 text-[10px]" : "inset-x-4.5 gap-2.5 py-2 pr-2 pl-4.5 text-base",
      )}
    >
      <span className="min-w-0 flex-1 truncate">{text}</span>
      <span className="size-4 shrink-0 rounded-full bg-ai" />
    </span>
  );
}

export function PromptWall() {
  const [state, setState] = useState({ pi: 0, ci: 0, hold: 0 });
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- show the full prompt, no typing
      setState({ pi: 0, ci: 999, hold: 0 });
      return;
    }
    const id = setInterval(() => {
      setState(({ pi, ci, hold }) => {
        const len = WALL_FEATURED[pi].prompt.length;
        if (ci < len) return { pi, ci: ci + 1, hold };
        if (hold < 30) return { pi, ci, hold: hold + 1 };
        return { pi: (pi + 1) % WALL_FEATURED.length, ci: 0, hold: 0 };
      });
    }, 70);
    return () => clearInterval(id);
  }, []);
  const featured = WALL_FEATURED[state.pi];

  return (
    <section className="mode-studio overflow-hidden bg-bg text-ink">
      <Container className="flex flex-wrap items-center gap-12">
        <div className="min-w-0 flex-[1_1_360px] pt-20 lg:py-24">
          <Eyebrow className="mb-4.5 flex items-center gap-2.5 text-xs">
            <span aria-hidden className="size-[7px] rounded-full bg-ai" />
            One line in. Finished video out.
          </Eyebrow>
          <h2 className="mb-5.5 font-display text-[clamp(44px,5.2vw,76px)] leading-[0.96] font-semibold tracking-display">
            Type it.
            <br />
            <em className="font-accent font-normal underline decoration-ai decoration-[0.07em] underline-offset-[0.14em]">Watch it happen.</em>
          </h2>
          <p className="mb-8 max-w-[420px] text-lg leading-relaxed text-ink-muted">
            Every card started as one sentence and a folder of raw clips. The AI found the shots, cut the edit and applied the
            brand.
          </p>
          <Button asChild variant="action" shape="pill" size="lg">
            <Link href="/signup">Try a prompt</Link>
          </Button>
        </div>

        <div className="relative h-[560px] min-w-0 flex-[1.4_1_560px] lg:h-[760px]" aria-hidden>
          <div className="absolute inset-0 grid grid-cols-2 gap-4 sm:grid-cols-4">
            {[0, 1, 2, 3].map((ci) => (
              <div key={ci} className={cn("h-full overflow-hidden", ci > 1 && "hidden sm:block")}>
                <div className="rd-motion flex flex-col gap-4" style={{ animation: `${COLUMN_ANIM[ci]} linear infinite` }}>
                  {column(ci).map((c, k) => (
                    <div key={k} className={cn("relative h-[230px] shrink-0 overflow-hidden rounded-[14px]", c.kind === "word" && c.fill)}>
                      {c.kind === "scene" ? (
                        <MediaArt asset={getMedia(c.media)} />
                      ) : (
                        <span className={cn("absolute top-2.5 left-3.5 text-[64px] leading-[0.9] font-semibold tracking-display", c.serif ? "font-accent italic" : "font-display")}>
                          {c.word}
                        </span>
                      )}
                      <PromptChip text={c.prompt} />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          {/* Featured card: fade the wall behind it so it reads as the focus. */}
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(closest-side,var(--rd-bg)_20%,transparent_100%)] opacity-70" />
          <div className="absolute top-1/2 left-1/2 h-[400px] w-[300px] -translate-1/2 overflow-hidden rounded-[22px] shadow-float sm:h-[450px] sm:w-[340px]">
            <MediaArt asset={getMedia(featured.media)} />
            <span className="absolute inset-x-4.5 top-[46%] flex items-center gap-2.5 rounded-pill bg-on-media py-2 pr-2 pl-4.5 text-left text-base text-media-veil">
              <span className="min-w-0 flex-1 truncate">
                {featured.prompt.slice(0, state.ci)}
                <span className="rd-motion ml-0.5 inline-block h-[18px] w-0.5 translate-y-[3px] bg-ai" style={{ animation: "rd-caret 1s steps(1) infinite" }} />
              </span>
              <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-ai text-ai-foreground">
                <ArrowUp className="size-[15px]" strokeWidth={2.6} />
              </span>
            </span>
          </div>
        </div>
      </Container>
    </section>
  );
}
