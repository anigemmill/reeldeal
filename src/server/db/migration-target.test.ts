import { describe, expect, it } from "vitest";
import {
  checkIdentity,
  classifyDatabaseUrl,
  expectedIdentity,
  identityComment,
  type Identity,
  MigrationTargetError,
  parseIdentity,
  recordIdentitySql,
  type TargetsConfig,
} from "./migration-target";

/* SHARED: identical in outsideinprojects, commandcentre and reeldeal. */

const ACCOUNTS_DEV = "egtlqrmujhxelczbyszj";
const REEL_DEAL_PROD = "jzshbaqfrrgsyiciuzfe";
const accounts: TargetsConfig = { product: "account_service", projects: { development: ACCOUNTS_DEV } };
const reelDeal: TargetsConfig = { product: "reel_deal", projects: { production: REEL_DEAL_PROD } };
const commandCentre: TargetsConfig = { product: "command_centre", projects: {} };

const direct = (ref: string) => `postgresql://postgres:pw@db.${ref}.supabase.co:5432/postgres`;
const pooler = (ref: string) => `postgresql://postgres.${ref}:pw@aws-0-ap-southeast-2.pooler.supabase.com:6543/postgres`;

describe("classifyDatabaseUrl", () => {
  it("recognises databases on this machine", () => {
    for (const url of ["postgres://postgres@localhost:54331/accounts", "postgres://u@127.0.0.1/db", "postgres://u@[::1]:5432/db"]) {
      expect(classifyDatabaseUrl(url)).toEqual({ kind: "local" });
    }
  });

  it("reads the project id from a direct or pooler Supabase URL", () => {
    expect(classifyDatabaseUrl(direct(ACCOUNTS_DEV))).toEqual({ kind: "supabase", ref: ACCOUNTS_DEV });
    expect(classifyDatabaseUrl(pooler(REEL_DEAL_PROD))).toEqual({ kind: "supabase", ref: REEL_DEAL_PROD });
  });

  it("cannot verify anything else", () => {
    for (const url of [
      "postgres://u:p@db.example.com:5432/x", // another host
      "postgresql://postgres:pw@aws-0-ap-southeast-2.pooler.supabase.com:6543/postgres", // pooler without a project id
      "postgresql://postgres:pw@db.short.supabase.co:5432/postgres", // malformed project id
      "not a url",
    ]) {
      expect(classifyDatabaseUrl(url).kind).toBe("unverifiable");
    }
  });
});

describe("expectedIdentity", () => {
  it("accepts a product's own project, with its environment", () => {
    expect(expectedIdentity(classifyDatabaseUrl(direct(ACCOUNTS_DEV)), accounts)).toEqual({
      product: "account_service", environment: "development", project_ref: ACCOUNTS_DEV,
    });
    expect(expectedIdentity(classifyDatabaseUrl(pooler(REEL_DEAL_PROD)), reelDeal).environment).toBe("production");
  });

  it("refuses Reel Deal migrations on the account service's database", () => {
    expect(() => expectedIdentity(classifyDatabaseUrl(direct(ACCOUNTS_DEV)), reelDeal)).toThrow(/not one of reel_deal's projects/);
  });

  it("refuses account service migrations on Reel Deal's database", () => {
    expect(() => expectedIdentity(classifyDatabaseUrl(direct(REEL_DEAL_PROD)), accounts)).toThrow(/not one of account_service's projects/);
  });

  it("refuses every hosted project for a product with none configured", () => {
    expect(() => expectedIdentity(classifyDatabaseUrl(direct(ACCOUNTS_DEV)), commandCentre)).toThrow(MigrationTargetError);
  });

  it("refuses a target whose identity cannot be verified", () => {
    expect(() => expectedIdentity(classifyDatabaseUrl("postgres://u:p@db.example.com/x"), accounts)).toThrow(/cannot be verified/);
  });

  it("allows a local database as the local environment", () => {
    expect(expectedIdentity({ kind: "local" }, accounts)).toEqual({ product: "account_service", environment: "local", project_ref: null });
  });

  it("rejects a malformed config", () => {
    expect(() => expectedIdentity({ kind: "local" }, { product: "account_service", projects: { development: "nope" } })).toThrow(/not a Supabase project id/);
    expect(() => expectedIdentity({ kind: "local" }, { product: "account_service", projects: { development: ACCOUNTS_DEV, production: ACCOUNTS_DEV } })).toThrow(/two environments/);
    expect(() => expectedIdentity({ kind: "local" }, { product: "other" as never, projects: {} })).toThrow(/unknown product/);
  });
});

describe("checkIdentity", () => {
  const dev: Identity = { product: "account_service", environment: "development", project_ref: ACCOUNTS_DEV };

  it("records a marker on a database that has none", () => {
    expect(checkIdentity(dev, [])).toEqual({ record: true });
    expect(checkIdentity(dev, [{ schema: "accounts_meta", comment: null }])).toEqual({ record: true });
  });

  it("accepts a matching marker without recording again", () => {
    expect(checkIdentity(dev, [{ schema: "accounts_meta", comment: identityComment(dev) }])).toEqual({ record: false });
  });

  it("refuses a database holding another product's schema, with or without a marker", () => {
    expect(() => checkIdentity(dev, [{ schema: "reeldeal_meta", comment: null }])).toThrow(/belongs to reel_deal/);
    const rd: Identity = { product: "reel_deal", environment: "production", project_ref: REEL_DEAL_PROD };
    expect(() => checkIdentity(dev, [{ schema: "reeldeal_meta", comment: identityComment(rd) }])).toThrow(/belongs to reel_deal/);
  });

  it("refuses a marker for another environment or project", () => {
    const local: Identity = { ...dev, environment: "local", project_ref: null };
    expect(() => checkIdentity(dev, [{ schema: "accounts_meta", comment: identityComment(local) }])).toThrow(/marked as account_service \/ local/);
    expect(() => checkIdentity(dev, [{ schema: "accounts_meta", comment: identityComment({ ...dev, project_ref: REEL_DEAL_PROD }) }])).toThrow(/marked as/);
  });

  it("refuses a marker it cannot read", () => {
    expect(() => checkIdentity(dev, [{ schema: "accounts_meta", comment: "something else" }])).toThrow(/cannot be read/);
    expect(() => checkIdentity(dev, [{ schema: "accounts_meta", comment: "outside-in:database-identity {broken" }])).toThrow(/cannot be read/);
  });
});

describe("markers", () => {
  it("round-trip and produce safe SQL", () => {
    const i: Identity = { product: "reel_deal", environment: "production", project_ref: REEL_DEAL_PROD };
    expect(parseIdentity(identityComment(i))).toEqual(i);
    expect(recordIdentitySql(i)).toBe(`create schema if not exists reeldeal_meta; comment on schema reeldeal_meta is '${identityComment(i)}';`);
  });

  it("refuse to record an invalid identity", () => {
    expect(() => recordIdentitySql({ product: "reel_deal", environment: "production", project_ref: "x'; drop table y; --" })).toThrow(MigrationTargetError);
  });
});
