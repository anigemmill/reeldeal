/*
  Theme identifiers. Colour and font values live only in tokens/tokens.css; this
  file names the classes so code can apply them, and defines how the user's choice
  is stored (a cookie, read before first paint by themeScript()).
*/

/** "crossroads" is the brand default (no palette class); 01–06 are the brief's palettes. */
export const PALETTES = [
  { id: "crossroads", name: "Crossroads Blue", note: "Brand default", className: "palette-crossroads" },
  { id: "01", name: "Cream / Blue / Orange", note: "Palette 01", className: "palette-01" },
  { id: "02", name: "June Bud / Orange / Dark Blue", note: "Palette 02", className: "palette-02" },
  { id: "03", name: "Tangerine / Pistachio / Retro Green", note: "Palette 03", className: "palette-03" },
  { id: "04", name: "Altitude", note: "Palette 04", className: "palette-04" },
  { id: "05", name: "Electric Blue / Orange / Charcoal", note: "Palette 05", className: "palette-05" },
  { id: "06", name: "Fold / Bone White / Blue", note: "Palette 06", className: "palette-06" },
] as const;

export const MODES = [
  { id: "workspace", name: "Light Workspace", note: "Bright, for planning and review", className: "mode-workspace" },
  { id: "studio", name: "Dark Studio", note: "Low glare, for editing", className: "mode-studio" },
] as const;

export const TYPES = [
  { id: "a", name: "Option A", note: "Space Grotesk + Inter + Geist Mono", className: "type-a" },
  { id: "b", name: "Option B", note: "Sora + DM Sans + Geist Mono", className: "type-b" },
  { id: "c", name: "Option C", note: "Manrope + Geist Mono", className: "type-c" },
] as const;

export type PaletteId = (typeof PALETTES)[number]["id"];
export type ModeId = (typeof MODES)[number]["id"];
export type TypeId = (typeof TYPES)[number]["id"];
export type Theme = { palette: PaletteId; mode: ModeId; type: TypeId };

export const DEFAULT_THEME: Theme = { palette: "crossroads", mode: "workspace", type: "a" };

export function isTheme(value: unknown): value is Theme {
  if (!value || typeof value !== "object") return false;
  const t = value as Record<string, unknown>;
  return (
    PALETTES.some((p) => p.id === t.palette) &&
    MODES.some((m) => m.id === t.mode) &&
    TYPES.some((x) => x.id === t.type)
  );
}

/** Classes for a theme, e.g. "palette-03 mode-studio type-b". */
export function themeClassName(theme: Theme): string {
  if (!isTheme(theme)) throw new Error(`Unknown theme: ${JSON.stringify(theme)}`);
  return [
    PALETTES.find((p) => p.id === theme.palette)!.className,
    MODES.find((m) => m.id === theme.mode)!.className,
    TYPES.find((x) => x.id === theme.type)!.className,
  ]
    .filter(Boolean)
    .join(" ");
}

/** Every class a theme can set; used to clear the old theme before applying a new one. */
export const ALL_THEME_CLASSES: readonly string[] = [...PALETTES, ...MODES, ...TYPES]
  .map((x) => x.className)
  .filter((c): c is NonNullable<typeof c> => Boolean(c));

/* ---- Persistence ------------------------------------------------------- */

export const THEME_COOKIE = "rd-theme";

/** Cookie value, e.g. "03.studio.b". */
export function serializeTheme(theme: Theme): string {
  return `${theme.palette}.${theme.mode}.${theme.type}`;
}

export function parseTheme(value: string | undefined | null): Theme | null {
  if (!value) return null;
  const [palette, mode, type] = value.split(".");
  const theme = { palette, mode, type };
  return isTheme(theme) ? theme : null;
}

/*
  Inline script for <head> on themed root layouts. Runs before first paint, reads
  the cookie and swaps the theme classes on <html>, so pages stay statically
  rendered without a flash of the default theme. Invalid cookies are ignored.
*/
export function themeScript(): string {
  const classes: Record<string, Record<string, string>> = {
    palette: Object.fromEntries(PALETTES.map((p) => [p.id, p.className ?? ""])),
    mode: Object.fromEntries(MODES.map((m) => [m.id, m.className])),
    type: Object.fromEntries(TYPES.map((t) => [t.id, t.className])),
  };
  return `(function(){try{var m=document.cookie.match(/(?:^|; )${THEME_COOKIE}=([^;]+)/);if(!m)return;var v=decodeURIComponent(m[1]).split(".");var c=${JSON.stringify(classes)};var p=c.palette[v[0]],o=c.mode[v[1]],t=c.type[v[2]];if(p===undefined||!o||!t)return;var e=document.documentElement;${JSON.stringify(ALL_THEME_CLASSES)}.forEach(function(k){e.classList.remove(k)});[p,o,t].forEach(function(k){if(k)e.classList.add(k)})}catch(_){}})()`;
}
