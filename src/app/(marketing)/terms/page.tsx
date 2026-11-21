import type { Metadata } from "next";
import { LegalScreen } from "@/components/marketing/legal/legal-screen";
import { TERMS } from "@/content/legal";

// First draft, not yet legally reviewed: kept out of search results until it is signed off.
export const metadata: Metadata = { title: "Terms of Service", description: "Reeldeal Terms of Service (draft).", robots: { index: false, follow: true } };

export default function Page() {
  return <LegalScreen doc={TERMS} />;
}
