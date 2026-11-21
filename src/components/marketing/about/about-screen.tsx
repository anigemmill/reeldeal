import { Accent, MarketingPage, SectionEyebrow } from "@/components/marketing/shared";
import { MediaArt, PlaceholderTag } from "@/components/media/media-art";
import { Container } from "@/components/ui/misc";
import { ABOUT } from "@/content/about";
import { getMedia } from "@/content/media";
import { cn } from "@/lib/utils";

/* About page (design/website/W-About.dc.html). The founder section is off until the owner supplies it. */
export function AboutScreen() {
  return (
    <MarketingPage>
      <section aria-labelledby="page-title" className="relative isolate overflow-hidden pt-14 pb-14 text-center sm:pt-24 sm:pb-18">
        <div aria-hidden className="absolute inset-x-[20%] -top-50 -z-10 h-80 bg-grad-panel opacity-40 blur-[90px]" />
        <Container>
          <SectionEyebrow className="justify-center">About</SectionEyebrow>
          <h1 id="page-title" className="mx-auto max-w-[1100px] font-display text-[clamp(40px,5.4vw,80px)] leading-[1.06] font-semibold tracking-[-0.04em]">
            We build video tools for businesses <Accent>with stories worth showing</Accent>{" "}
            <span className="mode-studio inline-block -rotate-2 rounded-[0.22em] bg-tint px-[0.25em] text-on-tint">and</span> no time to edit them.
          </h1>
        </Container>
      </section>

      <Container>
        <div className="flex flex-col gap-3.5 sm:h-[460px] sm:flex-row">
          {ABOUT.gallery.map((g) => (
            <div key={g.media} className={cn("relative h-64 overflow-hidden rounded-2xl sm:h-auto", g.grow)}>
              <MediaArt asset={getMedia(g.media)} />
              <PlaceholderTag className="top-4 left-4" />
            </div>
          ))}
        </div>
      </Container>

      <section aria-labelledby="why-title" className="py-20 sm:py-28">
        <Container className="grid gap-12 md:grid-cols-3">
          <div>
            <SectionEyebrow>Why we exist</SectionEyebrow>
            <h2 id="why-title" className="font-display text-[40px] leading-none font-semibold tracking-[-0.03em]">
              Started in tourism, <Accent>on purpose.</Accent>
            </h2>
          </div>
          <div>
            <h3 className="mb-3 text-[17px] font-semibold">The problem</h3>
            <p className="text-base leading-[1.65] text-ink-muted">{ABOUT.problem}</p>
          </div>
          <div>
            <h3 className="mb-3 text-[17px] font-semibold">What we believe</h3>
            <p className="text-base leading-[1.65] text-ink-muted">{ABOUT.belief}</p>
          </div>
        </Container>
      </section>

      <section aria-labelledby="build-title" className="bg-primary py-20 text-primary-foreground sm:py-28">
        <Container>
          <h2 id="build-title" className="mb-12 font-display text-[clamp(44px,5.4vw,80px)] leading-[0.95] font-semibold tracking-[-0.045em]">
            How we <Accent>build.</Accent>
          </h2>
          <ol className="grid gap-x-16 lg:grid-cols-2">
            {ABOUT.principles.map((p, i) => (
              <li key={p.title} className="flex gap-6 border-t border-primary-foreground/30 py-6.5">
                <span aria-hidden className="w-16 shrink-0 font-display text-5xl leading-none tracking-[-0.04em] sm:w-22 sm:text-[56px]">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div>
                  <h3 className="mb-2 font-display text-[22px] font-semibold">{p.title}</h3>
                  <p className="text-[15px] leading-normal">{p.text}</p>
                </div>
              </li>
            ))}
          </ol>
        </Container>
      </section>

    </MarketingPage>
  );
}
