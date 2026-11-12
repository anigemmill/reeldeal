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

/** Credits for an activity in config/pricing.json creditCosts, by id (e.g. "video-60"). */
export function creditCost(id: string): number {
  const row = pricing.creditCosts.find((c) => c.id === id);
  if (!row) throw new Error(`Unknown credit cost "${id}"`);
  return row.credits;
}

/**
 * Credits to render one finished video: the base cost for its length, plus one
 * per extra aspect ratio. Storyboard previews are free (charged at render only).
 */
export function renderCredits({ seconds, formats }: { seconds: number; formats: number }): number {
  const base = seconds <= 60 ? creditCost("video-60") : seconds <= 120 ? creditCost("video-120") : creditCost("video-300");
  return base + Math.max(0, formats - 1) * creditCost("aspect-ratio");
}
