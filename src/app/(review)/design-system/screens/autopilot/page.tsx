import type { Metadata } from "next";
import { AutopilotPreview } from "@/components/app/autopilot/autopilot-preview";

export const metadata: Metadata = { title: "Screen · Autopilot" };

/* Add ?step=review to open the review step directly. */
export default function AutopilotReviewPage() {
  return <AutopilotPreview exitHref="/design-system/screens/dashboard" />;
}
