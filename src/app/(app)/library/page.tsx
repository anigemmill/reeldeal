import type { Metadata } from "next";

export const metadata: Metadata = { title: "Library" };

// PHASE 0 PLACEHOLDER. The Library screen (design/app/A-Library.dc.html) is built in Phase 3.
export default function LibraryPage() {
  return (
    <main className="flex flex-1 flex-col justify-center gap-4 px-6 py-20">
      <p className="font-mono text-xs uppercase tracking-label text-ink-muted">
        Placeholder · Phase 0 scaffold
      </p>
      <h1 className="font-display text-4xl font-semibold tracking-display">App · Library</h1>
      <p className="max-w-prose text-ink-muted">
        App route group. No authentication, uploads or media yet.
      </p>
    </main>
  );
}
