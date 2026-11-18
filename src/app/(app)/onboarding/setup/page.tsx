import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { SetupFlow, type SetupData, type SetupStep } from "@/components/app/onboarding/setup-flow";
import { getPlan } from "@/lib/pricing";
import { getPlatform } from "@/server/app/platform";
import { requireAppContext } from "@/server/app/session";
import { getBrand } from "@/server/services/brands";
import { getOnboardingState, getPreferences, getWorkspaceSettings } from "@/server/services/workspace-settings";

export const metadata: Metadata = { title: "Finish setting up" };

/*
  Onboarding steps 4–7 for the workspace owner. Resumes at the saved step (organisations.onboarding_step),
  so it works after signing out or on another device. Finished setups and invited members go to the dashboard.
*/
const STEPS: SetupStep[] = ["brand", "assets", "preferences", "done"];

async function Content({ searchParams }: PageProps<"/onboarding/setup">) {
  const c = await requireAppContext("/onboarding/setup");
  const p = await getPlatform();
  const state = await getOnboardingState(p, c.user.id, c.ctx.principal.orgId);
  if (state.stage !== "setup") redirect("/dashboard");
  const q = await searchParams;
  const asked = typeof q.step === "string" && STEPS.includes(q.step as SetupStep) ? (q.step as SetupStep) : null;
  const saved = (state.next_step ?? "brand") as SetupStep;
  // Going back to an earlier step is fine; skipping ahead past the saved progress isn't.
  const step = asked && STEPS.indexOf(asked) <= STEPS.indexOf(saved) ? asked : saved;
  const [w, prefs] = await Promise.all([getWorkspaceSettings(c.ctx), getPreferences(p, c.user.id)]);
  const def = w.brands.default;
  const brand = def ? ((await getBrand(c.ctx, def.id)) as { target_audiences?: string[]; brand_voice?: string }) : null;
  const plan = getPlan(w.plan.id);
  const data: SetupData = {
    workspace: w.organisation.name,
    planName: w.plan.name,
    trialVideos: plan?.videoCredits.period === "once" ? plan.videoCredits.amount : null,
    brand: def ? { id: def.id, name: def.name, colours: def.colours, voice: brand?.brand_voice ?? "", audience: brand?.target_audiences?.[0] ?? "", hasLogo: Boolean(def.logo_media_id) } : null,
    prefs: {
      mode: prefs.mode === "studio" ? "studio" : "workspace",
      format: (["9:16", "1:1", "16:9", "4:5"].includes(w.organisation.default_formats[0] ?? "") ? w.organisation.default_formats[0] : "9:16") as SetupData["prefs"]["format"],
      aiConsent: w.organisation.ai_media_analysis_consent,
      emailWhenReady: prefs.email_when_render_ready,
    },
  };
  return <SetupFlow initialStep={step} data={data} />;
}

export default function SetupPage(props: PageProps<"/onboarding/setup">) {
  return (
    <Suspense fallback={null}>
      <Content {...props} />
    </Suspense>
  );
}
