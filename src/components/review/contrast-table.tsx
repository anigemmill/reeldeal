"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { CONTRAST_PAIRS, contrastRatio, parseComputedColor } from "@/lib/contrast";
import { MODES, PALETTES } from "@/lib/theme";

/*
  Live contrast check: renders a hidden probe per palette × mode, reads the
  browser's computed colours (including color-mix values) and computes WCAG ratios.
*/
type Result = { set: string; label: string; rows: { use: string; pair: string; ratio: number; min: number }[] };

export function ContrastTable() {
  const [results, setResults] = useState<Result[] | null>(null);

  useEffect(() => {
    const host = document.createElement("div");
    host.style.cssText = "position:absolute;width:0;height:0;overflow:hidden";
    document.body.appendChild(host);
    const read = (el: HTMLElement, token: string) => {
      el.style.color = `var(--rd-${token})`;
      return parseComputedColor(getComputedStyle(el).color);
    };
    const out: Result[] = [];
    for (const p of PALETTES) {
      for (const m of MODES) {
        const probe = document.createElement("span");
        probe.className = `${p.className} ${m.className}`;
        host.appendChild(probe);
        out.push({
          set: `${p.id}-${m.id}`,
          label: `${p.id === "crossroads" ? "Crossroads" : `Palette ${p.id}`} · ${m.name}`,
          rows: CONTRAST_PAIRS.map((pair) => {
            const fg = read(probe, pair.fg);
            const bg = read(probe, pair.bg);
            return { use: pair.use, pair: `${pair.fg} on ${pair.bg}`, min: pair.min, ratio: fg && bg ? contrastRatio(fg, bg) : 0 };
          }),
        });
      }
    }
    host.remove();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- measured once from the DOM
    setResults(out);
  }, []);

  if (!results) return <p className="text-sm text-ink-muted">Measuring…</p>;
  const failures = results.flatMap((r) => r.rows.filter((x) => x.ratio < x.min).map((x) => ({ ...x, set: r.label })));

  return (
    <div className="flex flex-col gap-8">
      <p role="status" className="text-sm">
        {failures.length === 0 ? (
          <Badge tone="success">All {results.length * CONTRAST_PAIRS.length} checks pass</Badge>
        ) : (
          <Badge tone="danger">{failures.length} checks below target</Badge>
        )}
      </p>
      <div className="grid gap-5 lg:grid-cols-2">
        {results.map((r) => (
          <table key={r.set} className="w-full border-collapse rounded-lg border border-line bg-surface text-sm">
            <caption className="p-3 text-left font-display text-base font-semibold">{r.label}</caption>
            <thead>
              <tr className="text-left font-mono text-[11px] tracking-label text-ink-muted uppercase">
                <th scope="col" className="border-y border-line px-3 py-2 font-medium">Use</th>
                <th scope="col" className="border-y border-line px-3 py-2 font-medium">Tokens</th>
                <th scope="col" className="border-y border-line px-3 py-2 text-right font-medium">Ratio</th>
              </tr>
            </thead>
            <tbody>
              {r.rows.map((x) => (
                <tr key={x.pair} className="border-b border-line last:border-0">
                  <td className="px-3 py-1.5">{x.use}</td>
                  <td className="px-3 py-1.5 font-mono text-xs text-ink-muted">{x.pair}</td>
                  <td className="px-3 py-1.5 text-right font-mono text-xs">
                    <span className={x.ratio >= x.min ? "text-success" : "font-semibold text-danger"}>
                      {x.ratio.toFixed(2)}
                    </span>
                    <span className="text-ink-muted"> / {x.min}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ))}
      </div>
    </div>
  );
}
