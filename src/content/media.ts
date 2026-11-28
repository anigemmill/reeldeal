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
  // Real media (owner's footage, permission confirmed 2026-11-28). Businesses are never named.
  "hero-brunch": asset({ id: "hero-brunch", title: "Brunch?", alt: "Syrup pouring onto a stack of pancakes, with the word Brunch?", kind: "video", duration: 20, src: "/media/hero-brunch.mp4", poster: "/media/hero-brunch.poster.webp" }),
  "hero-conch": asset({ id: "hero-conch", title: "Call to gather", alt: "Young Māori man blowing a conch shell trumpet", kind: "video", duration: 21, src: "/media/hero-conch.mp4", poster: "/media/hero-conch.poster.webp" }),
  "hero-volunteers": asset({ id: "hero-volunteers", title: "The taonga for the volunteers", alt: "Man speaking in an interview, captioned: The taonga for the volunteers", kind: "video", duration: 30, src: "/media/hero-volunteers.mp4", poster: "/media/hero-volunteers.poster.webp" }),
  "hero-gallery-guide": asset({ id: "hero-gallery-guide", title: "Meet the guide", alt: "Guide in a printed T-shirt speaking to camera outside a gallery entrance", kind: "video", duration: 129, src: "/media/hero-gallery-guide.mp4", poster: "/media/hero-gallery-guide.poster.webp" }),
  "hero-light-show": asset({ id: "hero-light-show", title: "After dark", alt: "Pink, green and blue lights playing across rising steam at night", kind: "video", duration: 23, src: "/media/hero-light-show.mp4", poster: "/media/hero-light-show.poster.webp" }),
  "hero-welcome": asset({ id: "hero-welcome", title: "Welcome", alt: "Host in a cap and puffer vest welcoming viewers to camera", kind: "video", duration: 54, src: "/media/hero-welcome.mp4", poster: "/media/hero-welcome.poster.webp" }),
  "hero-bet-youve-never": asset({ id: "hero-bet-youve-never", title: "I bet you've never…", alt: "Split-screen reel of a group walking a forest path, captioned: I bet you've never", kind: "video", duration: 30, src: "/media/hero-bet-youve-never.mp4", poster: "/media/hero-bet-youve-never.poster.webp" }),
  "hero-chef": asset({ id: "hero-chef", title: "The Artist", alt: "Chef in a white jacket and striped apron, titled: The Artist", kind: "video", duration: 14, src: "/media/hero-chef.mp4", poster: "/media/hero-chef.poster.webp" }),
  "hero-steam-vent": asset({ id: "hero-steam-vent", title: "Steam and sulphur", alt: "Steam billowing from a yellow sulphur vent at the edge of a lake", kind: "video", duration: 19, src: "/media/hero-steam-vent.mp4", poster: "/media/hero-steam-vent.poster.webp" }),
  "hero-waka-haul": asset({ id: "hero-waka-haul", title: "All hands", alt: "Team in black T-shirts hauling a carved waka along a paved path", kind: "video", duration: 75, src: "/media/hero-waka-haul.mp4", poster: "/media/hero-waka-haul.poster.webp" }),
  "hero-trail-rider": asset({ id: "hero-trail-rider", title: "On the trail", alt: "Mountain biker riding a boardwalk through geothermal steam", kind: "video", duration: 86, src: "/media/hero-trail-rider.mp4", poster: "/media/hero-trail-rider.poster.webp" }),
  "hero-rotomahana": asset({ id: "hero-rotomahana", title: "Discover Lake Rotomahana", alt: "Aerial view of a boat jetty on a bush-fringed lake, captioned: Discover Lake Rotomahana", kind: "video", duration: 10, src: "/media/hero-rotomahana.mp4", poster: "/media/hero-rotomahana.poster.webp" }),
  "home-geothermal-aerial": asset({ id: "home-geothermal-aerial", title: "Geothermal valley from above", alt: "Aerial view of steaming silica terraces and native bush", kind: "image", src: "/media/home-geothermal-aerial.webp" }),
  "home-kayaks-steam": asset({ id: "home-kayaks-steam", title: "Kayaks by the steam", alt: "Two kayakers paddling past steaming cliffs on a blue lake", kind: "image", src: "/media/home-kayaks-steam.webp" }),
  "home-cruise-sunset": asset({ id: "home-cruise-sunset", title: "Sunset cruise", alt: "Passengers on the top deck of a cruise boat at sunset", kind: "image", src: "/media/home-cruise-sunset.webp" }),
  "home-guide-sunlight": asset({ id: "home-guide-sunlight", title: "Guide at golden hour", alt: "Māori guide with tā moko greeting guests in low sunlight", kind: "image", src: "/media/home-guide-sunlight.webp" }),
  "home-steam-lookout": asset({ id: "home-steam-lookout", title: "Steam lookout", alt: "Woman in a cap looking out over rising geothermal steam", kind: "image", src: "/media/home-steam-lookout.webp" }),
  "home-geyser-steam": asset({ id: "home-geyser-steam", title: "Geyser steam", alt: "Steam rising from a geothermal field among rocks and bush", kind: "image", src: "/media/home-geyser-steam.webp" }),
  "home-workshop-presenter": asset({ id: "home-workshop-presenter", title: "Behind the scenes", alt: "Presenter talking to camera in a wood-lined workshop", kind: "image", src: "/media/home-workshop-presenter.webp" }),
  "tourism-valley-lookout": asset({ id: "tourism-valley-lookout", title: "Valley lookout", alt: "Couple at a lookout above a steaming crater lake and forested valley", kind: "image", src: "/media/tourism-valley-lookout.webp" }),
  "tourism-steam-boardwalk": asset({ id: "tourism-steam-boardwalk", title: "Steam boardwalk", alt: "Visitor on a wooden boardwalk among geothermal steam and bush", kind: "image", src: "/media/tourism-steam-boardwalk.webp" }),
  "tourism-couple-boardwalk": asset({ id: "tourism-couple-boardwalk", title: "On the boardwalk", alt: "Young couple standing on a forest boardwalk in sunshine", kind: "image", src: "/media/tourism-couple-boardwalk.webp" }),
  "tourism-crater-lake": asset({ id: "tourism-crater-lake", title: "Crater lake", alt: "Couple looking out over a steaming crater lake", kind: "image", src: "/media/tourism-crater-lake.webp" }),
  "showcase-sunset-sailing": asset({ id: "showcase-sunset-sailing", title: "Sunset sailing", alt: "Cruise boat with guests on deck below forested hills", kind: "image", src: "/media/showcase-sunset-sailing.webp" }),
  "showcase-season-menu": asset({ id: "showcase-season-menu", title: "New season menu", alt: "Overhead view of a shared table of dishes, prawns and oysters", kind: "image", src: "/media/showcase-season-menu.webp" }),
  "showcase-meet-guides": asset({ id: "showcase-meet-guides", title: "Meet your guides", alt: "Māori guide with tā moko speaking in golden light", kind: "image", src: "/media/showcase-meet-guides.webp" }),
  "product-drone-wake": asset({ id: "product-drone-wake", title: "Drone: boat wake", alt: "Aerial view of a cruise boat cutting a white wake across dark water", kind: "image", src: "/media/product-drone-wake.webp" }),
  "product-cruise-guests": asset({ id: "product-cruise-guests", title: "Guests on deck", alt: "Smiling couple with drinks on the deck of a boat", kind: "image", src: "/media/product-cruise-guests.webp" }),
  "product-cruise-hills": asset({ id: "product-cruise-hills", title: "Cruise below the hills", alt: "Cruise boat with guests on deck below forested hills", kind: "image", src: "/media/product-cruise-hills.webp" }),
  "product-cruise-lunch": asset({ id: "product-cruise-lunch", title: "Lunch on board", alt: "Guests laughing over a shared platter inside a boat cabin", kind: "image", src: "/media/product-cruise-lunch.webp" }),
  "product-drone-boat": asset({ id: "product-drone-boat", title: "Drone: open water", alt: "Small cruise boat on wide dark water from above", kind: "image", src: "/media/product-drone-boat.webp" }),
  "product-boat-wake": asset({ id: "product-boat-wake", title: "Boat wake", alt: "Cruise boat crossing a pale lake, trailing a wake", kind: "image", src: "/media/product-boat-wake.webp" }),
  "product-swans-dawn": asset({ id: "product-swans-dawn", title: "Swans at dawn", alt: "Two black swans on a misty lake at sunrise", kind: "image", src: "/media/product-swans-dawn.webp" }),
  "product-drone-wake-export": asset({ id: "product-drone-wake-export", title: "One shot, every shape", alt: "Aerial view of a cruise boat cutting a white wake across dark water", kind: "image", src: "/media/product-drone-wake-export.webp" }),
  "product-sunrise-carvings": asset({ id: "product-sunrise-carvings", title: "Sunrise over the carvings", alt: "Carved wooden posts silhouetted against a sunrise over steam", kind: "image", src: "/media/product-sunrise-carvings.webp" }),
  "product-firepit-lounge": asset({ id: "product-firepit-lounge", title: "Firepit lounge", alt: "Timber-lined lounge with a sunken firepit", kind: "image", src: "/media/product-firepit-lounge.webp" }),
  "product-night-lights": asset({ id: "product-night-lights", title: "Night lights", alt: "Visitors on a boardwalk watching lights play over steam at night", kind: "image", src: "/media/product-night-lights.webp" }),
  "product-kayaks": asset({ id: "product-kayaks", title: "Kayaks", alt: "Two kayakers paddling past steaming cliffs on a blue lake", kind: "image", src: "/media/product-kayaks.webp" }),
  "product-steaming-cliff": asset({ id: "product-steaming-cliff", title: "Steaming cliff", alt: "Steam rising from a bush-covered cliff above water", kind: "image", src: "/media/product-steaming-cliff.webp" }),
  "product-water-ripples": asset({ id: "product-water-ripples", title: "Ripples", alt: "Golden light on rippling water", kind: "image", src: "/media/product-water-ripples.webp" }),
  "product-steaming-shore": asset({ id: "product-steaming-shore", title: "Steaming shore", alt: "Steam drifting along a lakeshore at dusk", kind: "image", src: "/media/product-steaming-shore.webp" }),
  "product-lake-sunset": asset({ id: "product-lake-sunset", title: "Lake sunset", alt: "Sun setting behind hills across a calm lake", kind: "image", src: "/media/product-lake-sunset.webp" }),
  "product-kapa-haka": asset({ id: "product-kapa-haka", title: "Kapa haka", alt: "Group performing kapa haka in traditional dress among steam", kind: "image", src: "/media/product-kapa-haka.webp" }),
  "product-steam-gazer": asset({ id: "product-steam-gazer", title: "Watching the steam", alt: "Woman in a cap looking out over geothermal steam", kind: "image", src: "/media/product-steam-gazer.webp" }),
  "product-guide-portrait": asset({ id: "product-guide-portrait", title: "Guide portrait", alt: "Māori guide with tā moko in golden light", kind: "image", src: "/media/product-guide-portrait.webp" }),
  "product-workshop-hands": asset({ id: "product-workshop-hands", title: "Workshop", alt: "Hands working at a machine in a dim workshop", kind: "image", src: "/media/product-workshop-hands.webp" }),
  "product-rider-steam": asset({ id: "product-rider-steam", title: "Rider in the steam", alt: "Mountain biker on a boardwalk wrapped in steam", kind: "image", src: "/media/product-rider-steam.webp" }),
  "product-dessert": asset({ id: "product-dessert", title: "Dessert service", alt: "Plated dessert being served with a glass of bubbles", kind: "image", src: "/media/product-dessert.webp" }),
  "product-hangi-steam": asset({ id: "product-hangi-steam", title: "Steam cooking", alt: "Cook lifting the lid of a steam box over a geothermal vent", kind: "image", src: "/media/product-hangi-steam.webp" }),
  "about-phone-edit": asset({ id: "about-phone-edit", title: "Editing on a phone", alt: "Phone showing a video editing timeline", kind: "image", src: "/media/about-phone-edit.webp" }),
  "about-laptop-camera": asset({ id: "about-laptop-camera", title: "Laptop and camera", alt: "Laptop with an editing app open beside a mirrorless camera", kind: "image", src: "/media/about-laptop-camera.webp" }),
  "about-timeline": asset({ id: "about-timeline", title: "Editing timeline", alt: "Laptop screen with a colourful video editing timeline", kind: "image", src: "/media/about-timeline.webp" }),
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
