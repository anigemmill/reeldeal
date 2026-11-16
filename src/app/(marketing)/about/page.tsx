import type { Metadata } from "next";
import { AboutScreen } from "@/components/marketing/about/about-screen";

export const metadata: Metadata = {
  title: "About",
  description: "We build video tools for businesses with stories worth showing and no time to edit them. Started in tourism, on purpose.",
};

export default function AboutPage() {
  return <AboutScreen />;
}
