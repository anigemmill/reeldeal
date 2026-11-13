import { z } from "zod";

/*
  Shapes the AI must return. Optional values are nullable (strict structured outputs
  need every key present). These are validated again after generation, and ids the
  model mentions are checked against the organisation's real assets.
*/
export const FORMAT = z.enum(["9:16", "1:1", "16:9", "4:5"]);

export const BriefOutput = z.object({
  objective: z.string(),
  audience: z.string(),
  platform: z.string(),
  format: FORMAT,
  duration_seconds: z.number().int().min(5).max(300),
  tone: z.string(),
  key_message: z.string(),
  call_to_action: z.string(),
  creative_direction: z.string(),
  suggested_asset_ids: z.array(z.string()).max(12),
  from_request: z.array(z.string()).describe("Names of the fields above that the user stated explicitly"),
  assumptions: z.array(z.object({ field: z.string(), assumption: z.string() })),
  missing_information: z.array(z.string()),
});
export type BriefOutput = z.infer<typeof BriefOutput>;

export const ConceptOutput = z.object({
  title: z.string(),
  creative_angle: z.string(),
  hook: z.string(),
  narrative: z.string(),
  visual_direction: z.string(),
  suggested_asset_ids: z.array(z.string()).max(12),
  call_to_action: z.string(),
  recommended_format: FORMAT,
});
export const ConceptsOutput = z.object({ concepts: z.array(ConceptOutput).min(1).max(5) });
export type ConceptsOutput = z.infer<typeof ConceptsOutput>;

export const SceneOutput = z.object({
  scene_number: z.number().int().min(1),
  duration_seconds: z.number().min(0.5).max(60),
  purpose: z.string(),
  on_screen_text: z.string().max(80).nullable(),
  voiceover: z.string().nullable(),
  visual_description: z.string(),
  asset_id: z.string().nullable(),
  source_in_seconds: z.number().min(0).nullable(),
  transition: z.enum(["cut", "dissolve", "fade"]),
  audio_notes: z.string().nullable(),
});
export const StoryboardOutput = z.object({
  title: z.string(),
  format: FORMAT,
  scenes: z.array(SceneOutput).min(1).max(30),
});
export type StoryboardOutput = z.infer<typeof StoryboardOutput>;

export const MediaDescriptionOutput = z.object({
  summary: z.string(),
  subjects: z.array(z.string()),
  environment: z.string(),
  camera_movement: z.string(),
  suggested_uses: z.array(z.string()),
  tags: z.array(z.string()).max(20),
  scene_descriptions: z.array(z.object({ timestamp_seconds: z.number().min(0), description: z.string() })),
});
export type MediaDescriptionOutput = z.infer<typeof MediaDescriptionOutput>;
