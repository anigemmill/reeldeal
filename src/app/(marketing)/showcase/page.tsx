import type { Metadata } from "next";
import { FeaturedStory } from "@/components/marketing/showcase/featured-story";
import { ShowcaseGallery } from "@/components/marketing/showcase/showcase-gallery";
import { MarketingPage } from "@/components/marketing/shared";
import { Container } from "@/components/ui/misc";

export const metadata: Metadata = {
  title: "Showcase",
  description: "Videos made with Reeldeal from a business's own footage: reels, ads and website videos, made with Autopilot or Studio.",
};

/* /showcase (design/website/W-Showcase.dc.html). The gallery is sample work until customer videos are approved. */
export default function ShowcasePage() {
  return (
    <MarketingPage>
      <section aria-labelledby="page-title" className="pt-10 sm:pt-16">
        <Container className="flex flex-wrap items-end justify-between gap-6">
          <h1 id="page-title" className="font-display text-[clamp(56px,9vw,148px)] leading-[0.86] font-semibold tracking-[-0.055em]">
            Made on
            <br />
            <em className="bg-grad-blue bg-clip-text pr-[0.08em] font-accent font-normal tracking-[-0.03em] text-transparent">Reeldeal.</em>
          </h1>
          <p className="max-w-[380px] text-[17px] leading-relaxed text-ink-muted">
            Videos made from a business’s own footage. Every one shows the format it was made for and whether Autopilot or Studio made it.
          </p>
        </Container>
        <Container className="mt-8">
          <p className="rounded-lg border border-line bg-surface-muted px-4 py-3 text-sm text-ink-soft">
            <span className="font-semibold text-ink">Sample gallery.</span> These businesses and videos are invented examples that show what Reeldeal makes.
            Customer videos will replace them: [CUSTOMER VIDEOS].
          </p>
        </Container>
      </section>
      <ShowcaseGallery />
      <FeaturedStory />
    </MarketingPage>
  );
}
