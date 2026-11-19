"use server";

import { revalidatePath } from "next/cache";
import { getPlatform } from "@/server/app/platform";
import { withCtx } from "@/server/app/result";
import { loadAppContext } from "@/server/app/session";
import { updateBrand, type BrandInput } from "@/server/services/brands";
import { setAiMediaConsent } from "@/server/services/workspace";
import { saveOnboardingStep, savePreferences, updateWorkspaceDetails, type OnboardingStep } from "@/server/services/workspace-settings";

/*
  Onboarding steps 4–7 (/onboarding/setup). Each step saves to the workspace, then records progress
  (organisations.onboarding_step) so a return visit, on any device, resumes at the next step.
  "Skip for now" only records progress. Setup is the owner's: the services refuse anyone else.
*/
const STEPS = new Set<OnboardingStep>(["brand", "assets", "preferences", "done"]);

/** Record a finished or skipped step. */
export async function recordStepAction(step: OnboardingStep) {
  if (!STEPS.has(step)) return { ok: false as const, error: { code: "invalid_input", message: "Unknown step." } };
  // No revalidation here: the dashboard renders per request, and revalidating this route would make the
  // setup page redirect (setup finished) before the "You're all set" screen is shown.
  return withCtx((ctx) => saveOnboardingStep(ctx, step));
}

/** Step 4: the first brand profile (created with the workspace), then progress. */
export async function saveBrandStepAction(brandId: string, input: Pick<BrandInput, "name" | "colours" | "voice" | "audiences">) {
  return withCtx(async (ctx) => {
    const b = await updateBrand(ctx, String(brandId), input);
    await saveOnboardingStep(ctx, "brand");
    return b;
  });
}

/** Step 5: link an uploaded image as the brand logo (or clear it). Upload itself uses the media actions. */
export async function setBrandLogoAction(brandId: string, mediaId: string | null) {
  return withCtx((ctx) => updateBrand(ctx, String(brandId), { logo_media_id: mediaId }));
}

/** Step 6: appearance and email preference (the person), main format and AI consent (the workspace). */
export async function savePreferencesStepAction(input: { mode: "workspace" | "studio"; format: "9:16" | "1:1" | "16:9" | "4:5"; aiConsent: boolean; emailWhenReady: boolean }) {
  const c = await loadAppContext();
  if (!c || !("ctx" in c)) return { ok: false as const, error: { code: "unauthenticated", message: "Your session has ended. Sign in again to continue." } };
  const r = await withCtx(async (ctx) => {
    await savePreferences(await getPlatform(), c.user.id, { mode: input.mode, email_when_render_ready: Boolean(input.emailWhenReady) });
    // The main format becomes the workspace default; more can be added in Settings → Workspace.
    const formats = [input.format];
    await updateWorkspaceDetails(ctx, { default_formats: formats });
    await setAiMediaConsent(ctx, Boolean(input.aiConsent));
    await saveOnboardingStep(ctx, "preferences");
    return { saved: true };
  });
  if (r.ok) revalidatePath("/", "layout");
  return r;
}
