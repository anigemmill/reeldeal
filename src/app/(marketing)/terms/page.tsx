import type { Metadata } from "next";
import { LegalScreen } from "@/components/marketing/legal/legal-screen";
import { TERMS } from "@/content/legal";

// Placeholder text only: kept out of search results until the final policy replaces it.
export const metadata: Metadata = { title: "Terms of Service", description: "Reeldeal Terms of Service (draft placeholder).", robots: { index: false, follow: true } };

export default function Page() {
  return <LegalScreen doc={TERMS} />;
}
