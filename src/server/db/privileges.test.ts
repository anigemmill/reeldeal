import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Platform } from "../context";
import { seedDemoData, type DemoData } from "../seed";
import { createTestPlatform } from "../testing";

/*
  Privilege and RLS audit. The local shim reproduces Supabase's default grants
  (ALL on new tables to anon and authenticated), so these checks fail if a
  migration relies on those defaults. Also runs on PostgreSQL 16 and on the
  supabase/postgres image (npm run test:postgres, npm run test:supabase-local).
*/
let p: Platform;
let d: DemoData;
beforeAll(async () => {
  const t = await createTestPlatform({ seed: true, clips: 2 });
  p = t.p;
  d = t.demo;
}, 120_000);
afterAll(async () => p?.db.close());

const sys = <T>(q: string, params: unknown[] = []) => p.db.system((sql) => sql.query<T & Record<string, unknown>>(q, params));
const denied = async (userId: string, q: string, params: unknown[] = []) => {
  const err = await p.db.asUser(userId, (sql) => sql.query(q, params)).then(() => null, (e: Error) => e.message);
  return err ?? "ALLOWED";
};

describe("RLS and privileges", () => {
  it("has row level security enabled on every public table", async () => {
    const rows = await sys<{ relname: string }>(
      "select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity",
    );
    expect(rows.map((r) => r.relname)).toEqual([]);
  });

  it("gives anon no privilege on any public table", async () => {
    const rows = await sys<{ table_name: string; privilege_type: string }>(
      "select table_name, privilege_type from information_schema.role_table_grants where grantee = 'anon' and table_schema = 'public'",
    );
    expect(rows).toEqual([]);
    const cols = await sys("select table_name, column_name from information_schema.column_privileges where grantee = 'anon' and table_schema = 'public'");
    expect(cols).toEqual([]);
  });

  it("never grants TRUNCATE, TRIGGER or REFERENCES to signed-in users (TRUNCATE ignores RLS)", async () => {
    const rows = await sys<{ table_name: string; privilege_type: string }>(
      "select table_name, privilege_type from information_schema.role_table_grants where grantee = 'authenticated' and table_schema = 'public' and privilege_type in ('TRUNCATE', 'TRIGGER', 'REFERENCES')",
    );
    expect(rows).toEqual([]);
  });

  it("keeps server-owned tables and columns out of users' reach", async () => {
    const can = async (table: string, column: string, priv: string) =>
      (await sys<{ ok: boolean }>("select has_column_privilege('authenticated', $1, $2, $3) as ok", [`public.${table}`, column, priv]))[0].ok;
    const forbidden: [string, string, string][] = [
      ["organisations", "plan_id", "UPDATE"],
      ["organisations", "slug", "UPDATE"],
      ["api_tokens", "scopes", "UPDATE"],
      ["api_tokens", "org_id", "UPDATE"],
      ["api_tokens", "expires_at", "UPDATE"],
      ["api_tokens", "token_hash", "SELECT"],
      ["api_tokens", "token_hash", "INSERT"],
      ["memberships", "role", "UPDATE"],
      ["memberships", "role", "INSERT"],
      ["media_assets", "storage_key", "UPDATE"],
      ["media_assets", "status", "UPDATE"],
      ["media_assets", "status", "INSERT"],
      ["media_assets", "size_bytes", "UPDATE"],
      ["media_assets", "ai_tags", "UPDATE"],
      ["media_assets", "org_id", "UPDATE"],
      ["projects", "org_id", "UPDATE"],
    ];
    const allowed = [];
    for (const [t, c, priv] of forbidden) if (await can(t, c, priv)) allowed.push(`${priv} ${t}.${c}`);
    expect(allowed).toEqual([]);
    for (const t of ["jobs", "media_analysis", "exports", "credit_transactions"])
      for (const priv of ["INSERT", "UPDATE", "DELETE"]) {
        const [{ ok }] = await sys<{ ok: boolean }>("select has_table_privilege('authenticated', $1, $2) as ok", [`public.${t}`, priv]);
        expect(ok, `${priv} on ${t}`).toBe(false);
      }
  });

  it("refuses the escalations a user could try directly through the Data API", async () => {
    const { aroha, ben } = d.ids;
    expect(await denied(aroha, "update public.organisations set plan_id = 'agency' where id = $1", [d.ids.orgA])).toMatch(/permission denied/);
    expect(await denied(aroha, "update public.api_tokens set scopes = array['mcp:read','mcp:write','mcp:render'] where user_id = $1", [aroha])).toMatch(/permission denied/);
    expect(await denied(ben, "update public.media_assets set storage_key = $1 where org_id = $2", [`org/${d.ids.orgB}/media/x/original.mp4`, d.ids.orgA])).toMatch(/permission denied/);
    expect(await denied(ben, "update public.media_assets set status = 'ready' where org_id = $1", [d.ids.orgA])).toMatch(/permission denied/);
    expect(await denied(aroha, "insert into public.memberships (org_id, user_id, role) values ($1, $2, 'owner')", [d.ids.orgB, aroha])).toMatch(/permission denied/);
    expect(await denied(aroha, "insert into public.credit_transactions (org_id, wallet, kind, amount, period) values ($1, 'video', 'grant', 1000, '2026-11')", [d.ids.orgA])).toMatch(/permission denied/);
    expect(await denied(aroha, "truncate public.media_assets")).toMatch(/permission denied/);
    expect(await denied(aroha, "select token_hash from public.api_tokens")).toMatch(/permission denied/);
    // What the application legitimately does still works.
    expect(await denied(aroha, "select id, name, scopes from public.api_tokens")).toBe("ALLOWED");
    expect(await denied(ben, "update public.media_assets set title = title where org_id = $1", [d.ids.orgA])).toBe("ALLOWED");
  });

  it("cannot store a storage key outside the row's own organisation, even from server code", async () => {
    const [m] = await sys<{ id: string }>("select id from public.media_assets where org_id = $1 limit 1", [d.ids.orgA]);
    const err = await sys("update public.media_assets set storage_key = $1 where id = $2", [`org/${d.ids.orgB}/media/${m.id}/original.mp4`, m.id]).then(() => null, (e: Error) => e.message);
    expect(err).toMatch(/media_assets_storage_key_in_org/);
  });

  it("isolates organisations for every customer table, by RLS alone", async () => {
    const tables = ["organisations", "memberships", "brand_profiles", "media_assets", "projects", "project_media", "video_briefs", "video_concepts", "storyboards", "jobs", "media_analysis", "exports", "credit_transactions"];
    for (const t of tables) {
      const col = t === "organisations" ? "id" : "org_id";
      const rows = await p.db.asUser(d.ids.dev, (sql) => sql.query<{ n: number }>(`select count(*)::int as n from public.${t} where ${col} = $1`, [d.ids.orgA]));
      expect(rows[0].n, t).toBe(0);
    }
  });
});
