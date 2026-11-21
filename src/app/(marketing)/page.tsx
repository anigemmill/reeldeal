import type { Metadata } from "next";
import { HomeScreen } from "@/components/marketing/home/home-screen";

export const metadata: Metadata = {
  title: { absolute: "Reeldeal · AI video production for business" },
  description: "Turn your raw footage into finished reels, ads and website videos. AI video production for businesses.",
};

export default function HomePage() {
  return <HomeScreen />;
}
