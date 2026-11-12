import type { Metadata } from "next";
import { brandFontVariables } from "../fonts";
import "../globals.css";

export const metadata: Metadata = {
  // "Reeldeal" is the working name; confirm before launch (CLAUDE.md).
  title: { default: "Reeldeal", template: "%s · Reeldeal" },
  description: "[TAGLINE] AI video production for businesses.",
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
