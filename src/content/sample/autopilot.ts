import type { MediaId } from "@/content/media";

/* SAMPLE DATA for the Phase 1 Autopilot design (design/explorations/Autopilot*.dc.html). */

export const AUTOPILOT_FOOTAGE: { count: number; thumbs: MediaId[] } = {
  count: 23,
  thumbs: ["lake-kayak", "alpine-sunrise", "forest-ride", "coast-sail", "lodge-night"],
};

export const AUTOPILOT_GOALS = ["Drive bookings", "Promote an offer", "Show the experience", "Seasonal update"] as const;

export const AUTOPILOT_DEFAULT_BRIEF =
  "A calm summer morning at the lodge. Kayaking, coffee on the deck, ending on the lake view. Push direct bookings.";

export const AUTOPILOT_FORMATS = [
  { id: "9:16", label: "9:16", hint: "Reels, TikTok, Stories" },
  { id: "1:1", label: "1:1", hint: "Feed posts" },
  { id: "16:9", label: "16:9", hint: "YouTube, website" },
] as const;

export const AUTOPILOT_LENGTHS = [15, 30, 60] as const;

export const AUTOPILOT_STAGES = [
  { at: 0, label: "Analysing 23 clips", done: "Analysed 23 clips", meta: "4.2 GB" },
  { at: 30, label: "Finding best moments", done: "Found 9 best moments", meta: "00:47" },
  { at: 60, label: "Applying Lakeside Lodge style", done: "Applied Lakeside Lodge style", meta: "brand" },
  { at: 82, label: "Cutting 3 options", done: "Cut 3 options", meta: "3 × 0:30" },
];

export const AUTOPILOT_OPTIONS: { id: string; media: MediaId; name: string; mood: string; hook: string }[] = [
  { id: "o1", media: "lake-kayak", name: "Calm", mood: "Slow cuts, acoustic guitar, soft captions", hook: "Wake up to this." },
  { id: "o2", media: "forest-ride", name: "Energetic", mood: "Fast cuts on the beat, bold captions", hook: "Your summer starts here." },
  { id: "o3", media: "alpine-sunrise", name: "Story", mood: "One morning, start to finish, voice-led", hook: "One morning at the lodge." },
];

export const AUTOPILOT_CHANGES = ["Shorter", "Different music", "Change the opening", "More people"];
