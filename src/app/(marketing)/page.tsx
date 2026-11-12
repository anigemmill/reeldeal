import type { Metadata } from "next";
import { HomeScreen } from "@/components/marketing/home/home-screen";

export const metadata: Metadata = {
  title: { absolute: "Reeldeal · AI video production for business" },
  description: "Upload your footage, describe the video, and get finished, on-brand videos for Reels, ads and your website.",
};

export default function HomePage() {
  return <HomeScreen />;
}
