/*
  Secret hygiene (npm run check:secrets, part of npm run check).
  1. No credentials committed: scans git-tracked files for common key formats.
  2. Environment access is central: process.env is read only in src/env/*,
     next.config.ts and scripts/, so secrets cannot leak through ad-hoc reads.
*/
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";

const files = execSync("git ls-files -co --exclude-standard", { encoding: "utf8" })
  .split("\n")
  .filter((f) => f && !/\.(png|jpe?g|gif|webp|ico|woff2?|lock)$|package-lock\.json$/.test(f));

const SECRET_PATTERNS: [string, RegExp][] = [
  ["Private key", /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
  ["AWS / R2 access key id", /\bAKIA[0-9A-Z]{16}\b/],
  ["JWT (e.g. Supabase service role key)", /\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/],
  ["Stripe live key", /\b(?:sk|rk)_live_[0-9a-zA-Z]{16,}/],
  ["GitHub token", /\bgh[pousr]_[A-Za-z0-9]{30,}\b/],
  ["Generic secret assignment", /(?:SECRET|PASSWORD|SERVICE_ROLE_KEY|ACCESS_KEY)[A-Z_]*\s*[=:]\s*["']?[A-Za-z0-9/+_-]{20,}/],
];
// Tests may pass the environment to child processes they spawn.
const ENV_ALLOWED = /^(src\/env\/|scripts\/|next\.config\.ts$)|\.test\.ts$/;

const problems: string[] = [];
for (const file of files) {
  let text: string;
  try {
    text = readFileSync(file, "utf8");
  } catch {
    continue;
  }
  text.split("\n").forEach((line, i) => {
    for (const [name, re] of SECRET_PATTERNS) if (re.test(line)) problems.push(`${file}:${i + 1}  possible ${name}`);
    if (/^src\//.test(file) && !ENV_ALLOWED.test(file) && /process\.env\b/.test(line) && !/^\s*(\/\/|\*)/.test(line)) {
      problems.push(`${file}:${i + 1}  reads process.env directly; use src/env/public.ts or src/env/server.ts`);
    }
  });
}

if (problems.length) {
  console.error(`✗ ${problems.length} secret-hygiene problem(s):\n${problems.map((p) => `  ${p}`).join("\n")}`);
  process.exit(1);
}
console.log(`✓ No committed secrets; environment access is central (${files.length} files scanned)`);
