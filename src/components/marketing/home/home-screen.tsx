import { MarketingPage } from "@/components/marketing/shared";
import { ArcHero } from "./arc-hero";
import { PromptWall } from "./prompt-wall";
import { Bento, HowItWorks, PricingTeaser, Tourism } from "./sections";

/*
  The full homepage. Rendered at / (always Crossroads Blue) and in the design
  review at /design-system/screens/home (any palette, mode and type).
*/
export function HomeScreen() {
  return (
    <MarketingPage>
      <ArcHero />
      <PromptWall />
      <HowItWorks />
      <Bento />
      <Tourism />
      <PricingTeaser />
    </MarketingPage>
  );
}
