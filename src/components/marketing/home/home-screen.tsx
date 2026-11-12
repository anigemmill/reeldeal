import { SiteFooter } from "@/components/marketing/site-footer";
import { SiteHeader } from "@/components/marketing/site-header";
import { ArcHero } from "./arc-hero";
import { PromptWall } from "./prompt-wall";
import { Bento, HowItWorks, PricingTeaser, Tourism } from "./sections";

/*
  The full homepage. Rendered at / (always Crossroads Blue) and in the design
  review at /design-system/screens/home (any palette, mode and type).
*/
export function HomeScreen() {
  return (
    <div className="overflow-x-clip bg-bg text-ink">
      <SiteHeader />
      <main id="main">
        <ArcHero />
        <PromptWall />
        <HowItWorks />
        <Bento />
        <Tourism />
        <PricingTeaser />
      </main>
      <SiteFooter />
    </div>
  );
}
