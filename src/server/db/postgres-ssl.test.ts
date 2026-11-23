import { describe, expect, it } from "vitest";
import { sslFor } from "./postgres";

/* Remote databases are always encrypted; the local stack is not; an explicit sslmode wins. */
describe("sslFor", () => {
  it("Supabase pooler: required", () => {
    expect(sslFor("postgresql://reeldeal_web.ref:pw@aws-0-ap-southeast-2.pooler.supabase.com:6543/postgres")).toBe("require");
  });
  it.each(["postgres://u:p@127.0.0.1:54322/postgres", "postgres://u:p@localhost/postgres", "postgres://u:p@[::1]:5432/postgres"])("local %s: off", (url) => {
    expect(sslFor(url)).toBe(false);
  });
  it("an explicit sslmode is left to the URL", () => {
    expect(sslFor("postgres://u:p@db.example.com/postgres?sslmode=verify-full")).toBeUndefined();
  });
});
