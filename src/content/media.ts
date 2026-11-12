import type { SceneVariant } from "@/components/media/scene";

/*
  MEDIA REGISTRY. Every image and clip shown on the Phase 1 screens comes from
  here. No production asset library exists yet, so entries are placeholders
  (illustrated scenes). To use real media, set `src` (and `poster` for video)
  on an entry, put the file in /public/media/ or object storage, and remove
  `placeholder`. Screens reference ids only and need no changes.

  Names, places and businesses here are invented sample data (docs/decisions.md).
*/
export type MediaAsset = {
  id: string;
  title: string;
  /** Alt text describing the picture. */
  alt: string;
  kind: "image" | "video";
  /** Seconds, for video. */
  duration?: number;
  /** Real file URL. When set, it is shown instead of the placeholder. */
  src?: string;
  /** Poster frame for real video. */
  poster?: string;
  /** Placeholder scene used until `src` is set. */
  placeholder?: SceneVariant;
};

const asset = (a: MediaAsset) => a;

export const MEDIA = {
  "alpine-sunrise": asset({ id: "alpine-sunrise", title: "Ridge walk at sunrise", alt: "Hiker on a mountain ridge at sunrise", kind: "video", duration: 14, placeholder: "alpine-dawn" }),
  "lake-kayak": asset({ id: "lake-kayak", title: "Morning paddle", alt: "Kayaker on a calm lake with misty hills", kind: "video", duration: 22, placeholder: "lake-morning" }),
  "coast-sail": asset({ id: "coast-sail", title: "Sunset sail", alt: "Sailboat silhouetted on the sea at sunset", kind: "video", duration: 18, placeholder: "coast-sunset" }),
  "forest-ride": asset({ id: "forest-ride", title: "Forest trail ride", alt: "Cyclist on a forest trail with light through the trees", kind: "video", duration: 31, placeholder: "forest-trail" }),
  "geo-valley": asset({ id: "geo-valley", title: "Geothermal valley", alt: "Steam rising over a geothermal valley and turquoise pool", kind: "video", duration: 12, placeholder: "geothermal" }),
  "lodge-night": asset({ id: "lodge-night", title: "Lodge under the stars", alt: "Lit lodge beneath a starry night sky and mountains", kind: "video", duration: 16, placeholder: "night-sky" }),
  "vineyard-gold": asset({ id: "vineyard-gold", title: "Golden hour vines", alt: "Rolling vineyard rows at golden hour", kind: "image", placeholder: "vineyard" }),
  "harbour-blue": asset({ id: "harbour-blue", title: "Harbour at blue hour", alt: "Jetty and harbour lights reflected at dusk", kind: "video", duration: 9, placeholder: "harbour-dusk" }),
  "beach-turquoise": asset({ id: "beach-turquoise", title: "Turquoise bay", alt: "Palm-fringed beach with turquoise water", kind: "video", duration: 20, placeholder: "beach-day" }),
} satisfies Record<string, MediaAsset>;

export type MediaId = keyof typeof MEDIA;

export function getMedia(id: MediaId): MediaAsset {
  return MEDIA[id];
}

/** "0:14" style duration. */
export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}
