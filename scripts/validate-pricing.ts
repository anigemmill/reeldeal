/*
  Dedicated build step: validates config/pricing.json against the Zod schema.
  Runs automatically before `npm run build` (prebuild) and in `npm run check`.
  Usage: npm run validate:pricing [-- path/to/pricing.json]
*/
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { formatPricingIssues, pricingSchema } from "../src/lib/pricing/schema";

const file = resolve(process.argv[2] ?? "config/pricing.json");

let data: unknown;
try {
  data = JSON.parse(readFileSync(file, "utf8"));
} catch (err) {
  console.error(`✗ Could not read ${file} as JSON: ${(err as Error).message}`);
  process.exit(1);
}

const result = pricingSchema.safeParse(data);
if (!result.success) {
  console.error(`✗ Pricing config is invalid (${file}):\n${formatPricingIssues(result.error)}`);
  process.exit(1);
}

const cfg = result.data;
console.log(`✓ Pricing config valid: ${cfg.plans.length} plans, ${cfg.creditCosts.length} credit costs, ${cfg.wallets.length} wallets (${cfg.currency})`);
