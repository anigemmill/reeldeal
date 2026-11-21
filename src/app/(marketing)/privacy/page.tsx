import type { Metadata } from "next";
import { LegalScreen } from "@/components/marketing/legal/legal-screen";
import { PRIVACY } from "@/content/legal";

// First draft, not yet legally reviewed: kept out of search results until it is signed off.
export const metadata: Metadata = { title: "Privacy Policy", description: "Reeldeal Privacy Policy (draft).", robots: { index: false, follow: true } };

export default function Page() {
  return <LegalScreen doc={PRIVACY} />;
}
