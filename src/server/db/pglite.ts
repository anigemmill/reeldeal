import type { PGlite, Transaction } from "@electric-sql/pglite";
import { claimsFor, type Db, type Sql } from "./types";

/*
  Embedded Postgres (PGlite, WASM). Used by automated tests (in memory) and by the
  local STDIO server when no DATABASE_URL is set (a directory under .data/).
  Same SQL, same migrations, same Row Level Security as Postgres.
*/
export async function createPgliteDb(dataDir?: string): Promise<Db & { exec(text: string): Promise<void> }> {
  const { PGlite } = await import("@electric-sql/pglite");
  const pg: PGlite = dataDir ? await PGlite.create(dataDir) : await PGlite.create();
  const wrap = (tx: Transaction | PGlite): Sql => ({
    query: async <T>(text: string, params: readonly unknown[] = []) => (await tx.query<T>(text, params as unknown[])).rows,
  });
  return {
    driver: "pglite",
    asUser: (userId, fn) =>
      pg.transaction(async (tx) => {
        await tx.exec("set local role authenticated");
        await tx.query("select set_config('request.jwt.claims', $1, true)", [claimsFor(userId)]);
        return fn(wrap(tx));
      }),
    system: (fn) => pg.transaction((tx) => fn(wrap(tx))),
    ping: async () => {
      try {
        await pg.query("select 1");
        return true;
      } catch {
        return false;
      }
    },
    close: () => pg.close(),
    exec: async (text) => {
      await pg.exec(text);
    },
  };
}
