"use client";

import { Check } from "lucide-react";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import { applyTheme, useTheme } from "@/components/theme/use-theme";
import { MediaArt } from "@/components/media/media-art";
import { Button } from "@/components/ui/button";
import { Eyebrow } from "@/components/ui/misc";
import { toast } from "@/components/ui/toast";
import { getMedia } from "@/content/media";
import { MODES, PALETTES, serializeTheme, themeClassName, TYPES, type Theme } from "@/lib/theme";
import { cn } from "@/lib/utils";

/*
  Settings → Appearance (design/explorations/Appearance.dc.html).
  Choose palette, mode and typography, preview, then apply. Applying saves the
  choice (a cookie now; the user's preferences row once accounts exist in Phase 3).
*/
const SETTINGS_NAV = ["Profile", "Workspace", "Brand profiles", "Team", "Billing", "Appearance", "Notifications"];

export function AppearanceScreen() {
  const applied = useTheme();
  const [draft, setDraft] = useState<Theme | null>(null);
  const pending = draft ?? applied;
  const dirty = draft !== null && serializeTheme(draft) !== serializeTheme(applied);
  const set = (patch: Partial<Theme>) => setDraft({ ...pending, ...patch });
  const paletteName = PALETTES.find((p) => p.id === pending.palette)!.name;
  const modeName = MODES.find((m) => m.id === pending.mode)!.name;
  const typeName = TYPES.find((t) => t.id === pending.type)!.name;

  return (
    <div className="flex min-h-full flex-col lg:flex-row">
      <nav aria-label="Settings" className="flex shrink-0 gap-1 overflow-x-auto border-b border-line px-4 py-3 text-sm lg:w-60 lg:flex-col lg:border-r lg:border-b-0 lg:px-4 lg:py-8">
        <Eyebrow className="hidden px-3 pb-2 lg:block">Settings</Eyebrow>
        {SETTINGS_NAV.map((item) =>
          item === "Appearance" ? (
            <span key={item} aria-current="page" className="shrink-0 rounded-[10px] bg-surface-muted px-3 py-2.5 font-semibold text-link">
              {item}
            </span>
          ) : (
            <span key={item} aria-disabled="true" className="flex shrink-0 items-center justify-between gap-3 rounded-[10px] px-3 py-2.5 text-ink-muted">
              {item}
              <span className="hidden font-mono text-[10px] uppercase lg:inline">soon</span>
            </span>
          ),
        )}
      </nav>

      <div className="flex min-w-0 flex-1 flex-col gap-8 px-4 py-8 sm:px-6 lg:px-10">
        <header className="flex flex-col gap-2">
          <h1 className="font-display text-[clamp(32px,3.6vw,44px)] leading-none font-semibold tracking-display">Appearance</h1>
          <p className="max-w-2xl text-ink-muted">Choose a palette, a mode and a type style. Preview first, then apply. Your choice is saved on this device for now, and to your account once sign-in arrives.</p>
        </header>

        <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_400px]">
          <div className="flex min-w-0 flex-col gap-8">
            <Group title="Palette" id="pal">
              <div className="grid grid-cols-[repeat(auto-fill,minmax(190px,1fr))] gap-3">
                {PALETTES.map((p) => (
                  <Choice key={p.id} pressed={pending.palette === p.id} onClick={() => set({ palette: p.id })}>
                    <span className={cn(p.className, "mode-workspace flex h-16")} aria-hidden>
                      {["bg-primary", "bg-action", "bg-tint", "bg-surface-muted", "bg-ink"].map((c) => (
                        <span key={c} className={cn("flex-1", c)} />
                      ))}
                    </span>
                    <span className="flex items-center justify-between gap-2 px-3.5 py-3">
                      <span className="text-[13px] font-semibold">{p.name}</span>
                      <span className="shrink-0 font-mono text-[11px] text-ink-muted">{p.id === "crossroads" ? "Brand" : p.id}</span>
                    </span>
                  </Choice>
                ))}
              </div>
            </Group>

            <Group title="Mode" id="mode">
              <div className="grid gap-3 sm:grid-cols-2">
                {MODES.map((m) => (
                  <Choice key={m.id} pressed={pending.mode === m.id} onClick={() => set({ mode: m.id })} className="flex-row items-center gap-3.5 p-3.5">
                    <span className={cn(PALETTES.find((p) => p.id === pending.palette)!.className, m.className, "flex h-12 w-18 shrink-0 flex-col gap-1 rounded-[10px] border border-line bg-bg p-1.5")} aria-hidden>
                      <span className="h-1.5 w-3/5 rounded-sm bg-ink" />
                      <span className="h-1.5 w-2/5 rounded-sm bg-primary" />
                    </span>
                    <span className="flex flex-col gap-0.5 text-left">
                      <span className="font-semibold">{m.name}</span>
                      <span className="text-xs text-ink-muted">{m.note}</span>
                    </span>
                  </Choice>
                ))}
              </div>
            </Group>

            <Group title="Typography" id="type" note="No final type style has been chosen yet; all three are available.">
              <div className="grid gap-3 sm:grid-cols-3">
                {TYPES.map((t) => (
                  <Choice key={t.id} pressed={pending.type === t.id} onClick={() => set({ type: t.id })} className={cn(t.className, "gap-2.5 p-4 text-left")}>
                    <span className="font-display text-4xl leading-none font-semibold tracking-[-0.03em]" aria-hidden>
                      Aa
                    </span>
                    <span className="font-semibold">{t.name}</span>
                    <span className="font-sans text-xs text-ink-muted">{t.note}</span>
                  </Choice>
                ))}
              </div>
            </Group>
          </div>

          {/* Live preview of the pending theme, scoped to this panel. */}
          <aside aria-label="Theme preview" className="flex flex-col gap-2.5 xl:sticky xl:top-8 xl:self-start">
            <Eyebrow>Preview</Eyebrow>
            <div className={cn(themeClassName(pending), "overflow-hidden rounded-2xl border border-line bg-bg font-sans text-ink")}>
              <div className="flex items-center justify-between border-b border-line px-3.5 py-3 text-xs">
                <span className="font-semibold">Lakefront stay · 30s</span>
                <span className="rounded-[8px] bg-primary px-3 py-1.5 font-semibold text-primary-foreground">Export</span>
              </div>
              <div className="flex flex-col gap-2.5 p-3">
                <div className="relative aspect-video overflow-hidden rounded-xl">
                  <MediaArt asset={getMedia("coast-sail")} />
                  <span className="absolute bottom-3 left-3 font-display text-[22px] font-bold tracking-[-0.02em] text-on-media">
                    Golden hour, <em className="font-accent font-normal">every day.</em>
                  </span>
                </div>
                <div className="relative flex flex-col gap-1.5 rounded-xl bg-surface p-3">
                  <div className="flex h-[18px] gap-1">
                    {[3, 2, 4, 2].map((f, i) => (
                      <span key={i} className="rounded-[5px] bg-primary" style={{ flex: f }} />
                    ))}
                  </div>
                  <div className="flex h-3 gap-1">
                    <span className="flex-1" />
                    <span className="flex-[3] rounded bg-tint" />
                    <span className="flex-[6]" />
                  </div>
                  <div className="flex justify-between font-mono text-[10px] text-ink-muted">
                    <span>00:00</span>
                    <span>00:15</span>
                    <span>00:30</span>
                  </div>
                  <span className="absolute top-2 bottom-7 left-[38%] w-0.5 rounded-pill bg-ai" />
                </div>
                <div className="flex flex-col gap-2 rounded-xl bg-surface p-3 text-xs">
                  <span className="font-mono text-[10px] text-ink-muted">ASSISTANT</span>
                  <span className="self-end rounded-[10px] bg-ai px-2.5 py-2 text-ai-foreground">Make it warmer</span>
                  <span className="rounded-[10px] bg-surface-muted px-2.5 py-2">Colour grade applied to 6 clips.</span>
                </div>
              </div>
            </div>
          </aside>
        </div>

        <div className="sticky bottom-4 z-10 mt-auto flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-surface px-4 py-3.5 shadow-card">
          <p role="status" className="flex items-center gap-2.5 text-sm">
            <span aria-hidden className={cn("size-2 rounded-full", dirty ? "bg-ai" : "bg-ink-muted")} />
            {dirty ? `Previewing ${paletteName} · ${modeName} · ${typeName}. Not applied yet.` : "This is your current theme."}
          </p>
          <div className="flex gap-2">
            <Button variant="secondary" disabled={!dirty} onClick={() => setDraft(null)}>
              Reset
            </Button>
            <Button
              variant="primary"
              disabled={!dirty}
              onClick={() => {
                applyTheme(pending);
                setDraft(null);
                toast({ title: "Theme applied", description: `${paletteName} · ${modeName} · ${typeName}`, tone: "success" });
              }}
            >
              Apply theme
            </Button>
          </div>
        </div>
        <p className="text-xs text-ink-muted">
          The public website always uses the Crossroads Blue brand theme. <Link href="/dashboard" className="text-link underline">Back to dashboard</Link>
        </p>
      </div>
    </div>
  );
}

function Group({ title, id, note, children }: { title: string; id: string; note?: string; children: ReactNode }) {
  return (
    <section aria-labelledby={`${id}-h`} className="flex flex-col gap-3.5">
      <div className="flex flex-col gap-0.5">
        <h2 id={`${id}-h`} className="text-[15px] font-semibold">
          {title}
        </h2>
        {note && <p className="text-xs text-ink-muted">{note}</p>}
      </div>
      {children}
    </section>
  );
}

function Choice({ pressed, onClick, className, children }: { pressed: boolean; onClick: () => void; className?: string; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={cn(
        "relative flex flex-col overflow-hidden rounded-2xl border bg-surface text-left text-ink transition-shadow",
        pressed ? "border-ink ring-2 ring-ink" : "border-line hover:border-line-strong",
        className,
      )}
    >
      {children}
      {pressed && (
        <span className="absolute top-2 right-2 inline-flex size-5 items-center justify-center rounded-full bg-ink text-bg" aria-hidden>
          <Check className="size-3" strokeWidth={3} />
        </span>
      )}
    </button>
  );
}
