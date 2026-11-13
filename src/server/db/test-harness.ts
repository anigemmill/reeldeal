import { randomBytes } from "node:crypto";
import postgres from "postgres";
import { serverEnv } from "@/env/server";
import { createPgliteDb } from "./pglite";
import { migrate } from "./migrate";
import { createPostgresDb, execPostgresFile } from "./postgres";
import type { Db } from "./types";

/*
  Test database with all migrations applied.
  Default: in-memory embedded Postgres (PGlite).
  With TEST_DATABASE_URL: a fresh database on that real Postgres server, dropped on close.
    TEST_DATABASE_URL=$(scripts/db-local.sh start) npm test
*/
export async function createTestDb(): Promise<Db> {
  const admin = serverEnv.TEST_DATABASE_URL;
  if (!admin) {
    const db = await createPgliteDb();
    await migrate(db, (sql) => db.exec(sql));
    return db;
  }
  const name = `rd_test_${randomBytes(6).toString("hex")}`;
  const root = postgres(admin, { max: 1, onnotice: () => {} });
  await root.unsafe(`create database ${name}`);
  const url = new URL(admin);
  url.pathname = `/${name}`;
  const db = createPostgresDb(url.toString(), { max: 4 });
  await migrate(db, (sql) => execPostgresFile(url.toString(), sql));
  return {
    ...db,
    close: async () => {
      await db.close();
      await root.unsafe(`drop database if exists ${name} with (force)`);
      await root.end();
    },
  };
}
