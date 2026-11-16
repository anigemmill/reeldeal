/*
  Sign-up links that carry the plan someone picked on the pricing page.
  No imports, so client components (the plan cards) can use it without
  pulling the pricing config into the browser bundle.
*/
export type Billing = "monthly" | "annual";

export function signupHref(planId?: string, billing: Billing = "monthly"): string {
  if (!planId || planId === "free") return "/signup";
  const q = new URLSearchParams({ plan: planId });
  if (billing === "annual") q.set("billing", "annual");
  return `/signup?${q}`;
}
