/*
  Rules for npm run check:migrations (scripts/check-migrations.ts): statements that drop or
  rewrite existing data or structure. Kept here so they can be unit-tested.
*/
export const DESTRUCTIVE: [string, RegExp][] = [
  ["DROP", /\bdrop\s+(table|schema|column|type|view|materialized\s+view|function|index|policy|trigger|database|extension)\b/i],
  ["TRUNCATE", /\btruncate\b/i],
  ["DELETE", /\bdelete\s+from\b/i],
  ["UPDATE of rows", /\bupdate\s+(public|auth|private|storage)\.\w+\s+set\b/i],
  ["column type change", /\balter\s+column\s+\w+\s+(set\s+data\s+)?type\b/i],
  ["RENAME", /\brename\s+(to|column)\b/i],
  ["RLS disabled", /\b(disable|no\s+force)\s+row\s+level\s+security\b/i],
];

/*
  Statements inside a function body don't run when the migration is applied, only when the
  function is called: blank those bodies (keeping line numbers) before scanning. DO blocks
  are NOT blanked: they run during the migration and are checked like everything else.
*/
export function bodiesBlanked(sql: string) {
  return sql.replace(
    /(create\s+(?:or\s+replace\s+)?function\b[\s\S]*?\bas\s+)\$(\w*)\$([\s\S]*?)\$\2\$/gi,
    (_m, head: string, tag: string, body: string) => `${head}$${tag}$${body.replace(/[^\n]/g, " ")}$${tag}$`,
  );
}

/** Problems in one migration file: `line  rule: statement`. Lines marked `-- reviewed: destructive` are allowed. */
export function destructiveStatements(sql: string): { line: number; rule: string; text: string }[] {
  const out: { line: number; rule: string; text: string }[] = [];
  const original = sql.split("\n");
  bodiesBlanked(sql)
    .split("\n")
    .forEach((line, i) => {
      if (/--\s*reviewed:\s*destructive/i.test(original[i] ?? "")) return;
      const code = line.replace(/--.*$/, "");
      for (const [rule, re] of DESTRUCTIVE) if (re.test(code)) out.push({ line: i + 1, rule, text: (original[i] ?? "").trim() });
    });
  return out;
}
