"use client";

import { ArrowUp, Pause, Play } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { MediaArt } from "@/components/media/media-art";
import { Eyebrow } from "@/components/ui/misc";
import { HERO_PROMPTS, HERO_TILES } from "@/content/home";
import { getMedia } from "@/content/media";

/*
  Homepage hero (design/components/ArcHero.dc.html): a curved 3D slider of
  finished videos and a prompt bar that types example briefs.

  Motion: one requestAnimationFrame loop writes transforms straight to the DOM
  (no React render per frame). It stops when the hero is off-screen, starts
  paused for prefers-reduced-motion, and can be paused by the user.
  Only the centre tile is marked as playing; real video arrives with real footage.
*/
const N = HERO_TILES.length;
const SPEED = 0.2; // tiles per second

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sync with the media query
    setReduced(mq.matches);
    const on = () => setReduced(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return reduced;
}

export function ArcHero() {
  const reduced = useReducedMotion();
  const [userPaused, setUserPaused] = useState(false);
  const paused = userPaused || reduced;

  return (
    <section className="relative isolate overflow-hidden pt-8 pb-20 text-center sm:pt-10">
      <div
        aria-hidden
        className="rd-motion absolute top-[260px] left-1/2 -z-10 h-[620px] w-[1500px] -translate-x-1/2 rounded-[50%]"
        style={{
          background:
            "radial-gradient(closest-side, color-mix(in srgb, var(--rd-primary) 32%, var(--rd-tint)) 0%, var(--rd-tint) 40%, color-mix(in srgb, var(--rd-tint) 40%, transparent) 66%, transparent 100%)",
          animation: paused ? "none" : "rd-breathe 9s ease-in-out infinite",
        }}
      />
      <Eyebrow className="mb-4.5 flex items-center justify-center gap-2.5 text-xs">
        <span aria-hidden className="size-[7px] rounded-full bg-ai" />
        AI video production for business
      </Eyebrow>
      <h1 className="mx-auto max-w-[1040px] px-5 font-display text-[clamp(40px,5.4vw,78px)] leading-[1.06] font-semibold tracking-display text-balance">
        Your footage,{" "}
        <em className="font-accent font-normal tracking-[-0.02em] underline decoration-ai decoration-[0.07em] underline-offset-[0.14em]">
          finished
        </em>{" "}
        for{" "}
        <span className="inline-block -rotate-2 rounded-[0.24em] bg-primary px-[0.28em] text-primary-foreground">Reels</span>{" "}
        <span className="inline-block rotate-[1.5deg] rounded-[0.24em] bg-tint px-[0.28em] text-on-tint">Ads</span>{" "}
        <span className="inline-block rounded-[0.24em] border-2 border-ink bg-surface px-[0.28em]">Websites</span>
      </h1>

      <Arc paused={paused} />

      <div className="mx-auto max-w-[600px] px-5">
        <PromptBar paused={paused} />
        <div className="mt-4.5 flex flex-wrap items-center justify-center gap-2.5 text-sm text-ink-muted">
          <span>Describe it. Get three edits made from your own footage.</span>
          {!reduced && (
            <button
              type="button"
              aria-pressed={userPaused}
              onClick={() => setUserPaused((p) => !p)}
              className="inline-flex items-center gap-1.5 rounded-pill border border-line bg-surface px-3 py-1.5 font-mono text-xs text-ink"
            >
              {userPaused ? <Play className="size-3" aria-hidden /> : <Pause className="size-3" aria-hidden />}
              {userPaused ? "Play motion" : "Pause motion"}
            </button>
          )}
        </div>
        <p className="mt-3 font-mono text-[10px] tracking-wide text-ink-muted uppercase">Sample work · placeholder imagery</p>
      </div>
    </section>
  );
}

function Arc({ paused }: { paused: boolean }) {
  const root = useRef<HTMLDivElement>(null);
  const tiles = useRef<(HTMLElement | null)[]>([]);
  const offset = useRef(0);
  const visible = useRef(true);
  const [live, setLive] = useState(0);

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => (visible.current = e.isIntersecting));
    io.observe(el);

    let raf = 0;
    let last = performance.now();
    let liveIdx = -1;
    const place = () => {
      tiles.current.forEach((t, i) => {
        if (!t) return;
        let p = (((i - offset.current) % N) + N) % N;
        if (p > N / 2) p -= N;
        t.style.transform = `translateX(-50%) translateZ(1800px) rotateY(${(-p * 9).toFixed(3)}deg) translateZ(-1800px)`;
        t.style.opacity = Math.abs(p) > 5.2 ? "0" : "1";
      });
      const centre = Math.round(offset.current) % N;
      if (centre !== liveIdx) {
        liveIdx = centre;
        setLive(centre);
      }
    };
    const frame = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      if (!paused && visible.current) offset.current += dt * SPEED;
      place();
      raf = requestAnimationFrame(frame);
    };
    place();
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
    };
  }, [paused]);

  return (
    <div
      ref={root}
      role="region"
      aria-label="Videos made on the platform (sample work)"
      className="relative mt-11 h-[400px] overflow-hidden [perspective:2200px] [perspective-origin:50%_45%] sm:h-[470px]"
    >
      <div className="absolute top-[50px] left-1/2 size-0 [transform-style:preserve-3d]">
        {HERO_TILES.map((t, i) => {
          const isLive = i === live;
          return (
            <figure
              key={i}
              ref={(el) => {
                tiles.current[i] = el;
              }}
              className="absolute top-0 left-0 m-0 h-[290px] w-[218px] [backface-visibility:hidden] sm:h-[340px] sm:w-[256px]"
            >
              <div className="relative size-full overflow-hidden rounded-[10px] bg-ink">
                <MediaArt asset={getMedia(t.media)} />
                <div aria-hidden className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-media-veil/55 to-transparent" />
                {isLive && (
                  <>
                    <span className="absolute top-3 left-3 flex items-center gap-1.5 rounded-pill bg-media-veil/60 px-2.5 py-1 font-mono text-[10px] text-on-media">
                      <span className="size-1.5 rounded-full bg-ai" aria-hidden />
                      PLAYING
                    </span>
                    <div className="absolute inset-x-3 bottom-3 h-[3px] overflow-hidden rounded-pill bg-on-media/35" aria-hidden>
                      <div
                        key={live}
                        className="rd-motion h-full bg-ai"
                        style={{ animation: "rd-grow 5s linear forwards", animationPlayState: paused ? "paused" : "running" }}
                      />
                    </div>
                  </>
                )}
                <figcaption className="absolute inset-x-3 bottom-6 text-left text-on-media [text-shadow:0_1px_10px_rgb(0_0_0/0.5)]">
                  <div className="font-display text-[17px] font-semibold">{t.title}</div>
                  <div className="mt-0.5 font-mono text-[10px]">{t.meta}</div>
                </figcaption>
              </div>
            </figure>
          );
        })}
      </div>
    </div>
  );
}

function PromptBar({ paused }: { paused: boolean }) {
  const [state, setState] = useState({ pi: 0, ci: 0, hold: 0 });
  useEffect(() => {
    if (paused) return;
    const id = setInterval(() => {
      setState(({ pi, ci, hold }) => {
        const len = HERO_PROMPTS[pi].length;
        if (ci < len) return { pi, ci: ci + 1, hold };
        if (hold < 40) return { pi, ci, hold: hold + 1 };
        return { pi: (pi + 1) % HERO_PROMPTS.length, ci: 0, hold: 0 };
      });
    }, 60);
    return () => clearInterval(id);
  }, [paused]);

  const phrase = HERO_PROMPTS[state.pi];
  const typed = paused ? phrase : phrase.slice(0, state.ci);
  return (
    <div className="flex items-center gap-3 rounded-pill border border-line bg-surface py-2 pr-2 pl-5.5 text-left shadow-prompt studio:shadow-none">
      <span className="min-w-0 flex-1 truncate text-lg" aria-live="off">
        <span className="sr-only">Example brief: </span>
        {typed}
        <span aria-hidden className="rd-motion ml-0.5 inline-block h-5 w-0.5 translate-y-[3px] bg-ai" style={{ animation: "rd-caret 1s steps(1) infinite" }} />
      </span>
      <Link
        href="/signup"
        aria-label="Create a video like this (start free)"
        className="inline-flex size-11.5 shrink-0 items-center justify-center rounded-full bg-action text-action-foreground transition-colors hover:bg-action/90"
      >
        <ArrowUp className="size-[18px]" strokeWidth={2.4} aria-hidden />
      </Link>
    </div>
  );
}
