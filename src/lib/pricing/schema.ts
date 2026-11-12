import { z } from "zod";

/*
  Schema for config/pricing.json. Objects are strict, so a mistyped key fails
  validation instead of being silently ignored. Cross-field rules live in
  `pricingSchema`'s superRefine below.
*/

const count = z.number().int().nonnegative();
const money = z.number().nonnegative();

const planSchema = z.strictObject({
  id: z.string().regex(/^[a-z][a-z0-9_-]*$/, "lowercase id"),
  name: z.string().min(1),
  /** null = price on application (Enterprise). */
  priceMonthly: money.nullable(),
  priceAnnual: money.nullable(),
  tagline: z.string().min(1),
  videoCredits: z.strictObject({
    /** null = custom allowance. */
    amount: count.nullable(),
    period: z.enum(["once", "month"]),
  }),
  storageGB: count.optional(),
  analysisMinutes: count.optional(),
  brandProfiles: count.optional(),
  users: count.optional(),
  features: z.array(z.string().min(1)).min(1),
});

const walletSchema = z.strictObject({
  id: z.string().min(1),
  covers: z.string().min(1),
  rolloverCycles: count,
});

export const pricingSchema = z
  .strictObject({
    _note: z.string().optional(),
    currency: z.string().regex(/^[A-Z]{3}$/, "ISO 4217 currency code"),
    /** null = not yet confirmed (see docs/decisions.md, open items). */
    gstIncluded: z.boolean().nullable(),
    annualDiscount: z.strictObject({ monthsFree: z.number().int().min(0).max(11) }),
    recommendedPlan: z.string(),
    plans: z.array(planSchema).min(1),
    comparison: z.strictObject({
      columns: z.array(z.string()).min(1),
      rows: z.array(z.array(z.string().min(1)).min(2)),
    }),
    creditCosts: z.array(
      z.strictObject({
        id: z.string().regex(/^[a-z0-9-]+$/, "lowercase id"),
        activity: z.string().min(1),
        credits: count,
        label: z.string().min(1).optional(),
      }),
    ),
    standardVideoIncludes: z.array(z.string().min(1)),
    addOns: z.strictObject({
      credits: z.array(z.strictObject({ amount: z.number().int().positive(), price: money })),
      creditsExpiryDays: z.number().int().positive(),
      storage: z.array(z.strictObject({ gb: z.number().int().positive(), priceMonthly: money.nullable() })),
    }),
    wallets: z.array(walletSchema).min(1),
    rollover: z.strictObject({
      maxRollover: z.string().min(1),
      consumeOldestFirst: z.boolean(),
      annualAllowancesMonthly: z.boolean(),
    }),
    storageExclusions: z.array(z.string().min(1)),
  })
  .superRefine((cfg, ctx) => {
    const issue = (path: (string | number)[], message: string) =>
      ctx.addIssue({ code: "custom", path, message });

    const ids = cfg.plans.map((p) => p.id);
    ids.forEach((id, i) => {
      if (ids.indexOf(id) !== i) issue(["plans", i, "id"], `Duplicate plan id "${id}"`);
    });

    if (!ids.includes(cfg.recommendedPlan)) {
      issue(["recommendedPlan"], `"${cfg.recommendedPlan}" is not a plan id`);
    }

    const factor = 12 - cfg.annualDiscount.monthsFree;
    cfg.plans.forEach((p, i) => {
      if ((p.priceMonthly === null) !== (p.priceAnnual === null)) {
        issue(["plans", i], "priceMonthly and priceAnnual must both be set or both be null");
      } else if (p.priceMonthly !== null && p.priceAnnual !== null) {
        const expected = Math.round(p.priceMonthly * factor * 100) / 100;
        if (p.priceAnnual !== expected) {
          issue(
            ["plans", i, "priceAnnual"],
            `${p.id}: expected ${expected} (${p.priceMonthly} × ${factor} months, annualDiscount.monthsFree = ${cfg.annualDiscount.monthsFree})`,
          );
        }
      }
      // Self-serve plans (with a listed price) must state every limit.
      if (p.priceMonthly !== null) {
        for (const key of ["storageGB", "analysisMinutes", "brandProfiles", "users"] as const) {
          if (p[key] === undefined) issue(["plans", i, key], `${p.id}: ${key} is required for a priced plan`);
        }
        if (p.videoCredits.amount === null) {
          issue(["plans", i, "videoCredits", "amount"], `${p.id}: a priced plan needs a credit amount`);
        }
      }
    });

    cfg.comparison.columns.forEach((col, i) => {
      if (!ids.includes(col)) issue(["comparison", "columns", i], `"${col}" is not a plan id`);
    });
    const width = cfg.comparison.columns.length + 1;
    cfg.comparison.rows.forEach((row, i) => {
      if (row.length !== width) {
        issue(["comparison", "rows", i], `"${row[0]}" has ${row.length} cells, expected ${width} (label + one per column)`);
      }
    });

    cfg.creditCosts.forEach((c, i) => {
      if (c.credits === 0 && !c.label) issue(["creditCosts", i, "label"], `"${c.activity}" costs 0 credits and needs a label (e.g. "Free")`);
    });

    const costIds = cfg.creditCosts.map((c) => c.id);
    costIds.forEach((id, i) => {
      if (costIds.indexOf(id) !== i) issue(["creditCosts", i, "id"], `Duplicate credit cost id "${id}"`);
    });

    const walletIds = cfg.wallets.map((w) => w.id);
    walletIds.forEach((id, i) => {
      if (walletIds.indexOf(id) !== i) issue(["wallets", i, "id"], `Duplicate wallet id "${id}"`);
    });
  });

export type PricingConfig = z.infer<typeof pricingSchema>;
export type Plan = PricingConfig["plans"][number];
export type Wallet = PricingConfig["wallets"][number];

/** Human-readable list of problems, one per line, with the JSON path. */
export function formatPricingIssues(error: z.ZodError): string {
  return error.issues
    .map((i) => `  • ${i.path.length ? i.path.join(".") : "(root)"}: ${i.message}`)
    .join("\n");
}
