/*
  Resolves tokens/tokens.css for a given set of classes on <html>, the way the
  browser would, so contrast can be tested without a browser. Supports the
  subset tokens.css uses: :root and class selectors (all specificity 0,1,0, so
  source order decides), var() with fallbacks, #hex, rgb()/rgba() and
  color-mix(in srgb, …).
*/
import type { RGB } from "./contrast";

type Rule = { selectors: string[][]; decls: [string, string][] };

export function parseRules(css: string): Rule[] {
  const clean = css.replace(/\/\*[\s\S]*?\*\//g, "").replace(/@media[^{]*\{([\s\S]*?\})\s*\}/g, "");
  const rules: Rule[] = [];
  for (const m of clean.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selectors = m[1]
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => (s === ":root" ? [":root"] : s.split(".").filter(Boolean)));
    const decls: [string, string][] = [];
    for (const d of m[2].split(";")) {
      const i = d.indexOf(":");
      if (i < 0) continue;
      const name = d.slice(0, i).trim();
      if (name.startsWith("--")) decls.push([name, d.slice(i + 1).trim()]);
    }
    rules.push({ selectors, decls });
  }
  return rules;
}

/** Custom properties on <html> with the given classes (no inheritance involved). */
export function computeVars(rules: Rule[], classes: string[]): Map<string, string> {
  const has = new Set(classes);
  const vars = new Map<string, string>();
  for (const r of rules) {
    const match = r.selectors.some((sel) => (sel[0] === ":root" ? true : sel.every((c) => has.has(c))));
    if (match) for (const [k, v] of r.decls) vars.set(k, v);
  }
  return vars;
}

function splitTop(s: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let cur = "";
  for (const ch of s) {
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    if (ch === "," && depth === 0) {
      out.push(cur.trim());
      cur = "";
    } else cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

export function resolveVar(vars: Map<string, string>, value: string, depth = 0): string {
  if (depth > 20) throw new Error(`var() cycle in ${value}`);
  return value.replace(/var\((--[\w-]+)(?:,\s*([^()]*(?:\([^()]*\))?[^()]*))?\)/g, (_, name: string, fb?: string) => {
    const v = vars.get(name);
    if (v !== undefined) return resolveVar(vars, v, depth + 1);
    if (fb !== undefined) return resolveVar(vars, fb, depth + 1);
    throw new Error(`Undefined ${name}`);
  });
}

export function parseColor(expr: string): RGB {
  const e = expr.trim();
  const hex = e.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (hex) {
    const h = hex[1].length === 3 ? [...hex[1]].map((c) => c + c).join("") : hex[1];
    return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as RGB;
  }
  const rgb = e.match(/^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/);
  if (rgb) return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])];
  if (e.startsWith("color-mix(")) {
    const [space, a, b] = splitTop(e.slice("color-mix(".length, -1));
    if (space !== "in srgb") throw new Error(`Unsupported colour space: ${space}`);
    const part = (p: string) => {
      const m = p.match(/^(.*?)(?:\s+([\d.]+)%)?$/)!;
      return { color: m[1].trim(), pct: m[2] === undefined ? undefined : Number(m[2]) / 100 };
    };
    const [pa, pb] = [part(a), part(b)];
    const wa = pa.pct ?? (pb.pct !== undefined ? 1 - pb.pct : 0.5);
    const wb = pb.pct ?? 1 - wa;
    const [ca, cb] = [parseColor(pa.color), parseColor(pb.color)];
    return ca.map((v, i) => (v * wa + cb[i] * wb) / (wa + wb)) as RGB;
  }
  throw new Error(`Cannot parse colour: ${e}`);
}

export function tokenColor(vars: Map<string, string>, token: string): RGB {
  const raw = vars.get(`--rd-${token}`);
  if (raw === undefined) throw new Error(`Missing token --rd-${token}`);
  return parseColor(resolveVar(vars, raw));
}
