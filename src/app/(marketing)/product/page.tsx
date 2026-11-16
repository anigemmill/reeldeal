import type { Metadata } from "next";
import {
  AutopilotSection,
  BrandSection,
  ExportSection,
  LibrarySection,
  ProductHero,
  StudioSection,
} from "@/components/marketing/product/sections";
import { CtaPair, MarketingPage } from "@/components/marketing/shared";
import { Container } from "@/components/ui/misc";

export const metadata: Metadata = {
  title: "Product",
  description:
    "Autopilot makes the video for you; Studio lets you shape every cut. Brand intelligence, a searchable media library and one-click export to every format.",
};

/* /product (design/website/W-Product.dc.html): one long page with section anchors. */
export default function ProductPage() {
  return (
    <MarketingPage>
      <ProductHero />
      <AutopilotSection />
      <StudioSection />
      <BrandSection />
      <LibrarySection />
      <ExportSection />
      <section aria-label="Get started" className="py-16">
        <Container className="flex justify-center">
          <CtaPair />
        </Container>
      </section>
    </MarketingPage>
  );
}
