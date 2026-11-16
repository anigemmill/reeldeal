import type { Metadata } from "next";
import { SolutionScreen } from "@/components/marketing/solutions/solution-screen";
import { TOURISM } from "@/content/solutions";

export const metadata: Metadata = {
  title: "Tourism and hospitality",
  description:
    "Turn the footage your guides, staff and guests already film into on-brand reels, ads and website videos for tours, stays, attractions and destinations.",
};

export default function TourismSolutionPage() {
  return <SolutionScreen solution={TOURISM} />;
}
