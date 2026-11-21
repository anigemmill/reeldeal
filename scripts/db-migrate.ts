/*
  Apply supabase/migrations to DATABASE_URL.
    npm run db:migrate                     local databases: applies pending migrations
    npm run db:migrate -- --plan           any database: list pending migrations, change nothing
    npm run db:migrate -- --apply          remote databases (e.g. a Supabase project): required to apply
  Remote targets are never changed without --apply, are never given the local
  compatibility files, and must pass the additive-only check first. The target is
  printed without its password. Use this OR the Supabase CLI for a project, not both
  (they record applied migrations in different tables).
*/
import { execFileSync } from "node:child_process";
import { serverEnv } from "../src/env/server";
import { migrate, pendingMigrations } from "../src/server/db/migrate";
import { guardMigrationTarget } from "../src/server/db/migration-guard";
import { createPostgresDb, execPostgresFile } from "../src/server/db/postgres";

async function main() {
  if (!serverEnv.DATABASE_URL) throw new Error("DATABASE_URL is not set");
  const url = serverEnv.DATABASE_URL;
  const u = new URL(url);
  const local = ["localhost", "127.0.0.1", "::1"].includes(u.hostname);
  console.log(`Target: ${u.hostname}:${u.port || 5432}${u.pathname} as ${decodeURIComponent(u.username)} (${local ? "local" : "remote"})`);
  const db = createPostgresDb(url, { max: 1 });
  const exec = (sql: string) => execPostgresFile(url, sql);
  try {
    // Refuses another product's database (e.g. the account service's) before reading or writing anything else.
    const target = await guardMigrationTarget(db, url, exec, { record: false });
    console.log(`Verified: ${target.product} / ${target.environment}${target.project_ref ? ` / ${target.project_ref}` : ""}`);
    const pending = await pendingMigrations(db);
    console.log(pending.length ? `Pending:\n${pending.map((p) => `  ${p}`).join("\n")}` : "Database is up to date");
    if (!pending.length || process.argv.includes("--plan")) return;
    if (!local && !process.argv.includes("--apply")) {
      console.log("Remote database: nothing applied. Re-run with --apply to apply the migrations above.");
      return;
    }
    execFileSync(process.execPath, ["--import", "tsx", "scripts/check-migrations.ts"], { stdio: "inherit" });
    await guardMigrationTarget(db, url, exec); // records the identity marker if it is missing
    const applied = await migrate(db, exec, (m) => console.log(`✓ ${m}`), { allowLocalShim: local });
    console.log(`Applied ${applied.length} migration(s)`);
  } finally {
    await db.close();
  }
}
main().catch((e) => {
  console.error(`✗ ${(e as Error).message}`);
  process.exit(1);
});
