import type { Metadata } from "next";
import { StudioPreview } from "@/components/app/studio/studio-preview";

export const metadata: Metadata = { title: "Screen · Studio" };

export default function StudioReviewPage() {
  return <StudioPreview exitHref="/design-system/screens/dashboard" />;
}
