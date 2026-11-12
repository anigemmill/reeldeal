import type { Metadata } from "next";
import { StudioScreen } from "@/components/app/studio/studio-screen";

export const metadata: Metadata = { title: "Screen · Studio" };

export default function StudioReviewPage() {
  return <StudioScreen exitHref="/design-system/screens/dashboard" />;
}
