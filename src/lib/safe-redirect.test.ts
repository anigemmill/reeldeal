import { describe, expect, it } from "vitest";
import { safeNextPath } from "./safe-redirect";

describe("safeNextPath", () => {
  it.each([
    ["/dashboard", "/dashboard"],
    ["/onboarding", "/onboarding"],
    ["/reset-password", "/reset-password"],
    ["/studio?project=abc&v=2", "/studio?project=abc&v=2"],
    ["/library#clip-3", "/library#clip-3"],
    ["/brands/123e4567-e89b-12d3-a456-426614174000", "/brands/123e4567-e89b-12d3-a456-426614174000"],
  ])("keeps the in-app path %s", (input, out) => expect(safeNextPath(input)).toBe(out));

  it.each([
    "/\\evil.com", // the confirmed open redirect: "\" is read as "/"
    "/\\/evil.com",
    "\\\\evil.com",
    "//evil.com",
    "///evil.com",
    "https://evil.com",
    "http:evil.com",
    "javascript:alert(1)",
    "evil.com",
    "/\t/evil.com", // tab is stripped by URL parsers
    "/\n/evil.com",
    "/\r\n/evil.com",
    " /dashboard",
    "",
    "/" + "a".repeat(3000),
  ])("rejects %j", (input) => {
    const out = safeNextPath(input);
    expect(out).toBe("/dashboard");
    expect(new URL(out, "https://app.example").origin).toBe("https://app.example");
  });

  it.each(["/%2F%2Fevil.com", "/%5Cevil.com", "/%0a/evil.com"])("percent-encoded %s stays a path on this site", (input) => {
    const out = safeNextPath(input);
    expect(out).toBe(input);
    expect(new URL(out, "https://app.example").origin).toBe("https://app.example");
  });

  it("rejects non-strings and uses the fallback given", () => {
    expect(safeNextPath(null)).toBe("/dashboard");
    expect(safeNextPath(undefined, "/onboarding")).toBe("/onboarding");
    expect(safeNextPath(42)).toBe("/dashboard");
  });
});
