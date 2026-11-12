/*
  Theme identifiers. The colour values live only in tokens/tokens.css; this file
  just names the classes so code can apply them. Selection UI, preview and saving
  the user's choice come later (Settings → Appearance).
*/

/** "crossroads" is the brand default (no palette class); 01–06 are the brief's palettes. */
export const PALETTES = [
  { id: "crossroads", name: "Crossroads Blue (brand default)", className: null },
  { id: "01", name: "Cream / Blue / Orange", className: "palette-01" },
  { id: "02", name: "June Bud / Orange / Dark Blue", className: "palette-02" },
  { id: "03", name: "Tangerine / Pistachio / Retro Green", className: "palette-03" },
  { id: "04", name: "Altitude", className: "palette-04" },
  { id: "05", name: "Electric Blue / Orange / Charcoal", className: "palette-05" },
  { id: "06", name: "Fold / Bone White / Blue", className: "palette-06" },
] as const;

export const MODES = [
  { id: "workspace", name: "Light Workspace", className: "mode-workspace" },
  { id: "studio", name: "Dark Studio", className: "mode-studio" },
] as const;

export type PaletteId = (typeof PALETTES)[number]["id"];
export type ModeId = (typeof MODES)[number]["id"];
export type Theme = { palette: PaletteId; mode: ModeId };

export const DEFAULT_THEME: Theme = { palette: "crossroads", mode: "workspace" };

/** Classes to put on <html> for a theme, e.g. "palette-03 mode-studio". */
export function themeClassName({ palette, mode }: Theme): string {
  const p = PALETTES.find((x) => x.id === palette);
  const m = MODES.find((x) => x.id === mode);
  if (!p || !m) throw new Error(`Unknown theme: ${palette} / ${mode}`);
  return [p.className, m.className].filter(Boolean).join(" ");
}
