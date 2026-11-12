import raw from "../../../config/pricing.json";
import { formatPricingIssues, pricingSchema, type Plan, type PricingConfig } from "./schema";

export type { Plan, PricingConfig, Wallet } from "./schema";

/*
  Typed access to config/pricing.json. Pricing is never hard-coded elsewhere.
  The build validates the file first (npm run validate:pricing, run by prebuild);
  parsing again here guards any path that skips that step.
*/
function load(): PricingConfig {
  const result = pricingSchema.safeParse(raw);
  if (!result.success) {
    throw new Error(`config/pricing.json is invalid:\n${formatPricingIssues(result.error)}`);
  }
  return result.data;
}

export const pricing: PricingConfig = load();

export function getPlans(): readonly Plan[] {
  return pricing.plans;
}

export function getPlan(id: string): Plan | undefined {
  return pricing.plans.find((p) => p.id === id);
}

export function getRecommendedPlan(): Plan {
  // Existence is guaranteed by the schema's cross-field checks.
  return getPlan(pricing.recommendedPlan)!;
}
