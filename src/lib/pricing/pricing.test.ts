import { describe, expect, it } from "vitest";
import raw from "../../../config/pricing.json";
import { getPlan, getPlans, getRecommendedPlan, pricing } from "./index";
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
