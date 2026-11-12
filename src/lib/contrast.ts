/*
  Contrast rules checked for every palette × mode (WCAG 2.2 AA).
  Used by the automated test (src/lib/contrast.test.ts) and the live
  /design-system/contrast page, so both check the same pairs.
*/
export type ContrastPair = { fg: string; bg: string; min: number; use: string };

const TEXT = 4.5;
const UI = 3; // non-text: focus indicators, form control borders (WCAG 1.4.11)

export const CONTRAST_PAIRS: ContrastPair[] = [
  { fg: "ink", bg: "bg", min: TEXT, use: "Body text on page" },
  { fg: "ink", bg: "surface", min: TEXT, use: "Body text on cards" },
  { fg: "ink", bg: "surface-muted", min: TEXT, use: "Text on muted panels" },
  { fg: "on-tint", bg: "tint", min: TEXT, use: "Text on tint (timeline text clips, tags)" },
  { fg: "ink-soft", bg: "surface", min: TEXT, use: "Secondary text" },
  { fg: "ink-muted", bg: "bg", min: TEXT, use: "Muted text on page" },
  { fg: "ink-muted", bg: "surface", min: TEXT, use: "Muted text on cards" },
  { fg: "ink-muted", bg: "surface-muted", min: TEXT, use: "Muted text on muted panels" },
  { fg: "on-primary", bg: "primary", min: TEXT, use: "Primary button" },
  { fg: "on-action", bg: "action", min: TEXT, use: "Action button" },
  { fg: "on-ai", bg: "ai", min: TEXT, use: "AI badge" },
  { fg: "on-success", bg: "success", min: TEXT, use: "Success badge" },
  { fg: "on-warning", bg: "warning", min: TEXT, use: "Warning badge" },
  { fg: "on-danger", bg: "danger", min: TEXT, use: "Danger badge" },
  { fg: "success", bg: "surface", min: TEXT, use: "Success text" },
  { fg: "warning", bg: "surface", min: TEXT, use: "Warning text" },
  { fg: "danger", bg: "surface", min: TEXT, use: "Error message text" },
  { fg: "link", bg: "surface", min: TEXT, use: "Links on cards" },
  { fg: "link", bg: "bg", min: TEXT, use: "Links on page" },
  { fg: "link", bg: "surface-muted", min: TEXT, use: "Active nav item" },
  { fg: "focus", bg: "bg", min: UI, use: "Focus ring on page" },
  { fg: "focus", bg: "surface", min: UI, use: "Focus ring on cards" },
  { fg: "field-line", bg: "surface", min: UI, use: "Form control border" },
];

export type RGB = [number, number, number];

export function luminance([r, g, b]: RGB): number {
  const lin = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

export function contrastRatio(a: RGB, b: RGB): number {
  const [x, y] = [luminance(a), luminance(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

/** Parse "rgb(1, 2, 3)" / "rgba(...)" / "color(srgb r g b)" as returned by getComputedStyle. */
export function parseComputedColor(value: string): RGB | null {
  const rgb = value.match(/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/);
  if (rgb) return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])];
  const srgb = value.match(/color\(srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)/);
  if (srgb) return [Number(srgb[1]) * 255, Number(srgb[2]) * 255, Number(srgb[3]) * 255];
  return null;
}
