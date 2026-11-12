import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { MODES, PALETTES, parseTheme, serializeTheme, themeClassName, themeScript, TYPES } from "./theme";

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
    expect(PALETTES.filter((p) => p.id !== "crossroads")).toHaveLength(6);
    expect(MODES.map((m) => m.id)).toEqual(["workspace", "studio"]);
  });

  for (const palette of PALETTES.filter((p) => p.id !== "crossroads")) {
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

  it("defines all three typography combinations", () => {
    for (const t of TYPES) expect(css).toMatch(new RegExp(`\\.${t.className} \\{[^}]*--rd-font-display`));
  });

  it("builds class names for all 42 palette × mode × type combinations", () => {
    const all = PALETTES.flatMap((p) => MODES.flatMap((m) => TYPES.map((t) => themeClassName({ palette: p.id, mode: m.id, type: t.id }))));
    expect(new Set(all).size).toBe(42);
    expect(themeClassName({ palette: "03", mode: "studio", type: "b" })).toBe("palette-03 mode-studio type-b");
  });

  it("round-trips the cookie value and rejects bad input", () => {
    const t = { palette: "05", mode: "studio", type: "c" } as const;
    expect(parseTheme(serializeTheme(t))).toEqual(t);
    expect(parseTheme("99.studio.a")).toBeNull();
    expect(parseTheme("01.dark.a")).toBeNull();
    expect(parseTheme("<script>")).toBeNull();
    expect(parseTheme(undefined)).toBeNull();
  });

  it("produces a no-flash script that only applies known classes", () => {
    const html = { classList: new Set<string>(["palette-crossroads", "mode-workspace", "type-a", "antialiased"]) };
    const document = {
      cookie: "x=1; rd-theme=04.studio.b",
      documentElement: { classList: { add: (c: string) => html.classList.add(c), remove: (c: string) => html.classList.delete(c) } },
    };
    new Function("document", themeScript())(document);
    expect([...html.classList].sort()).toEqual(["antialiased", "mode-studio", "palette-04", "type-b"]);
  });
});
