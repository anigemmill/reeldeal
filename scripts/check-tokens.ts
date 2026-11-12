/*
  Semantic-token guard (npm run check:tokens). Phase 1 rule: components use
  semantic tokens only, so every palette and mode re-themes them.

  Fails on, in src/components and src/app:
  - raw colour literals (#hex, rgb(), hsl(), oklch()) in components and pages
  - fixed brand colour utilities (bg-electric, text-orange, bg-dark-*, …)
  - Tailwind's default palette (bg-blue-500, text-gray-700, …)

  Allowed exceptions (documented in docs/decisions.md):
  - src/components/brand/: logo mark and footer wordmark keep the brand gradient
  - src/components/media/: placeholder artwork and over-image overlays (black/white on photos)
*/
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOTS = ["src/components", "src/app"];
const ALLOW = ["src/components/brand/", "src/components/media/", "src/app/globals.css"];
const BRAND = "electric|bleu-ciel|sky|sky-soft|ice|ice-page|charcoal|orange|orange-deep|dark-[a-z0-9]+";
const DEFAULTS =
  "slate|gray|zinc|neutral|stone|red|amber|yellow|lime|green|emerald|teal|cyan|blue|indigo|violet|purple|fuchsia|pink|rose";
const PREFIX = "(?:bg|text|border|ring|ring-offset|outline|fill|stroke|from|via|to|decoration|divide|shadow|caret|accent|placeholder)";

const checks: { name: string; re: RegExp }[] = [
  { name: "raw colour literal", re: /#[0-9a-fA-F]{3,8}\b(?![\w-])|\b(?:rgba?|hsla?|oklch|oklab)\(/g },
  { name: "fixed brand colour class", re: new RegExp(`(?<![\\w-])${PREFIX}-(?:${BRAND})(?![\\w-])`, "g") },
  { name: "Tailwind default palette class", re: new RegExp(`(?<![\\w-])${PREFIX}-(?:${DEFAULTS})-\\d{2,3}(?![\\w-])`, "g") },
  { name: "black/white class", re: new RegExp(`(?<![\\w-])${PREFIX}-(?:black|white)(?![\\w-])`, "g") },
];

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : /\.(tsx?|css)$/.test(p) && !/\.test\.tsx?$/.test(p) ? [p] : [];
  });
}

const problems: string[] = [];
for (const file of ROOTS.flatMap(walk)) {
  const rel = relative(".", file).replaceAll("\\", "/");
  if (ALLOW.some((a) => rel.startsWith(a))) continue;
  readFileSync(file, "utf8")
    .split("\n")
    .forEach((line, i) => {
      if (/^\s*(\/\/|\*|\/\*)/.test(line)) return;
      for (const c of checks) {
        for (const m of line.matchAll(c.re)) problems.push(`${rel}:${i + 1}  ${c.name}: ${m[0]}`);
      }
    });
}

if (problems.length) {
  console.error(`✗ ${problems.length} non-semantic colour use(s). Use semantic tokens (bg-surface, text-ink, bg-primary, …):\n`);
  console.error(problems.map((p) => `  ${p}`).join("\n"));
  process.exit(1);
}
console.log("✓ Components use semantic tokens only");
