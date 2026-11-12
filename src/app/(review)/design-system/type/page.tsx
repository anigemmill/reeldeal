import type { Metadata } from "next";
import { AiBadge, Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Eyebrow } from "@/components/ui/misc";
import { TYPES } from "@/lib/theme";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Typography" };

const ROWS = [
  ["Summer reel · 9:16", "00:30", "Ready", "2 credits"],
  ["Lakefront stay · 1:1", "00:15", "Rendering", "1 credit"],
  ["Autumn offer · 16:9", "01:05", "Draft", "2 credits"],
];

/* The three type combinations side by side, in the toolbar's palette and mode. */
export default function TypePage() {
  return (
    <div className="mx-auto w-full max-w-[1600px] px-5 pb-24 sm:px-8 lg:px-10">
      <div className="flex flex-col gap-3 py-12">
        <Eyebrow>Brief §5 · no final choice yet</Eyebrow>
        <h1 className="font-display text-[length:var(--rd-display-sm)] leading-[0.95] font-semibold tracking-display">
          Typography <em className="font-accent font-normal">comparison</em>
        </h1>
        <p className="max-w-2xl text-ink-muted">
          Each column is one combination. Instrument Serif italic is the accent in all three; Geist Mono carries timecodes
          and labels. Use the toolbar to see them in any palette and mode.
        </p>
      </div>
      <div className="grid gap-5 lg:grid-cols-3">
        {TYPES.map((t) => (
          <section key={t.id} aria-labelledby={`type-${t.id}`} className={cn(t.className, "flex flex-col gap-6 rounded-xl border border-line bg-surface p-6")}>
            <div>
              <Eyebrow>{t.name}</Eyebrow>
              <h2 id={`type-${t.id}`} className="mt-1 text-sm font-medium text-ink-muted">
                {t.note}
              </h2>
            </div>
            <p className="font-display text-[clamp(40px,4.4vw,64px)] leading-[0.95] font-semibold tracking-display">
              Your footage, <em className="font-accent font-normal">finished.</em>
            </p>
            <h3 className="font-display text-2xl font-semibold tracking-tight">Three storyboards, ready to review</h3>
            <p className="text-[15px] leading-relaxed text-ink-soft">
              Upload a folder of clips from your season. Reeldeal finds the best moments, matches your brand and builds
              short videos for every channel. Change anything by asking, or open the Studio for full control.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="primary" size="sm">
                Start free
              </Button>
              <Button variant="secondary" size="sm">
                Book a demo
              </Button>
              <AiBadge size="sm">Analysing</AiBadge>
              <Badge size="sm" tone="outline">
                9:16
              </Badge>
            </div>
            <table className="w-full border-collapse text-sm">
              <caption className="sr-only">Sample render queue</caption>
              <thead>
                <tr className="text-left">
                  {["Video", "Length", "Status", "Cost"].map((h) => (
                    <th key={h} scope="col" className="border-b border-line pb-2 font-mono text-[11px] font-medium tracking-label text-ink-muted uppercase">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ROWS.map((r) => (
                  <tr key={r[0]} className="border-b border-line last:border-0">
                    <td className="py-2.5 font-medium">{r[0]}</td>
                    <td className="py-2.5 font-mono text-[13px] text-ink-muted">{r[1]}</td>
                    <td className="py-2.5">{r[2]}</td>
                    <td className="py-2.5 font-mono text-[13px] text-ink-muted">{r[3]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="font-mono text-xs text-ink-muted">00:00:12:08 · 1920×1080 · 29.97 fps · ABCDEFGHIJ 0123456789</p>
          </section>
        ))}
      </div>
    </div>
  );
}
