import type { Metadata } from "next";
import { AutopilotScreen } from "@/components/app/autopilot/autopilot-screen";

export const metadata: Metadata = { title: "Autopilot" };

// Focus mode: Autopilot sits outside the sidebar shell.
export default function AutopilotPage() {
  return <AutopilotScreen />;
}
