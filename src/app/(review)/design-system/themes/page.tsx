import type { Metadata } from "next";
import { Sparkles } from "lucide-react";
import { MediaThumb } from "@/components/media/media-thumb";
import { AiBadge, Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Eyebrow } from "@/components/ui/misc";
import { getMedia } from "@/content/media";
import { MODES, PALETTES } from "@/lib/theme";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Themes" };

/*
  Every palette in both modes, side by side. Each card sets its own palette and
  mode classes; typography follows the toolbar.
*/
export default function ThemesPage() {
  const media = [getMedia("lake-kayak"), getMedia("coast-sail"), getMedia("vineyard-gold")];
  return (
    <div className="mx-auto w-full max-w-[1600px] px-5 pb-24 sm:px-8 lg:px-10">
      <div className="flex flex-col gap-3 py-12">
        <Eyebrow>7 palettes × 2 modes</Eyebrow>
        <h1 className="font-display text-[length:var(--rd-display-sm)] leading-[0.95] font-semibold tracking-display">
          Theme <em className="font-accent font-normal">comparison</em>
        </h1>
        <p className="max-w-2xl text-ink-muted">
          Crossroads Blue (brand) and the six palettes from the brief, each in Light Workspace and Dark Studio. Switch the
          typography in the toolbar to compare all three type combinations.
        </p>
      </div>
      <div className="grid gap-5 md:grid-cols-2">
        {PALETTES.map((p, pi) =>
          MODES.map((m) => (
            <section
              key={`${p.id}-${m.id}`}
              aria-label={`${p.name}, ${m.name}`}
              className={cn(p.className, m.className, "flex flex-col gap-4 overflow-hidden rounded-xl border border-line bg-bg p-5 text-ink")}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <Eyebrow>
                    {p.note} · {m.name}
                  </Eyebrow>
                  <h2 className="mt-1 font-display text-xl font-semibold tracking-tight">{p.name}</h2>
                </div>
                <div className="flex gap-1" aria-hidden>
                  {["bg-primary", "bg-action", "bg-tint", "bg-surface-muted", "bg-ink"].map((c) => (
                    <span key={c} className={cn("size-5 rounded-full border border-line", c)} />
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-[1.2fr_1fr] gap-4 rounded-lg border border-line bg-surface p-4">
                <div className="flex flex-col gap-3">
                  <p className="font-display text-2xl leading-tight font-semibold tracking-tight">
                    Golden hour, <em className="font-accent font-normal">every day.</em>
                  </p>
                  <p className="text-sm text-ink-muted">Lakefront stay · 30s reel · 9:16</p>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="primary" size="sm">
                      Export
                    </Button>
                    <Button variant="action" size="sm">
                      <Sparkles aria-hidden />
                      Generate
                    </Button>
                    <Button variant="secondary" size="sm">
                      Edit
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <AiBadge size="sm">Best moment</AiBadge>
                    <Badge size="sm" tone="success">
                      Ready
                    </Badge>
                    <Badge size="sm" tone="warning">
                      Low light
                    </Badge>
                    <Badge size="sm" tone="danger">
                      Failed
                    </Badge>
                  </div>
                </div>
                <MediaThumb asset={media[pi % 3]} ratio="4:5" score={92} showTag={false} />
              </div>

              {/* Mini timeline: clips use primary, text uses tint, the playhead is AI. */}
              <div className="relative flex flex-col gap-1.5 rounded-lg bg-surface-muted p-3" aria-hidden>
                <div className="flex h-6 gap-1">
                  {[3, 2, 4, 2].map((f, i) => (
                    <span key={i} className="rounded-sm bg-primary/85" style={{ flex: f }} />
                  ))}
                </div>
                <div className="flex h-4 gap-1">
                  <span className="flex-1" />
                  <span className="flex-[3] rounded-sm bg-tint" />
                  <span className="flex-[6]" />
                </div>
                <div className="flex justify-between font-mono text-[10px] text-ink-muted">
                  <span>00:00</span>
                  <span>00:15</span>
                  <span>00:30</span>
                </div>
                <span className="absolute top-1.5 bottom-6 left-[38%] w-0.5 rounded-pill bg-ai" />
              </div>
            </section>
          )),
        )}
      </div>
    </div>
  );
}
