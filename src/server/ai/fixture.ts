import type { AiProvider, GenerateRequest } from "./provider";
import { createMockProvider } from "./provider";

/*
  TEST FIXTURE AI (AI_PROVIDER=fixture). Deterministic, offline output built from the
  real prompt (footage ids, durations, request text), so automated browser tests can
  run the whole creative workflow without paid API calls. It does not "generate"
  anything: the app labels it as test output, and production builds refuse to use it.
*/
export function createFixtureProvider(): AiProvider {
  const p = createMockProvider((req: GenerateRequest<unknown>) => {
    const footage = [...req.user.matchAll(/- id ([0-9a-f-]{36}): "([^"]*)" · ([\d.?]+)s/g)].map((m) => ({ id: m[1]!, title: m[2]!, seconds: Number(m[3]) || 5 }));
    const request = /<request>\n([\s\S]*?)\n<\/request>/.exec(req.user)?.[1]?.trim() ?? "your video";
    const target = Number(/(\d+)-second/.exec(req.system)?.[1] ?? 15);
    const format = (/second (9:16|1:1|16:9|4:5)/.exec(req.system)?.[1] ?? "9:16") as "9:16";
    const n = Number(/exactly (\d+) concepts/.exec(req.system)?.[1] ?? 3);
    if (req.task === "video_brief")
      return {
        objective: request.slice(0, 120), audience: "People planning a short break", platform: "Instagram Reels", format: "9:16", duration_seconds: 15, tone: "Calm and warm",
        key_message: request.slice(0, 80), call_to_action: "Book direct", creative_direction: "Open on the strongest clip, end on a clear call to action.",
        suggested_asset_ids: footage.slice(0, 3).map((f) => f.id), from_request: ["objective"],
        assumptions: [{ field: "audience", assumption: "Not stated: assumed people planning a short break" }], missing_information: ["Any offer or price to mention?"],
      };
    if (req.task === "video_concepts")
      return {
        concepts: ["Slow start", "The details", "One perfect day", "Locals know", "Why now"].slice(0, n).map((t, i) => ({
          title: `${t} (test)`, creative_angle: ["emotional", "practical", "story-led", "social proof", "urgency"][i]!, hook: `${t}: ${request.slice(0, 40)}`, narrative: "Three beats: arrive, enjoy, book.",
          visual_direction: "Natural light, steady shots.", suggested_asset_ids: footage.slice(i, i + 2).map((f) => f.id), call_to_action: "Book direct", recommended_format: "9:16",
        })),
      };
    if (req.task === "storyboard") {
      const clips = footage.length ? footage : [];
      const body = Math.max(1, target - 3);
      const per = clips.length ? Math.max(2, Math.round(body / Math.min(clips.length, 3))) : body;
      const scenes: Record<string, unknown>[] = clips.slice(0, 3).map((c, i) => ({
        scene_number: i + 1, duration_seconds: Math.min(per, Math.max(1, Math.floor(c.seconds))), purpose: i === 0 ? "hook" : "show", on_screen_text: i === 0 ? request.split(/\s+/).slice(0, 5).join(" ") : null,
        voiceover: null, visual_description: c.title, asset_id: c.id, source_in_seconds: 0, transition: "cut", audio_notes: null,
      }));
      scenes.push({ scene_number: scenes.length + 1, duration_seconds: 3, purpose: "call to action", on_screen_text: "Book direct today", voiceover: null, visual_description: "Brand colour end card", asset_id: null, source_in_seconds: null, transition: "fade", audio_notes: null });
      return { title: `Test storyboard: ${request.slice(0, 40)}`, format, scenes };
    }
    if (req.task === "media_description") return { summary: "Test description", subjects: [], environment: "", camera_movement: "", suggested_uses: [], tags: [], scene_descriptions: [] };
    throw new Error(`fixture: unknown task ${req.task}`);
  });
  return {
    name: "fixture (test output, not AI)",
    model: "fixture",
    generate: async (req) => ({ ...(await p.generate(req)), model: "fixture" }),
  } as AiProvider;
}
