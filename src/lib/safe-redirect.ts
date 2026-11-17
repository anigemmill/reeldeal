/*
  Where to send someone after signing in, or after an emailed auth link. The value comes
  from the URL (?next=…), so it is untrusted: it must stay on this site.

  Rejected:
  - anything that is not a path starting with a single "/" ("//evil.com" is protocol-relative)
  - any backslash: browsers and the WHATWG URL parser treat "\" as "/" in http(s) URLs,
    so "/\evil.com" becomes "//evil.com" (the open redirect fixed here)
  - control characters and whitespace (tabs and newlines are stripped by URL parsers,
    so "/\t/evil.com" would also become "//evil.com")
  - anything that, once resolved, lands on another origin (belt and braces)
  - very long values
*/
const ORIGIN = "https://reeldeal.invalid";
const MAX_LENGTH = 2048;

export const DEFAULT_AFTER_SIGN_IN = "/dashboard";

export function safeNextPath(value: unknown, fallback: string = DEFAULT_AFTER_SIGN_IN): string {
  if (typeof value !== "string" || value.length === 0 || value.length > MAX_LENGTH) return fallback;
  if (!value.startsWith("/") || value.startsWith("//")) return fallback;
  if (value.includes("\\")) return fallback;
  if (/[\x00-\x20\x7f-\x9f]/.test(value)) return fallback; // control characters and spaces
  let resolved: URL;
  try {
    resolved = new URL(value, ORIGIN);
  } catch {
    return fallback;
  }
  if (resolved.origin !== ORIGIN) return fallback;
  return resolved.pathname + resolved.search + resolved.hash;
}
