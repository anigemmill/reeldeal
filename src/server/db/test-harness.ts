import { createPgliteDb } from "./pglite";
import { migrate } from "./migrate";

/** In-memory embedded Postgres with all migrations applied (tests only). */
export async function createTestDb() {
  const db = await createPgliteDb();
  await migrate(db, (sql) => db.exec(sql));
  return db;
}
