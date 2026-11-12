import type { Metadata } from "next";
import { fontVariables } from "./fonts";
import { DEFAULT_THEME, themeClassName } from "@/lib/theme";
import "./globals.css";

export const metadata: Metadata = {
  // "Reeldeal" is the working name; confirm before launch (CLAUDE.md).
  title: { default: "Reeldeal", template: "%s · Reeldeal" },
  description: "[TAGLINE] AI video production for businesses.",
};

/*
  Shared root: <html>, fonts and global tokens only. The marketing website and
  the app each have their own layout in their route group.
*/
export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${fontVariables} ${themeClassName(DEFAULT_THEME)} antialiased`}>
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
