import type { Metadata } from "next";
import Link from "next/link";
import { brandFontVariables } from "./fonts";
import "./globals.css";

export const metadata: Metadata = { title: "Page not found · Reeldeal" };

// Multiple root layouts mean there is no shared layout for unmatched URLs.
export default function GlobalNotFound() {
  return (
    <html lang="en" className={`${brandFontVariables} mode-workspace antialiased`}>
      <body className="grid min-h-dvh place-items-center bg-bg p-6 text-ink">
        <main className="flex max-w-md flex-col gap-4 text-center">
          <p className="font-mono text-xs uppercase tracking-label text-ink-muted">404</p>
          <h1 className="font-display text-4xl font-semibold tracking-display">
            This page <em className="font-accent font-normal">isn&apos;t here</em>
          </h1>
          <Link href="/" className="font-medium text-link underline underline-offset-4">
            Back to the homepage
          </Link>
        </main>
      </body>
    </html>
  );
}
