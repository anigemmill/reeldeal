import type { MediaId } from "@/content/media";

/*
  SAMPLE DATA for the Phase 1 dashboard design. Replaced by the organisation's
  projects, media records and render jobs in Phase 3 and 4. Shapes follow what
  those records will need, so screens keep working when real data arrives.
*/

export type ProjectStatus = "draft" | "review" | "rendering" | "ready";

export type SampleProject = {
  id: string;
  title: string;
  media: MediaId;
  format: string;
  ratio: "9:16" | "1:1" | "16:9" | "4:5";
  duration: string;
  status: ProjectStatus;
  progress?: number;
  updated: string;
  via: "Autopilot" | "Studio";
};

export const SAMPLE_PROJECTS: SampleProject[] = [
  { id: "p1", title: "Summer at the lodge", media: "lake-kayak", format: "Reel", ratio: "9:16", duration: "0:30", status: "review", updated: "2 hours ago", via: "Autopilot" },
  { id: "p2", title: "Sunset cruise teaser", media: "coast-sail", format: "Story", ratio: "9:16", duration: "0:15", status: "rendering", progress: 62, updated: "Rendering now", via: "Studio" },
  { id: "p3", title: "Ridge walk at dawn", media: "alpine-sunrise", format: "Website", ratio: "16:9", duration: "0:45", status: "draft", updated: "Yesterday", via: "Studio" },
  { id: "p4", title: "Stargazing package", media: "lodge-night", format: "Ad", ratio: "4:5", duration: "0:20", status: "ready", updated: "Mon", via: "Autopilot" },
  { id: "p5", title: "Hot pools weekend", media: "geo-valley", format: "Reel", ratio: "9:16", duration: "0:24", status: "ready", updated: "Last week", via: "Autopilot" },
];

export const SAMPLE_PROCESSING: { id: string; name: string; media: MediaId; stage: "uploading" | "analysing"; progress: number; detail: string }[] = [
  { id: "f1", name: "DJI_0412.MP4", media: "beach-turquoise", stage: "uploading", progress: 64, detail: "1.2 of 1.9 GB" },
  { id: "f2", name: "kayak-morning-02.mov", media: "lake-kayak", stage: "analysing", progress: 38, detail: "Finding scenes and best moments" },
];

export const SAMPLE_LIBRARY = { clips: 128, hoursAnalysed: 6.5, newClips: 23 };

export const SAMPLE_BEST_MOMENTS: { id: string; media: MediaId; label: string; score: number }[] = [
  { id: "m1", media: "lake-kayak", label: "Paddle stroke, mirror water", score: 96 },
  { id: "m2", media: "vineyard-gold", label: "Golden hour over the vines", score: 93 },
  { id: "m3", media: "harbour-blue", label: "Jetty lights at dusk", score: 91 },
  { id: "m4", media: "forest-ride", label: "Rider through light rays", score: 88 },
];

export const SAMPLE_EXPORTS: { id: string; title: string; media: MediaId; formats: string[]; when: string; status: "delivered" | "failed-free-retry" }[] = [
  { id: "e1", title: "Stargazing package", media: "lodge-night", formats: ["4:5", "9:16"], when: "Mon 4:12 pm", status: "delivered" },
  { id: "e2", title: "Hot pools weekend", media: "geo-valley", formats: ["9:16"], when: "Last week", status: "delivered" },
  { id: "e3", title: "Autumn offer", media: "vineyard-gold", formats: ["16:9"], when: "Last week", status: "failed-free-retry" },
];

export const BRIEF_SUGGESTIONS = ["30s reel for summer bookings", "Weekend specials story", "Meet our guides", "Sunset cruise teaser"];
