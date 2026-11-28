import type { MediaId } from "@/content/media";

/*
  SAMPLE GALLERY for /showcase (design/website/W-Showcase.dc.html).
  These are examples, not customers' videos, and no business is named (owner, 2026-11-28).
  The page labels them as samples. Three use the owner's photos; the rest are placeholders. Replace with approved customer videos before launch
  ([CUSTOMER VIDEOS] still needed from the owner).
*/

export const SHOWCASE_FILTERS = ["All", "Reels", "Ads", "Website", "Tourism", "Hospitality", "Autopilot", "Studio"] as const;
export type ShowcaseFilter = (typeof SHOWCASE_FILTERS)[number];

export type ShowcaseItem = {
  id: string;
  title: string;
  business: string;
  format: string;
  mode: "Autopilot" | "Studio";
  media: MediaId;
  /** Tile height class, for the masonry rhythm. */
  height: string;
  tags: readonly ShowcaseFilter[];
};

export const SHOWCASE_ITEMS: readonly ShowcaseItem[] = [
  { id: "wake-up", title: "Wake up to this", business: "Accommodation", format: "REEL · 0:15", mode: "Autopilot", media: "lake-kayak", height: "h-[420px]", tags: ["Reels", "Tourism", "Autopilot"] },
  { id: "friday-night", title: "Friday night set", business: "Hospitality", format: "FEED · 0:20", mode: "Studio", media: "harbour-blue", height: "h-[300px]", tags: ["Ads", "Hospitality", "Studio"] },
  { id: "trail-today", title: "Today on the trail", business: "Tours", format: "TIKTOK · 0:18", mode: "Autopilot", media: "forest-ride", height: "h-[460px]", tags: ["Reels", "Tourism", "Autopilot"] },
  { id: "what-to-expect", title: "What to expect", business: "Attraction", format: "WEB · 1:00", mode: "Studio", media: "geo-valley", height: "h-[240px]", tags: ["Website", "Tourism", "Studio"] },
  { id: "sunset-sailing", title: "Sunset sailing", business: "Tours", format: "AD · 0:15", mode: "Autopilot", media: "showcase-sunset-sailing", height: "h-[340px]", tags: ["Ads", "Tourism", "Autopilot"] },
  { id: "spring-sunrise", title: "Spring sunrise tours", business: "Tours", format: "REEL · 0:20", mode: "Autopilot", media: "alpine-sunrise", height: "h-[420px]", tags: ["Reels", "Tourism", "Autopilot"] },
  { id: "season-menu", title: "New season menu", business: "Hospitality", format: "FEED · 0:20", mode: "Autopilot", media: "showcase-season-menu", height: "h-[300px]", tags: ["Reels", "Hospitality", "Autopilot"] },
  { id: "room-tour", title: "Room tour", business: "Accommodation", format: "WEB · 0:45", mode: "Studio", media: "lodge-night", height: "h-[250px]", tags: ["Website", "Tourism", "Studio"] },
  { id: "hot-pools", title: "Hot pools at night", business: "Attraction", format: "STORY · 0:10", mode: "Autopilot", media: "geo-valley", height: "h-[440px]", tags: ["Reels", "Tourism", "Autopilot"] },
  { id: "meet-guides", title: "Meet your guides", business: "Tours", format: "FEED · 0:30", mode: "Studio", media: "showcase-meet-guides", height: "h-[320px]", tags: ["Reels", "Tourism", "Studio"] },
  { id: "summer-region", title: "Summer in the region", business: "Destination", format: "WEB · 1:00", mode: "Studio", media: "beach-turquoise", height: "h-[260px]", tags: ["Website", "Tourism", "Studio"] },
  { id: "wedding-venue", title: "Wedding venue tour", business: "Events", format: "REEL · 0:45", mode: "Autopilot", media: "alpine-sunrise", height: "h-[380px]", tags: ["Reels", "Hospitality", "Autopilot"] },
];

/** Case-insensitive match on title, business, format, mode and tags. */
export function filterShowcase(items: readonly ShowcaseItem[], filter: ShowcaseFilter, query: string): ShowcaseItem[] {
  const q = query.trim().toLowerCase();
  return items.filter((it) => {
    if (filter !== "All" && !it.tags.includes(filter)) return false;
    if (!q) return true;
    return [it.title, it.business, it.format, it.mode, ...it.tags].some((s) => s.toLowerCase().includes(q));
  });
}
