import type { Metadata } from "next";
import { ComponentsGallery } from "@/components/review/components-gallery";

export const metadata: Metadata = { title: "Components" };

export default function DesignSystemPage() {
  return <ComponentsGallery />;
}
