import type { Metadata } from "next";
import { DemoScreen } from "@/components/marketing/demo/demo-screen";

export const metadata: Metadata = {
  title: "Book a demo",
  description: "See Reeldeal with your own footage: a 30-minute call where we build your first videos live.",
};

export default function DemoPage() {
  return <DemoScreen />;
}
