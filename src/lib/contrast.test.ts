import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CONTRAST_PAIRS, contrastRatio } from "./contrast";
import { MODES, PALETTES } from "./theme";
import { computeVars, parseRules, tokenColor } from "./token-resolver";

const rules = parseRules(readFileSync(new URL("../../tokens/tokens.css", import.meta.url), "utf8"));

describe("contrast (WCAG 2.2 AA) for every palette and mode", () => {
  for (const p of PALETTES) {
    for (const m of MODES) {
      it(`${p.id} · ${m.id}`, () => {
        const vars = computeVars(rules, [p.className, m.className]);
        const failures = CONTRAST_PAIRS.map((pair) => ({
          ...pair,
          ratio: contrastRatio(tokenColor(vars, pair.fg), tokenColor(vars, pair.bg)),
        }))
          .filter((r) => r.ratio < r.min)
          .map((r) => `${r.fg} on ${r.bg} = ${r.ratio.toFixed(2)} (needs ${r.min}) · ${r.use}`);
        expect(failures).toEqual([]);
      });
    }
  }
});

describe("token resolver", () => {
  it("matches the browser for a known Crossroads value", () => {
    const vars = computeVars(rules, ["palette-crossroads", "mode-workspace"]);
    expect(tokenColor(vars, "primary")).toEqual([0x20, 0x38, 0xe2]);
  });
  it("applies Studio over Workspace when both classes are on one element", () => {
    const vars = computeVars(rules, ["palette-03", "mode-studio"]);
    expect(tokenColor(vars, "bg")).toEqual([0x0b, 0x14, 0x0f]);
  });
});
