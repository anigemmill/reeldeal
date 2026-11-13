export type Row = Record<string, unknown>;

/** Minimal SQL surface shared by every driver. Parameters use $1, $2, … */
export interface Sql {
  query<T = Row>(text: string, params?: readonly unknown[]): Promise<T[]>;
}

export interface Db {
  readonly driver: "postgres" | "pglite";
  /**
   * User context: one transaction as the `authenticated` role with the user's JWT
   * claims, exactly like a Supabase request. Row Level Security applies.
   * Every customer-facing read and write goes through here.
   */
  asUser<T>(userId: string, fn: (sql: Sql) => Promise<T>): Promise<T>;
  /**
   * Trusted server context (table owner; RLS does not apply). Only for work no user
   * performs directly: access-token lookup, job workers, the credit ledger and
   * seeding. Callers must have authorised the request in user context first.
   */
  system<T>(fn: (sql: Sql) => Promise<T>): Promise<T>;
  ping(): Promise<boolean>;
  close(): Promise<void>;
}

export const claimsFor = (userId: string) => JSON.stringify({ sub: userId, role: "authenticated" });
