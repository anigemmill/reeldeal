/*
  Apply supabase/migrations to DATABASE_URL (local Postgres or CI). On a non-Supabase
  database it first applies supabase/local (roles, auth schema). For a real Supabase
  project use the Supabase CLI instead: supabase db push.
  Usage: DATABASE_URL=postgres://… npm run db:migrate
*/
import { serverEnv } from "../src/env/server";
import { migrate } from "../src/server/db/migrate";
import { createPostgresDb, execPostgresFile } from "../src/server/db/postgres";

async function main() {
  if (!serverEnv.DATABASE_URL) throw new Error("DATABASE_URL is not set");
  const url = serverEnv.DATABASE_URL;
  const db = createPostgresDb(url, { max: 1 });
  const applied = await migrate(db, (sql) => execPostgresFile(url, sql), (m) => console.log(`✓ ${m}`));
  console.log(applied.length ? `Applied ${applied.length} migration(s)` : "Database is up to date");
  await db.close();
}
main().catch((e) => {
  console.error(`✗ ${(e as Error).message}`);
  process.exit(1);
});
