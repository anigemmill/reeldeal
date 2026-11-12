import type { MediaId } from "@/content/media";

/*
  SAMPLE DATA for the Phase 1 Studio design (design/app/A-Studio.dc.html).
  The timeline shape (tracks of timed items) mirrors what the Phase 4 edit model
  needs, so the editor UI can be wired to real projects without a rewrite.
*/
export const STUDIO_PROJECT = {
  title: "Summer bookings reel",
  workspace: "Lakeside Lodge",
  option: "Option 1",
  duration: 30,
  formats: ["9:16"] as string[],
};

export type StudioClip = { id: string; name: string; media: MediaId; start: number; end: number; sourceIn: number; caption?: string };

export const STUDIO_CLIPS: StudioClip[] = [
  { id: "c1", name: "jetty_dusk_03", media: "harbour-blue", start: 0, end: 4.2, sourceIn: 9.2, caption: "Wake up to this." },
  { id: "c2", name: "kayak_02", media: "lake-kayak", start: 4.2, end: 9.0, sourceIn: 3 },
  { id: "c3", name: "deck_coffee", media: "vineyard-gold", start: 9.0, end: 12.6, sourceIn: 1.1 },
  { id: "c4", name: "ridge_sunrise_04", media: "alpine-sunrise", start: 12.6, end: 18.3, sourceIn: 6, caption: "Lakeside, 20 min from town" },
  { id: "c5", name: "steam_valley", media: "geo-valley", start: 18.3, end: 23.1, sourceIn: 11.12 },
  { id: "c6", name: "lake_wide_end", media: "coast-sail", start: 23.1, end: 30, sourceIn: 0, caption: "Book direct and save" },
];

export const STUDIO_TEXT = [
  { id: "t1", label: "Wake up to this.", start: 0.3, end: 5.6 },
  { id: "t2", label: "Lakeside, 20 min from town", start: 12, end: 17.4 },
  { id: "t3", label: "Book direct", start: 24, end: 29.7 },
];

export const STUDIO_COMMENTS = [
  { id: "r1", at: 11.4, text: "Logo too small here", by: "Aroha (reviewer)" },
  { id: "r2", at: 24.3, text: "Add the booking link", by: "Aroha (reviewer)" },
];

export const STUDIO_LIBRARY: { id: string; name: string; media: MediaId; score: number; duration: string }[] = [
  { id: "l1", name: "jetty_dusk_03", media: "harbour-blue", score: 9.4, duration: "00:18" },
  { id: "l2", name: "kayak_02", media: "lake-kayak", score: 9.1, duration: "00:41" },
  { id: "l3", name: "ridge_sunrise", media: "alpine-sunrise", score: 8.9, duration: "00:22" },
  { id: "l4", name: "trail_walk_01", media: "forest-ride", score: 8.6, duration: "01:05" },
  { id: "l5", name: "deck_firepit", media: "lodge-night", score: 8.4, duration: "00:27" },
  { id: "l6", name: "steam_valley", media: "geo-valley", score: 8.1, duration: "00:33" },
  { id: "l7", name: "bay_swim", media: "beach-turquoise", score: 7.8, duration: "00:12" },
  { id: "l8", name: "vines_golden", media: "vineyard-gold", score: 7.6, duration: "00:46" },
];

export const STUDIO_VERSIONS = [
  { id: "v3", name: "v3 · current", who: "YOU + AI", text: "Opened on jetty, faster middle", when: "2 min ago" },
  { id: "v2", name: "v2", who: "YOU", text: "Changed end card text", when: "9 min ago" },
  { id: "v1", name: "v1", who: "AI", text: "Storyboard option 1 · Calm", when: "14 min ago" },
];

export const STUDIO_AUDIO = [
  { id: "a1", name: "Morning Lake", mood: "Warm acoustic", duration: "0:30", current: true },
  { id: "a2", name: "Open Road", mood: "Upbeat indie", duration: "0:30" },
  { id: "a3", name: "Still Water", mood: "Ambient piano", duration: "0:30" },
];

/** Deterministic waveform heights (0–1) for the music track. */
export const STUDIO_WAVE = Array.from({ length: 96 }, (_, i) => 0.25 + 0.65 * Math.abs(Math.sin(i * 0.45) * Math.cos(i * 0.11)));

/** "00:12.40" */
export function timecode(seconds: number): string {
  const s = Math.max(0, seconds);
  const pad = (n: number) => String(Math.floor(n)).padStart(2, "0");
  return `${pad(s / 60)}:${pad(s % 60)}.${pad((s % 1) * 100)}`;
}
