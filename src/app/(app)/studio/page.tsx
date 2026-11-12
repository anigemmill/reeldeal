import type { Metadata } from "next";
import { StudioScreen } from "@/components/app/studio/studio-screen";

export const metadata: Metadata = { title: "Studio" };

// Full-screen focus mode: Studio sits outside the sidebar shell.
export default function StudioPage() {
  return <StudioScreen />;
}
