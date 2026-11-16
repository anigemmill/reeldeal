import type { MediaId } from "@/content/media";

/*
  Copy and sample data for /product (design/website/W-Product.dc.html).
  Clip names, scores and counts are illustrative sample data, not a real library.
*/

export const PRODUCT_SECTIONS = [
  { id: "autopilot", label: "Autopilot" },
  { id: "studio", label: "Studio" },
  { id: "brand", label: "Brand intelligence" },
  { id: "library", label: "Media library" },
  { id: "export", label: "Export" },
] as const;

export const AUTOPILOT_STEPS = [
  { n: "01", title: "Upload and describe", text: "Pick clips straight from your camera roll and say what the video is for." },
  { n: "02", title: "AI builds three options", text: "It picks the best moments and edits to your brand. Usually a couple of minutes." },
  { n: "03", title: "Approve or ask for changes", text: "“Shorter”, “different music”, “open on the lake”. Then export." },
] as const;

export type StudioFeatureIcon = "timeline" | "assistant" | "captions" | "music" | "brand" | "versions";
export type StudioFeatureTone = "primary" | "ai" | "surface" | "tint";

export const STUDIO_FEATURES: readonly { title: string; text: string; icon: StudioFeatureIcon; tone: StudioFeatureTone }[] = [
  { title: "Timeline and storyboard", text: "Switch between a shot-by-shot board and a precise timeline.", icon: "timeline", tone: "primary" },
  { title: "AI assistant", text: "Ask for edits in plain language. Every change can be kept or undone.", icon: "assistant", tone: "ai" },
  { title: "Captions and text", text: "Auto-timed captions and titles, styled to your brand.", icon: "captions", tone: "surface" },
  { title: "Music and audio", text: "Licensed tracks matched to the mood, with automatic ducking under voice.", icon: "music", tone: "primary" },
  { title: "Brand controls", text: "Lock colours, fonts, logo and end cards so every edit stays on brand.", icon: "brand", tone: "tint" },
  { title: "Versions and history", text: "Every draft is saved. Compare, restore or branch a new version.", icon: "versions", tone: "primary" },
];

export const BRAND_CHIPS = ["Golden hour", "Guests smiling", "Steady shot", "Wide landscape", "Logo-safe", "Best moment 00:12"] as const;

/** Thumbnails circling the brand-intelligence orbit (outer ring then inner ring). */
export const ORBIT_OUTER: readonly MediaId[] = ["lake-kayak", "alpine-sunrise", "forest-ride", "geo-valley", "coast-sail", "lodge-night"];
export const ORBIT_INNER: readonly MediaId[] = ["coast-sail", "forest-ride", "lake-kayak", "alpine-sunrise"];

export const LIBRARY_QUERY = "guests laughing on the jetty at sunset";

export const LIBRARY_RESULTS: readonly { media: MediaId; file: string; time: string; score: string; tags: readonly string[] }[] = [
  { media: "harbour-blue", file: "jetty_dusk_03.mov", time: "00:18", score: "9.4", tags: ["Sunset", "Guests ×4", "Laughing"] },
  { media: "lake-kayak", file: "kayak_02.mov", time: "00:41", score: "9.1", tags: ["Golden hour", "Water", "Wide"] },
  { media: "lodge-night", file: "deck_firepit.mov", time: "00:27", score: "8.7", tags: ["Evening", "Guests ×2"] },
  { media: "alpine-sunrise", file: "ridge_sunrise_04.mov", time: "00:22", score: "8.2", tags: ["Sunrise", "Landscape"] },
];

/** Export formats; width/height classes keep each frame at its real aspect ratio. */
export const EXPORT_FORMATS = [
  { ratio: "9:16", use: "Reels, TikTok", size: "w-[112px] h-[199px]" },
  { ratio: "4:5", use: "Feed", size: "w-[150px] h-[188px]" },
  { ratio: "1:1", use: "Feed, ads", size: "w-[170px] h-[170px]" },
  { ratio: "16:9", use: "YouTube, web", size: "w-[260px] h-[146px]" },
] as const;
