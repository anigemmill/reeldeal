/*
  Migration safety (npm run check:migrations, part of npm run check).
  Fails on statements that drop or rewrite existing data or structure, so a
  destructive migration can never reach a real database unnoticed. A statement
  that is genuinely needed must be reviewed and marked on the same line with
  `-- reviewed: destructive` (and applied only with explicit approval).
*/
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const DIR = "supabase/migrations";
const DESTRUCTIVE: [string, RegExp][] = [
  ["DROP", /\bdrop\s+(table|schema|column|type|view|materialized\s+view|function|index|policy|trigger|database|extension)\b/i],
  ["TRUNCATE", /\btruncate\b/i],
  ["DELETE", /\bdelete\s+from\b/i],
  ["UPDATE of rows", /\bupdate\s+(public|auth|private|storage)\.\w+\s+set\b/i],
  ["column type change", /\balter\s+column\s+\w+\s+(set\s+data\s+)?type\b/i],
  ["RENAME", /\brename\s+(to|column)\b/i],
  ["RLS disabled", /\b(disable|no\s+force)\s+row\s+level\s+security\b/i],
];
const problems: string[] = [];
const files = readdirSync(DIR).filter((f) => f.endsWith(".sql")).sort();
let last = "";
for (const f of files) {
  if (!/^\d{14}_[a-z0-9_]+\.sql$/.test(f)) problems.push(`${f}: name must be <14-digit timestamp>_<snake_case>.sql (Supabase CLI format)`);
  if (f <= last) problems.push(`${f}: out of order`);
  last = f;
  readFileSync(join(DIR, f), "utf8").split("\n").forEach((line, i) => {
    const code = line.replace(/--.*$/, "");
    if (/--\s*reviewed:\s*destructive/i.test(line)) return;
    for (const [what, re] of DESTRUCTIVE) if (re.test(code)) problems.push(`${f}:${i + 1}  ${what}: ${line.trim()}`);
  });
}
if (problems.length) {
  console.error(`✗ ${problems.length} migration problem(s):\n${problems.map((p) => `  ${p}`).join("\n")}`);
  process.exit(1);
}
console.log(`✓ ${files.length} migrations are additive only (no drops, truncates, deletes, row updates or type changes)`);
