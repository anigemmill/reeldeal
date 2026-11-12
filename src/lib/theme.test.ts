import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { MODES, PALETTES, themeClassName } from "./theme";

const css = readFileSync(new URL("../../tokens/tokens.css", import.meta.url), "utf8");

/** Body of the first rule whose selector is exactly `.palette-0X`. */
function ruleBody(selector: string): string {
  const m = css.match(new RegExp(`(^|\\n)${selector.replace(".", "\\.")}\\s*\\{([^}]*)\\}`));
  return m ? m[2] : "";
}

// Values each palette must supply for both modes (the rest are derived in tokens.css).
const REQUIRED = [
  "bg", "surface", "surface-muted", "ink", "ink-muted", "line",
  "primary", "on-primary", "action", "on-action", "tint",
];

describe("theme tokens", () => {
  it("has six palettes plus the brand default, and two modes", () => {
    expect(PALETTES.filter((p) => p.className)).toHaveLength(6);
    expect(MODES.map((m) => m.id)).toEqual(["workspace", "studio"]);
  });

  for (const palette of PALETTES.filter((p) => p.className)) {
    it(`${palette.className} defines every Workspace and Studio value`, () => {
      const body = ruleBody(`.${palette.className}`);
      expect(body, `.${palette.className} rule missing`).not.toBe("");
      for (const set of ["ws", "st"]) {
        for (const key of REQUIRED) {
          expect(body, `--rd-${set}-${key}`).toMatch(new RegExp(`--rd-${set}-${key}:\\s*#[0-9A-Fa-f]{6};`));
        }
      }
    });
  }

  it("Crossroads Blue defines both sets in :root", () => {
    for (const set of ["ws", "st"]) {
      for (const key of [...REQUIRED, "line-strong", "ink-soft", "ink-disabled", "focus"]) {
        expect(css).toMatch(new RegExp(`--rd-${set}-${key}:`));
      }
    }
  });

  it("maps the semantic tokens in both modes", () => {
    for (const set of ["ws", "st"]) {
      expect(css).toMatch(new RegExp(`--rd-bg: var\\(--rd-${set}-bg\\)`));
      expect(css).toMatch(new RegExp(`--rd-primary: var\\(--rd-${set}-primary\\)`));
    }
  });

  it("builds class names for all 14 combinations", () => {
    const all = PALETTES.flatMap((p) => MODES.map((m) => themeClassName({ palette: p.id, mode: m.id })));
    expect(new Set(all).size).toBe(14);
    expect(themeClassName({ palette: "03", mode: "studio" })).toBe("palette-03 mode-studio");
    expect(themeClassName({ palette: "crossroads", mode: "workspace" })).toBe("mode-workspace");
  });
});
