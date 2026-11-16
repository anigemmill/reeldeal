import type { Metadata } from "next";
import { PricingScreen } from "@/components/marketing/pricing/pricing-screen";

export const metadata: Metadata = {
  title: "Pricing",
  description: "Plans built around finished videos a month. Start free with two videos, then upgrade when you're posting every week.",
};

export default function PricingPage() {
  return <PricingScreen />;
}
