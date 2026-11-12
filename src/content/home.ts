import type { MediaId } from "./media";

/*
  Homepage copy and showcase data (design/website/W-Home.dc.html).
  Business names on tiles are invented placeholders (docs/decisions.md):
  replace with real customers only with permission.
*/

export const HERO_TILES: { media: MediaId; title: string; meta: string }[] = [
  { media: "lake-kayak", title: "Lakeside Lodge", meta: "REEL · 0:24 · AUTOPILOT" },
  { media: "geo-valley", title: "Valley Geothermal", meta: "STORY · 0:15 · AUTOPILOT" },
  { media: "forest-ride", title: "Redwoods Trail Co.", meta: "TIKTOK · 0:18 · STUDIO" },
  { media: "coast-sail", title: "Bay Sail Charters", meta: "FEED · 0:30 · AUTOPILOT" },
  { media: "lodge-night", title: "Alpine Lodge", meta: "REEL · 0:20 · STUDIO" },
  { media: "alpine-sunrise", title: "Ridge Walks", meta: "WEBSITE · 0:45 · STUDIO" },
  { media: "beach-turquoise", title: "Cove Kayak Hire", meta: "REEL · 0:12 · AUTOPILOT" },
  { media: "vineyard-gold", title: "Hillside Estate", meta: "AD · 0:15 · AUTOPILOT" },
  { media: "harbour-blue", title: "Harbour Café", meta: "STORY · 0:10 · AUTOPILOT" },
  { media: "geo-valley", title: "Hot Pools Spa", meta: "REEL · 0:30 · STUDIO" },
  { media: "lodge-night", title: "Rooftop Bar", meta: "TIKTOK · 0:14 · AUTOPILOT" },
  { media: "alpine-sunrise", title: "Alpine Retreat", meta: "FEED · 0:30 · STUDIO" },
];

export const HERO_PROMPTS = [
  "30s reel for summer bookings",
  "Kayak tour highlights, 15 seconds",
  "Christmas offer for the café",
  "Sunrise walk for our website",
  "Behind the scenes at the hot pools",
];

export const WALL_FEATURED: { prompt: string; media: MediaId }[] = [
  { prompt: "Wedding venue tour, 45 seconds", media: "vineyard-gold" },
  { prompt: "Weekend specials for Instagram", media: "harbour-blue" },
  { prompt: "Meet our guides", media: "forest-ride" },
  { prompt: "Hot pools at golden hour", media: "geo-valley" },
];

export const WALL_PROMPTS = [
  "Weekend specials", "Meet the team", "New season menu", "Group bookings", "Sunset cruise teaser", "Thank our guests",
  "Rainy day ideas", "Staff picks", "Launch the trail", "Last-minute deals", "Wedding venue tour", "Family pass promo",
];
export const WALL_WORDS = ["Go.", "Book", "now", "Reel", "Hey!", "wow"];

export const STEPS = [
  { n: "01", title: "Upload", who: "YOU", text: "Drop in clips from your phone, drive or camera roll. Any length, any order." },
  { n: "02", title: "Brand", who: "ONCE", text: "Set your colours, fonts, logo and tone a single time. Every video follows it." },
  { n: "03", title: "Brief", who: "YOU", text: "Pick a goal and describe the video in a sentence." },
  { n: "04", title: "Generate", who: "AI", text: "It finds the best moments and cuts three on-brand options." },
  { n: "05", title: "Refine", who: "YOU + AI", text: "Approve, ask for changes in plain words, or open it in Studio." },
  { n: "06", title: "Export", who: "AI", text: "Sized for every channel you post to, ready to go." },
];

export const INDUSTRIES = ["Tours and activities", "Accommodation", "Attractions", "Hospitality", "Destinations", "Agencies"];

/** Plans shown in the homepage pricing teaser (values come from config/pricing.json). */
export const TEASER_PLANS = ["starter", "creator", "business"] as const;
