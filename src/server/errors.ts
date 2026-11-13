/*
  Errors every service throws. Transports (MCP, API routes) map them to responses.
  Messages are written for the end user and never contain secrets, SQL or stack traces.
*/
export type ErrorCode =
  | "unauthenticated"
  | "forbidden"
  | "not_found"
  | "invalid_input"
  | "conflict"
  | "insufficient_credits"
  | "confirmation_required"
  | "capability_unavailable"
  | "provider_error"
  | "rate_limited"
  | "internal";

export class AppError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "AppError";
  }
}

/** Same message whether the row does not exist or belongs to another organisation (no existence leaks). */
export const notFound = (what: string) => new AppError("not_found", `${what} not found, or you do not have access to it`);
export const invalid = (message: string, details?: Record<string, unknown>) => new AppError("invalid_input", message, details);
export const forbidden = (message: string) => new AppError("forbidden", message);
export const unavailable = (message: string, details?: Record<string, unknown>) => new AppError("capability_unavailable", message, details);

/** Postgres error codes that mean "the client sent something invalid", not a server fault. */
export function fromDbError(e: unknown): AppError | null {
  const code = (e as { code?: string })?.code;
  if (code === "23505") return new AppError("conflict", "That already exists");
  if (code === "23503") return invalid("A referenced item does not exist in this workspace");
  if (code === "23514" || code === "22P02" || code === "22023") return invalid("A value is not valid");
  if (code === "42501") return forbidden("You do not have permission to do that in this workspace");
  return null;
}

/** Validate input; failures become invalid_input with field-level details (no stack traces). */
export function parseInput<S extends { safeParse(v: unknown): { success: true; data: unknown } | { success: false; error: { issues: { path: PropertyKey[]; message: string }[] } } }>(
  schema: S,
  value: unknown,
): S extends { safeParse(v: unknown): infer R } ? (R extends { success: true; data: infer D } ? D : never) : never {
  const r = schema.safeParse(value);
  if (!r.success) {
    const issues = r.error.issues.map((i) => ({ field: i.path.map(String).join(".") || "(input)", message: i.message }));
    throw invalid(`Invalid input: ${issues.map((i) => `${i.field}: ${i.message}`).join("; ")}`, { issues });
  }
  return r.data as never;
}

export function toAppError(e: unknown): AppError {
  if (e instanceof AppError) return e;
  if ((e as { name?: string })?.name === "ZodError") return invalid("Invalid input");
  return fromDbError(e) ?? new AppError("internal", "Something went wrong on our side. Please try again.");
}
