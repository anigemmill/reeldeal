"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Select } from "@/components/ui/select";
import { SegmentedControl } from "@/components/ui/tabs";
import { ALL_THEME_CLASSES, DEFAULT_THEME, MODES, PALETTES, parseTheme, serializeTheme, themeClassName, TYPES, type Theme } from "@/lib/theme";
import { cn } from "@/lib/utils";

/*
  Design review toolbar. Sets palette, mode and type for the whole review page
  (on <html>, so dialogs and popovers follow). Not saved: the choice lives in the
  URL (?theme=03.studio.b) so a view can be shared. The user's real preference is
  set on the Appearance screen.
*/
const SECTIONS = [
  { href: "/design-system", label: "Components" },
  { href: "/design-system/themes", label: "Themes" },
  { href: "/design-system/type", label: "Typography" },
  { href: "/design-system/contrast", label: "Contrast" },
];

export function ReviewToolbar() {
  const pathname = usePathname();
  const [theme, setTheme] = useState<Theme>(DEFAULT_THEME);

  // Read ?theme= once on mount (keeps the pages statically rendered).
  useEffect(() => {
    const t = parseTheme(new URLSearchParams(location.search).get("theme"));
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time sync from the URL
    if (t) setTheme(t);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    ALL_THEME_CLASSES.forEach((c) => root.classList.remove(c));
    themeClassName(theme).split(" ").forEach((c) => root.classList.add(c));
    const url = new URL(location.href);
    url.searchParams.set("theme", serializeTheme(theme));
    history.replaceState(null, "", url);
  }, [theme]);

  const query = `?theme=${serializeTheme(theme)}`;
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-surface/95 backdrop-blur">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3 px-5 py-3 lg:px-8">
        <div className="flex items-center gap-3">
          <span className="font-display text-base font-bold tracking-tight">Reeldeal · Design review</span>
          <span className="rounded-pill bg-ai px-2 py-0.5 font-mono text-[10px] text-ai-foreground uppercase">Internal</span>
        </div>
        <nav aria-label="Design review" className="flex flex-wrap gap-1 text-sm">
          {SECTIONS.map((s) => {
            const current = s.href === "/design-system" ? pathname === s.href : pathname.startsWith(s.href);
            return (
              <Link
                key={s.href}
                href={`${s.href}${query}`}
                aria-current={current ? "page" : undefined}
                className={cn("rounded-pill px-3 py-1.5", current ? "bg-ink text-bg" : "text-ink-muted hover:bg-surface-muted hover:text-ink")}
              >
                {s.label}
              </Link>
            );
          })}
        </nav>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Select
            aria-label="Palette"
            className="h-9 w-64 text-sm"
            value={theme.palette}
            onValueChange={(v) => setTheme((t) => ({ ...t, palette: v as Theme["palette"] }))}
            options={PALETTES.map((p) => ({ value: p.id, label: p.id === "crossroads" ? `${p.name} (brand)` : `${p.id} · ${p.name}` }))}
          />
          <SegmentedControl
            label="Mode"
            size="sm"
            value={theme.mode}
            onValueChange={(v) => setTheme((t) => ({ ...t, mode: v as Theme["mode"] }))}
            options={MODES.map((m) => ({ value: m.id, label: m.id === "workspace" ? "Workspace" : "Studio", title: m.name }))}
          />
          <SegmentedControl
            label="Typography"
            size="sm"
            value={theme.type}
            onValueChange={(v) => setTheme((t) => ({ ...t, type: v as Theme["type"] }))}
            options={TYPES.map((x) => ({ value: x.id, label: x.id.toUpperCase(), title: x.note }))}
          />
        </div>
      </div>
    </header>
  );
}
