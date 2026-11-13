import { describe, expect, it } from "vitest";
import { createTestDb } from "./test-harness";

describe("migrations", () => {
  it("apply cleanly and enable RLS on every public table", async () => {
    const db = await createTestDb();
    const rows = await db.system((sql) =>
      sql.query<{ relname: string; relrowsecurity: boolean }>(
        "select c.relname, c.relrowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'r'",
      ),
    );
    expect(rows.length).toBeGreaterThanOrEqual(14);
    expect(rows.filter((r) => !r.relrowsecurity).map((r) => r.relname)).toEqual([]);
    await db.close();
  }, 30000);
});
