import type { Metadata } from "next";
import { siteUrl } from "@/lib/site-url";
import { brandFontVariables } from "../fonts";
import "../globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  // "Reeldeal" is the working name; confirm before launch (CLAUDE.md).
  title: { default: "Reeldeal", template: "%s · Reeldeal" },
  description: "[TAGLINE] AI video production for businesses.",
  openGraph: { type: "website", siteName: "Reeldeal", locale: "en_NZ" },
  twitter: { card: "summary_large_image" },
};

/*
  Root layout for the public website. Always Crossroads Blue, Light Workspace,
  typography A: it never reads the user's theme.
*/
export default function MarketingRootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${brandFontVariables} mode-workspace antialiased`}>
      <body className="min-h-dvh bg-bg text-ink">{children}</body>
    </html>
  );
}
