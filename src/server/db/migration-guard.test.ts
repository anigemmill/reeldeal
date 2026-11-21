import { describe, expect, it } from "vitest";
import { createPgliteDb } from "./pglite";
import { migrate } from "./migrate";
import { guardMigrationTarget, loadTargetsConfig } from "./migration-guard";
import { identityComment, type TargetsConfig } from "./migration-target";

/*
  The migration target guard on a real (embedded) Postgres. Each case uses a fresh in-memory
  database. The URL only decides how the target is classified; nothing connects to it.
*/
const LOCAL_URL = "postgres://postgres@localhost:5432/reeldeal";
const ACCOUNTS_DEV = "postgresql://postgres:pw@db.egtlqrmujhxelczbyszj.supabase.co:5432/postgres";
const REEL_DEAL_PROD = "postgresql://postgres.jzshbaqfrrgsyiciuzfe:pw@aws-0-ap-southeast-2.pooler.supabase.com:6543/postgres";

async function fresh() {
  const db = await createPgliteDb();
  return { db, exec: (sql: string) => db.exec(sql) };
}
const metaSchemas = (db: Awaited<ReturnType<typeof createPgliteDb>>) =>
  db.system((sql) => sql.query<{ s: string }>("select nspname::text as s from pg_namespace where nspname like '%_meta' order by 1")).then((r) => r.map((x) => x.s));

describe("migration target guard (Reel Deal)", () => {
  it("is configured for Reel Deal, with its production project only", () => {
    expect(loadTargetsConfig()).toEqual({ product: "reel_deal", projects: { production: "jzshbaqfrrgsyiciuzfe" } });
  });

  it("records the marker on a fresh local database, migrates, and accepts it again", async () => {
    const { db, exec } = await fresh();
    try {
      const id = await guardMigrationTarget(db, LOCAL_URL, exec);
      expect(id).toEqual({ product: "reel_deal", environment: "local", project_ref: null });
      await migrate(db, exec);
      const [{ comment }] = await db.system((sql) => sql.query<{ comment: string }>("select obj_description('reeldeal_meta'::regnamespace, 'pg_namespace') as comment"));
      expect(comment).toBe(identityComment(id));
      await expect(guardMigrationTarget(db, LOCAL_URL, exec)).resolves.toEqual(id);
    } finally {
      await db.close();
    }
  });

  it("refuses the account service's accounts-dev project before touching the database", async () => {
    const { db, exec } = await fresh();
    try {
      await expect(guardMigrationTarget(db, ACCOUNTS_DEV, exec)).rejects.toThrow(/not one of reel_deal's projects/);
      expect(await metaSchemas(db)).toEqual([]);
    } finally {
      await db.close();
    }
  });

  it("refuses any database holding the account service's schema, and writes nothing", async () => {
    const { db, exec } = await fresh();
    try {
      await exec(
        `create schema accounts_meta; comment on schema accounts_meta is '${identityComment({ product: "account_service", environment: "development", project_ref: "egtlqrmujhxelczbyszj" })}'`,
      );
      await expect(guardMigrationTarget(db, LOCAL_URL, exec)).rejects.toThrow(/belongs to account_service/);
      expect(await metaSchemas(db)).toEqual(["accounts_meta"]); // no reeldeal_meta created
    } finally {
      await db.close();
    }
  });

  it("refuses a production-marked database reached as a local one", async () => {
    const { db, exec } = await fresh();
    try {
      await exec(`create schema reeldeal_meta; comment on schema reeldeal_meta is '${identityComment({ product: "reel_deal", environment: "production", project_ref: "jzshbaqfrrgsyiciuzfe" })}'`);
      await expect(guardMigrationTarget(db, LOCAL_URL, exec)).rejects.toThrow(/marked as reel_deal \/ production/);
    } finally {
      await db.close();
    }
  });

  it("marks an existing, unmarked Reel Deal database on first verified run (as production will be)", async () => {
    const { db, exec } = await fresh();
    try {
      await migrate(db, exec); // an existing database from before the guard: reeldeal_meta, no marker
      const id = await guardMigrationTarget(db, REEL_DEAL_PROD, exec);
      expect(id).toEqual({ product: "reel_deal", environment: "production", project_ref: "jzshbaqfrrgsyiciuzfe" });
      const [{ comment }] = await db.system((sql) => sql.query<{ comment: string }>("select obj_description('reeldeal_meta'::regnamespace, 'pg_namespace') as comment"));
      expect(comment).toBe(identityComment(id));
    } finally {
      await db.close();
    }
  });

  it("only checks, without recording, for --plan", async () => {
    const { db, exec } = await fresh();
    try {
      await guardMigrationTarget(db, LOCAL_URL, exec, { record: false });
      expect(await metaSchemas(db)).toEqual([]);
    } finally {
      await db.close();
    }
  });

  it("refuses when no project is configured for a hosted target", async () => {
    const { db, exec } = await fresh();
    const none: TargetsConfig = { product: "reel_deal", projects: {} };
    try {
      await expect(guardMigrationTarget(db, REEL_DEAL_PROD, exec, { config: none })).rejects.toThrow(/not one of reel_deal's projects/);
    } finally {
      await db.close();
    }
  });
});
