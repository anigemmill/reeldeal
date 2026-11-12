import type { Metadata } from "next";
import { AutopilotScreen } from "@/components/app/autopilot/autopilot-screen";

export const metadata: Metadata = { title: "Screen · Autopilot" };

/* Add ?step=review to open the review step directly. */
export default function AutopilotReviewPage() {
  return <AutopilotScreen exitHref="/design-system/screens/dashboard" />;
}
