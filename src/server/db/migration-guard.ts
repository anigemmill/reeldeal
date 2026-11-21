import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  checkIdentity,
  classifyDatabaseUrl,
  expectedIdentity,
  type Identity,
  MigrationTargetError,
  type MetaSchemaState,
  READ_MARKERS_SQL,
  recordIdentitySql,
  type TargetsConfig,
} from "./migration-target";
import type { Db } from "./types";

/*
  Reel Deal's adapter for the shared migration target guard (migration-target.ts). Used by the
  command-line runners that can reach a remote database (scripts/db-migrate.ts and, with
  DATABASE_URL, scripts/dev-setup.ts). The embedded PGlite database and the test harness are local
  by construction and do not need it.
*/

export function loadTargetsConfig(path = join(process.cwd(), "config", "database-targets.json")): TargetsConfig {
  try {
    const raw = JSON.parse(readFileSync(path, "utf8")) as { product: TargetsConfig["product"]; projects?: TargetsConfig["projects"] };
    return { product: raw.product, projects: raw.projects ?? {} };
  } catch (e) {
    throw new MigrationTargetError(`Refusing to migrate: ${path} cannot be read (${(e as Error).message}).`);
  }
}

/**
 * Verifies that `databaseUrl` is one of Reel Deal's databases and records the identity marker when
 * it is missing (through `execFile`, the same path migrations use). Throws MigrationTargetError and
 * writes nothing on any doubt. With `record: false` it only checks (for --plan).
 */
export async function guardMigrationTarget(
  db: Db,
  databaseUrl: string,
  execFile: (sql: string) => Promise<void>,
  opts: { record?: boolean; config?: TargetsConfig } = {},
): Promise<Identity> {
  const expected = expectedIdentity(classifyDatabaseUrl(databaseUrl), opts.config ?? loadTargetsConfig());
  let found: MetaSchemaState[];
  try {
    found = await db.system((sql) => sql.query<MetaSchemaState>(READ_MARKERS_SQL));
  } catch (e) {
    throw new MigrationTargetError(`Refusing to migrate: the database's identity cannot be read (${(e as Error).message}).`);
  }
  const { record } = checkIdentity(expected, found);
  if (record && opts.record !== false) await execFile(recordIdentitySql(expected));
  return expected;
}
