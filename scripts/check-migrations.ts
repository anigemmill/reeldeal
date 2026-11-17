/*
  Migration safety (npm run check:migrations, part of npm run check).
  Fails on statements that drop or rewrite existing data or structure, so a
  destructive migration can never reach a real database unnoticed. A statement
  that is genuinely needed must be reviewed and marked on the same line with
  `-- reviewed: destructive` (and applied only with explicit approval).
*/
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { destructiveStatements } from "../src/server/db/migration-rules";

const DIR = "supabase/migrations";
const problems: string[] = [];
const files = readdirSync(DIR).filter((f) => f.endsWith(".sql")).sort();
let last = "";
for (const f of files) {
  if (!/^\d{14}_[a-z0-9_]+\.sql$/.test(f)) problems.push(`${f}: name must be <14-digit timestamp>_<snake_case>.sql (Supabase CLI format)`);
  if (f <= last) problems.push(`${f}: out of order`);
  last = f;
  for (const p of destructiveStatements(readFileSync(join(DIR, f), "utf8"))) problems.push(`${f}:${p.line}  ${p.rule}: ${p.text}`);
}
if (problems.length) {
  console.error(`✗ ${problems.length} migration problem(s):\n${problems.map((p) => `  ${p}`).join("\n")}`);
  process.exit(1);
}
console.log(`✓ ${files.length} migrations are additive only (no drops, truncates, deletes, row updates or type changes)`);
