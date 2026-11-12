import { getPlan } from "@/lib/pricing";

/*
  SAMPLE DATA for Phase 1 design screens. Replaced by the signed-in user's
  organisation, plan and usage records in Phase 3. Plan limits come from
  config/pricing.json; only the usage numbers are invented.
*/
export const SAMPLE_WORKSPACE = {
  name: "Lakeside Lodge",
  initials: "LL",
  kind: "Brand workspace",
  planId: "creator",
  user: { name: "[Your name]", initials: "AG" },
  usage: { videosUsed: 6, analysisMinutesUsed: 390, storageGBUsed: 212 },
} as const;

export function sampleUsageMeters() {
  const plan = getPlan(SAMPLE_WORKSPACE.planId)!;
  const u = SAMPLE_WORKSPACE.usage;
  const videos = plan.videoCredits.amount ?? 0;
  const hours = (plan.analysisMinutes ?? 0) / 60;
  const storage = plan.storageGB ?? 0;
  return {
    planName: plan.name,
    meters: [
      { id: "videos", label: "Videos", value: `${videos - u.videosUsed} of ${videos} left`, pct: ((videos - u.videosUsed) / videos) * 100 },
      { id: "analysis", label: "Media analysis", value: `${(u.analysisMinutesUsed / 60).toFixed(1)} of ${hours} hrs`, pct: (u.analysisMinutesUsed / 60 / hours) * 100 },
      { id: "storage", label: "Storage", value: `${u.storageGBUsed} of ${storage}GB`, pct: (u.storageGBUsed / storage) * 100 },
    ],
  };
}
