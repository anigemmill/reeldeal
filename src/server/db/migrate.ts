import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Db } from "./types";

/*
  Applies supabase/migrations in order and records them. On a non-Supabase database
  (local Postgres, PGlite) it first applies supabase/local/*, which recreates the
  small part of Supabase the migrations use (roles, auth.users, auth.uid()).
  On a real Supabase project use the Supabase CLI (`supabase db push`) instead.
*/
const ROOT = join(process.cwd(), "supabase");

export async function migrate(db: Db, execFile: (sql: string) => Promise<void>, log: (msg: string) => void = () => {}) {
  const hasAuth = await db.system(async (sql) => (await sql.query<{ ok: boolean }>("select to_regclass('auth.users') is not null as ok"))[0].ok);
  if (!hasAuth) {
    for (const f of readdirSync(join(ROOT, "local")).filter((x) => x.endsWith(".sql")).sort()) {
      await execFile(readFileSync(join(ROOT, "local", f), "utf8"));
      log(`applied local/${f}`);
    }
  }
  await execFile("create schema if not exists reeldeal_meta; create table if not exists reeldeal_meta.migrations (name text primary key, applied_at timestamptz not null default now());");
  const done = new Set(await db.system(async (sql) => (await sql.query<{ name: string }>("select name from reeldeal_meta.migrations")).map((r) => r.name)));
  const pending = readdirSync(join(ROOT, "migrations")).filter((x) => x.endsWith(".sql") && !done.has(x)).sort();
  for (const f of pending) {
    const name = f.replace(/'/g, "");
    await execFile(`begin;\n${readFileSync(join(ROOT, "migrations", f), "utf8")}\ninsert into reeldeal_meta.migrations (name) values ('${name}');\ncommit;`);
    log(`applied migrations/${f}`);
  }
  return pending;
}
