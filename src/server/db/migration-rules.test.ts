import { describe, expect, it } from "vitest";
import { destructiveStatements } from "./migration-rules";

describe("migration safety rules", () => {
  it("flags destructive statements that run when the migration is applied", () => {
    const found = destructiveStatements(
      ["drop table public.a;", "delete from public.b;", "update public.c set x = 1;", "truncate public.d;", "alter table public.e disable row level security;"].join("\n"),
    ).map((p) => p.rule);
    expect(found).toEqual(["DROP", "DELETE", "UPDATE of rows", "TRUNCATE", "RLS disabled"]);
  });

  it("still flags statements inside DO blocks (they run during the migration)", () => {
    const found = destructiveStatements("do $$ begin\n  delete from public.b;\nend $$;");
    expect(found).toEqual([{ line: 2, rule: "DELETE", text: "delete from public.b;" }]);
  });

  it("ignores statements inside function bodies (they run only when called), keeping line numbers", () => {
    const sql = [
      "create or replace function private.f() returns void language plpgsql as $$",
      "begin",
      "  delete from public.memberships where false;",
      "  update public.memberships set role = 'admin' where false;",
      "end $$;",
      "update public.x set y = 1;",
    ].join("\n");
    expect(destructiveStatements(sql)).toEqual([{ line: 6, rule: "UPDATE of rows", text: "update public.x set y = 1;" }]);
  });

  it("handles tagged dollar quotes and several functions", () => {
    const sql = "create function a() returns int language sql as $body$ delete from public.t $body$;\ncreate function b() returns int language sql as $$ select 1 $$;\ndrop index public.i;";
    expect(destructiveStatements(sql).map((p) => p.line)).toEqual([3]);
  });

  it("honours a reviewed marker", () => {
    expect(destructiveStatements("drop policy x on public.t; -- reviewed: destructive")).toEqual([]);
  });
});
