import type { Metadata } from "next";
import { ContrastTable } from "@/components/review/contrast-table";
import { Eyebrow } from "@/components/ui/misc";

export const metadata: Metadata = { title: "Contrast" };

export default function ContrastPage() {
  return (
    <div className="mx-auto w-full max-w-[1600px] px-5 pb-24 sm:px-8 lg:px-10">
      <div className="flex flex-col gap-3 py-12">
        <Eyebrow>WCAG 2.2 AA · text 4.5:1 · focus and controls 3:1</Eyebrow>
        <h1 className="font-display text-[length:var(--rd-display-sm)] leading-[0.95] font-semibold tracking-display">
          Contrast <em className="font-accent font-normal">checks</em>
        </h1>
        <p className="max-w-2xl text-ink-muted">
          Measured live from the browser for every palette and mode. The same pairs are checked automatically in
          <code className="mx-1 font-mono text-sm">npm run check</code>. Value changes made to pass are listed in
          docs/decisions.md.
        </p>
      </div>
      <ContrastTable />
    </div>
  );
}
