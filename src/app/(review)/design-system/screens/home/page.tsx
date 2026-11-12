import type { Metadata } from "next";
import { HomeScreen } from "@/components/marketing/home/home-screen";

export const metadata: Metadata = { title: "Screen · Homepage" };

/* The live homepage is always Crossroads Blue; here it follows the review toolbar. */
export default function HomeReviewPage() {
  return <HomeScreen />;
}
