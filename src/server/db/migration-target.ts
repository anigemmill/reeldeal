/*
  Migration target guard. SHARED: the same file lives in anigemmill/outsideinprojects,
  anigemmill/commandcentre and anigemmill/reeldeal (src/server/db/migration-target.ts). Change all
  three together.

  Stops one product's migrations from being applied to another product's database (on 17 Nov 2026
  Reel Deal's migrations were applied to the account service's accounts-dev by mistake).

  Before a migration runner writes anything it must:
    1. Classify the target from its connection URL: a database on this machine, a Supabase project
       (the project id is read from the host or the pooler user name), or something it cannot verify.
    2. Resolve the environment from config/database-targets.json, which names this product's Supabase
       project id for each environment. A Supabase project not listed there is refused.
    3. Read every product's identity marker in the database. A marker of another product, or another
       product's meta schema, means the database belongs to someone else: refused. This product's own
       marker must match the product, environment and project id exactly.
    4. If the database has no marker for this product yet, record one, then migrate.
  Anything that cannot be verified is refused. There is deliberately no override switch.

  The marker is a comment on the product's own meta schema (e.g. accounts_meta), so it adds no table
  and no Data API surface:  outside-in:database-identity {"product":…,"environment":…,"project_ref":…}
*/

export const META_SCHEMAS = {
  account_service: "accounts_meta",
  command_centre: "cc_meta",
  reel_deal: "reeldeal_meta",
} as const;

export type Product = keyof typeof META_SCHEMAS;
export type HostedEnvironment = "development" | "staging" | "production";
export type Environment = "local" | HostedEnvironment;

export interface TargetsConfig {
  product: Product;
  /** Supabase project id (ref) per environment. Leave an environment out until its project exists. */
  projects: Partial<Record<HostedEnvironment, string>>;
}

export type Target = { kind: "local" } | { kind: "supabase"; ref: string } | { kind: "unverifiable"; reason: string };

export interface Identity {
  product: Product;
  environment: Environment;
  project_ref: string | null;
}

export const IDENTITY_PREFIX = "outside-in:database-identity ";

export class MigrationTargetError extends Error {
  override name = "MigrationTargetError";
}

const LOCAL_HOSTS = new Set(["", "localhost", "127.0.0.1", "::1", "[::1]"]);
const REF = /^[a-z0-9]{20}$/;
const ENVIRONMENTS: readonly Environment[] = ["local", "development", "staging", "production"];

/** Where a connection URL points. Never throws; an unparseable URL is unverifiable. */
export function classifyDatabaseUrl(databaseUrl: string): Target {
  let u: URL;
  try {
    u = new URL(databaseUrl);
  } catch {
    return { kind: "unverifiable", reason: "the database URL cannot be parsed" };
  }
  const host = u.hostname.toLowerCase();
  if (LOCAL_HOSTS.has(host)) return { kind: "local" };
  const direct = host.match(/^db\.([a-z0-9]+)\.supabase\.co$/);
  if (direct) return REF.test(direct[1]) ? { kind: "supabase", ref: direct[1] } : { kind: "unverifiable", reason: `"${host}" does not contain a valid Supabase project id` };
  if (/\.pooler\.supabase\.com$/.test(host)) {
    const user = decodeURIComponent(u.username);
    const ref = user.includes(".") ? user.slice(user.lastIndexOf(".") + 1) : "";
    return REF.test(ref) ? { kind: "supabase", ref } : { kind: "unverifiable", reason: "the Supabase pooler user name does not contain a project id (expected postgres.<project id>)" };
  }
  return { kind: "unverifiable", reason: `"${host}" is neither a local database nor a Supabase project` };
}

/** The identity this runner would give the target, or a refusal. */
export function expectedIdentity(target: Target, config: TargetsConfig): Identity {
  validateConfig(config);
  if (target.kind === "local") return { product: config.product, environment: "local", project_ref: null };
  if (target.kind === "unverifiable") throw new MigrationTargetError(`Refusing to migrate: ${target.reason}. The target's identity cannot be verified.`);
  const matches = (Object.entries(config.projects) as [HostedEnvironment, string][]).filter(([, ref]) => ref === target.ref);
  if (matches.length !== 1) {
    throw new MigrationTargetError(
      `Refusing to migrate: Supabase project ${target.ref} is not one of ${config.product}'s projects in config/database-targets.json.`,
    );
  }
  return { product: config.product, environment: matches[0][0], project_ref: target.ref };
}

export interface MetaSchemaState {
  schema: string;
  comment: string | null;
}

/**
 * Checks the markers found in the database against the expected identity.
 * Returns whether this product's marker still has to be recorded. Throws on any mismatch.
 */
export function checkIdentity(expected: Identity, found: MetaSchemaState[]): { record: boolean } {
  const own = META_SCHEMAS[expected.product];
  let record = true;
  for (const { schema, comment } of found) {
    const owner = (Object.entries(META_SCHEMAS) as [Product, string][]).find(([, s]) => s === schema)?.[0];
    if (!owner) continue;
    if (owner !== expected.product) {
      throw new MigrationTargetError(
        `Refusing to migrate: this database belongs to ${owner} (it has the ${schema} schema), not ${expected.product}.`,
      );
    }
    if (schema !== own || comment === null || comment === "") continue;
    const marker = parseIdentity(comment);
    if (!marker) throw new MigrationTargetError(`Refusing to migrate: the identity marker on ${schema} cannot be read.`);
    for (const key of ["product", "environment", "project_ref"] as const) {
      if (marker[key] !== expected[key]) {
        throw new MigrationTargetError(
          `Refusing to migrate: this database is marked as ${describe(marker)}, but the target is ${describe(expected)}.`,
        );
      }
    }
    record = false;
  }
  return { record };
}

export function identityComment(identity: Identity): string {
  return IDENTITY_PREFIX + JSON.stringify({ product: identity.product, environment: identity.environment, project_ref: identity.project_ref });
}

export function parseIdentity(comment: string): Identity | null {
  if (!comment.startsWith(IDENTITY_PREFIX)) return null;
  try {
    const v = JSON.parse(comment.slice(IDENTITY_PREFIX.length)) as Record<string, unknown>;
    const ok =
      typeof v.product === "string" && v.product in META_SCHEMAS &&
      typeof v.environment === "string" && (ENVIRONMENTS as readonly string[]).includes(v.environment) &&
      (v.project_ref === null || (typeof v.project_ref === "string" && REF.test(v.project_ref)));
    return ok ? (v as unknown as Identity) : null;
  } catch {
    return null;
  }
}

/** SQL that records the marker. Every value is validated, so the literal cannot be broken out of. */
export function recordIdentitySql(identity: Identity): string {
  const schema = META_SCHEMAS[identity.product];
  if (!parseIdentity(identityComment(identity))) throw new MigrationTargetError("Refusing to record an invalid identity marker.");
  const literal = identityComment(identity).replaceAll("'", "''");
  return `create schema if not exists ${schema}; comment on schema ${schema} is '${literal}';`;
}

/** The query that reads every product's meta schema and its marker. */
export const READ_MARKERS_SQL = `select nspname::text as schema, obj_description(oid, 'pg_namespace') as comment
  from pg_namespace where nspname in (${Object.values(META_SCHEMAS).map((s) => `'${s}'`).join(", ")})`;

function describe(i: Identity) {
  return `${i.product} / ${i.environment}${i.project_ref ? ` / ${i.project_ref}` : ""}`;
}

function validateConfig(config: TargetsConfig) {
  if (!(config.product in META_SCHEMAS)) throw new MigrationTargetError(`config/database-targets.json: unknown product "${config.product}".`);
  const refs = Object.values(config.projects);
  for (const ref of refs) if (!REF.test(ref ?? "")) throw new MigrationTargetError(`config/database-targets.json: "${ref}" is not a Supabase project id.`);
  if (new Set(refs).size !== refs.length) throw new MigrationTargetError("config/database-targets.json: the same project is listed for two environments.");
}
