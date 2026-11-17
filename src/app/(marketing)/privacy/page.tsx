import type { Metadata } from "next";
import { LegalScreen } from "@/components/marketing/legal/legal-screen";
import { PRIVACY } from "@/content/legal";

// Placeholder text only: kept out of search results until the final policy replaces it.
export const metadata: Metadata = { title: "Privacy Policy", description: "Reeldeal Privacy Policy (draft placeholder).", robots: { index: false, follow: true } };

export default function Page() {
  return <LegalScreen doc={PRIVACY} />;
}
