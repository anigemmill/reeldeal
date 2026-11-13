import postgres from "postgres";
import { claimsFor, type Db, type Sql } from "./types";

/*
  Postgres driver (Supabase in production via its pooler, or a local server).
  prepare: false keeps it compatible with transaction-mode connection pooling.
*/
export function createPostgresDb(url: string, options: { max?: number } = {}): Db {
  const pg = postgres(url, { prepare: false, max: options.max ?? 5, idle_timeout: 20, onnotice: () => {} });
  const wrap = (tx: postgres.TransactionSql): Sql => ({
    query: async <T>(text: string, params: readonly unknown[] = []) =>
      (await tx.unsafe(text, params as postgres.ParameterOrJSON<never>[])) as unknown as T[],
  });
  return {
    driver: "postgres",
    asUser: (userId, fn) =>
      pg.begin(async (tx) => {
        await tx.unsafe("set local role authenticated");
        await tx.unsafe("select set_config('request.jwt.claims', $1, true)", [claimsFor(userId)]);
        return fn(wrap(tx));
      }) as Promise<never>,
    system: (fn) => pg.begin((tx) => fn(wrap(tx))) as Promise<never>,
    ping: async () => {
      try {
        await pg`select 1`;
        return true;
      } catch {
        return false;
      }
    },
    close: () => pg.end({ timeout: 5 }),
  };
}

/** Run a whole SQL file (multiple statements) outside a transaction wrapper. */
export async function execPostgresFile(url: string, text: string) {
  const pg = postgres(url, { prepare: false, max: 1, onnotice: () => {} });
  try {
    await pg.unsafe(text);
  } finally {
    await pg.end({ timeout: 5 });
  }
}
