import type { Metadata } from "next";
import { AppearanceScreen } from "@/components/app/settings/appearance-screen";

export const metadata: Metadata = { title: "Appearance" };

export default function AppearancePage() {
  return <AppearanceScreen />;
}
