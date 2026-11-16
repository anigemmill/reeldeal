import { describe, expect, it } from "vitest";
import raw from "../../../config/pricing.json";
import { creditCost, getPlan, getPlans, getRecommendedPlan, parsePlanChoice, pricing, renderCredits, signupHref } from "./index";
import { pricingSchema } from "./schema";

// Deliberately untyped so tests can break the config in ways the types forbid.
const clone = () => JSON.parse(JSON.stringify(raw));
const messages = (data: unknown) => {
  const r = pricingSchema.safeParse(data);
  return r.success ? [] : r.error.issues.map((i) => i.message);
};

describe("pricing loader", () => {
  it("loads the real config", () => {
    expect(getPlans().map((p) => p.id)).toEqual(["free", "starter", "creator", "business", "agency", "enterprise"]);
    expect(getRecommendedPlan().id).toBe(pricing.recommendedPlan);
    expect(getPlan("creator")?.priceMonthly).toBe(119);
    expect(getPlan("nope")).toBeUndefined();
  });
});

describe("credit costs", () => {
  it("looks up credits by id", () => {
    expect(creditCost("video-60")).toBe(1);
    expect(creditCost("storyboard-preview")).toBe(0);
    expect(() => creditCost("nope")).toThrow();
  });
  it("charges the length band plus one per extra format", () => {
    expect(renderCredits({ seconds: 30, formats: 1 })).toBe(1);
    expect(renderCredits({ seconds: 30, formats: 3 })).toBe(3);
    expect(renderCredits({ seconds: 90, formats: 2 })).toBe(3);
  });
});

describe("pricing schema", () => {
  it("accepts the real config", () => {
    expect(messages(raw)).toEqual([]);
  });

  it("rejects unknown keys (typos)", () => {
    const c = clone();
    c.plans[0].storgeGB = 5;
    expect(messages(c).join()).toMatch(/storgeGB/);
  });

  it("rejects a recommendedPlan that is not a plan", () => {
    const c = clone();
    c.recommendedPlan = "pro";
    expect(messages(c).join()).toMatch(/not a plan id/);
  });

  it("rejects duplicate plan ids", () => {
    const c = clone();
    c.plans[1].id = "free";
    expect(messages(c).join()).toMatch(/Duplicate plan id/);
  });

  it("rejects an annual price that does not match the months-free discount", () => {
    const c = clone();
    c.plans[1].priceAnnual = 500;
    expect(messages(c).join()).toMatch(/expected 490/);
  });

  it("rejects a monthly price without an annual price", () => {
    const c = clone();
    c.plans[1].priceAnnual = null;
    expect(messages(c).join()).toMatch(/both be set or both be null/);
  });

  it("requires limits on priced plans but not on Enterprise", () => {
    const c = clone();
    delete c.plans[1].users;
    expect(messages(c).join()).toMatch(/users is required/);
    expect(raw.plans.find((p) => p.id === "enterprise")).not.toHaveProperty("users");
  });

  it("rejects comparison columns and rows that do not line up", () => {
    const c = clone();
    c.comparison.columns[0] = "pro";
    c.comparison.rows[0].pop();
    const m = messages(c).join();
    expect(m).toMatch(/"pro" is not a plan id/);
    expect(m).toMatch(/expected 6/);
  });

  it("requires a label on zero-credit activities", () => {
    const c = clone();
    delete c.creditCosts.find((x: { credits: number }) => x.credits === 0).label;
    expect(messages(c).join()).toMatch(/needs a label/);
  });

  it("rejects wrong types", () => {
    const c = clone();
    c.plans[0].priceMonthly = "49";
    c.gstIncluded = "yes";
    expect(messages(c).length).toBeGreaterThanOrEqual(2);
  });
});

describe("plan choice from the pricing page", () => {
  const paid = getPlans().find((p) => p.priceMonthly !== null && p.priceMonthly > 0)!;

  it("builds sign-up links that carry the plan and billing period", () => {
    expect(signupHref()).toBe("/signup");
    expect(signupHref("free", "annual")).toBe("/signup");
    expect(signupHref(paid.id)).toBe(`/signup?plan=${paid.id}`);
    expect(signupHref(paid.id, "annual")).toBe(`/signup?plan=${paid.id}&billing=annual`);
  });

  it("accepts only paid self-serve plans and defaults to monthly", () => {
    expect(parsePlanChoice(paid.id, undefined)).toEqual({ plan: paid, billing: "monthly" });
    expect(parsePlanChoice(paid.id, "annual")?.billing).toBe("annual");
    expect(parsePlanChoice(paid.id, "weekly")?.billing).toBe("monthly");
    expect(parsePlanChoice("free", "monthly")).toBeNull();
    expect(parsePlanChoice("enterprise", "monthly")).toBeNull();
    expect(parsePlanChoice("no-such-plan", "monthly")).toBeNull();
    expect(parsePlanChoice(["creator"], "monthly")).toBeNull();
    expect(parsePlanChoice(undefined, undefined)).toBeNull();
  });
});
