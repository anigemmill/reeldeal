import { describe, expect, it } from "vitest";
import { cn } from "./utils";

describe("cn", () => {
  it("dedupes custom theme utilities", () => {
    expect(cn("shadow-card", "shadow-float")).toBe("shadow-float");
    expect(cn("rounded-md", "rounded-pill")).toBe("rounded-pill");
    expect(cn("font-sans", "font-display")).toBe("font-display");
    expect(cn("tracking-label", "tracking-display")).toBe("tracking-display");
  });

  it("keeps colour and size utilities apart", () => {
    expect(cn("text-xs", "text-ink-muted")).toBe("text-xs text-ink-muted");
    expect(cn("bg-electric", "bg-primary")).toBe("bg-primary");
    expect(cn("shadow-card", "shadow-electric")).toBe("shadow-card shadow-electric");
  });
});
