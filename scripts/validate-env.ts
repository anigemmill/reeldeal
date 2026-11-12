/*
  Dedicated build step (runs in prebuild): validates environment variables
  against src/env/schema.ts before Next.js compiles anything.
*/
import { formatEnvIssues, publicSchema, serverSchema } from "../src/env/schema";

const pick = (keys: string[]) => Object.fromEntries(keys.map((k) => [k, process.env[k] || undefined]));
const pub = publicSchema.safeParse(pick(["NEXT_PUBLIC_SITE_URL", "NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY"]));
const srv = serverSchema.safeParse(pick(Object.keys(serverSchema.shape)));

const problems = [pub, srv].flatMap((r) => (r.success ? [] : [formatEnvIssues(r.error)]));
if (problems.length) {
  console.error(`✗ Environment is invalid:\n${problems.join("\n")}`);
  process.exit(1);
}
const configured = [
  pub.data?.NEXT_PUBLIC_SUPABASE_URL ? "Supabase" : null,
  srv.data?.R2_BUCKET ? "R2" : null,
].filter(Boolean);
console.log(`✓ Environment valid${configured.length ? ` (${configured.join(", ")} configured)` : " (no integrations configured yet)"}`);
