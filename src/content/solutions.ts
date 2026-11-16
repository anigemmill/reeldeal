import type { MediaId } from "./media";

/*
  INDUSTRY SOLUTION PAGES (design/website/W-Solutions.dc.html).
  Tourism is the first. The page component renders any `IndustrySolution`, so a
  new industry (e.g. /solutions/agencies) is a new entry here plus a route file.
  Business names in examples are invented sample data (docs/decisions.md).
*/

export type SolutionSegment = {
  id: string;
  label: string;
  media: MediaId;
  description: string;
  /** Videos this kind of business makes most: title and format/length. */
  videos: { title: string; format: string }[];
};

export type SolutionSeason = {
  when: string;
  title: string;
  media: MediaId;
  prompt: string;
  /** Card treatment, mapped to semantic tokens by the page. */
  tone: "tint" | "muted" | "primary" | "dark";
};

export type IndustrySolution = {
  slug: string;
  eyebrow: string;
  title: { lead: string; accent: string };
  lead: string;
  assurances: string[];
  hero: {
    media: MediaId;
    thumbs: MediaId[];
    /** Sample "ready" card on the hero image. */
    sample: { business: string; summary: string };
  };
  segments: SolutionSegment[];
  seasons: { title: { lead: string; accent: string }; lead: string; items: SolutionSeason[] };
  reasons: { title: { lead: string; accent: string }; items: { title: string; text: string }[] };
  agency: { title: string; text: string; cta: string };
};

export const TOURISM: IndustrySolution = {
  slug: "tourism",
  eyebrow: "Solutions · Tourism and hospitality",
  title: { lead: "Tourism runs on video.", accent: "Now you can keep up." },
  lead: "Your guides, staff and guests already film the best bits. Turn that footage into a steady stream of on-brand reels, ads and website videos.",
  assurances: ["Works from a phone", "Your footage stays yours", "Built for small teams"],
  hero: {
    media: "alpine-sunrise",
    thumbs: ["lake-kayak", "forest-ride", "geo-valley"],
    sample: { business: "Ridge Walks", summary: "3 options from 46 clips, for “Spring sunrise tours, book now”." },
  },
  segments: [
    {
      id: "tours",
      label: "Tours and activities",
      media: "forest-ride",
      description: "Every tour is a new shoot. Turn guide footage into reels the same day.",
      videos: [
        { title: "Today on the trail", format: "9:16 · 20s" },
        { title: "Meet your guides", format: "4:5 · 30s" },
        { title: "Book the morning tour", format: "9:16 · 15s" },
      ],
    },
    {
      id: "accommodation",
      label: "Accommodation",
      media: "lake-kayak",
      description: "Rooms, views and the little touches. Keep your listing and socials fresh.",
      videos: [
        { title: "Wake up to this", format: "9:16 · 15s" },
        { title: "Room tour", format: "16:9 · 45s" },
        { title: "Midweek escape offer", format: "1:1 · 20s" },
      ],
    },
    {
      id: "attractions",
      label: "Attractions",
      media: "geo-valley",
      description: "Big moments that sell themselves, cut for every channel and season.",
      videos: [
        { title: "What to expect on your visit", format: "16:9 · 60s" },
        { title: "School holiday programme", format: "9:16 · 20s" },
        { title: "Night experience teaser", format: "9:16 · 15s" },
      ],
    },
    {
      id: "hospitality",
      label: "Hospitality",
      media: "lodge-night",
      description: "Menus, events and atmosphere, posted while it is still this week’s news.",
      videos: [
        { title: "New season menu", format: "4:5 · 20s" },
        { title: "Friday night set", format: "9:16 · 15s" },
        { title: "Private dining", format: "16:9 · 30s" },
      ],
    },
    {
      id: "destinations",
      label: "Destinations",
      media: "coast-sail",
      description: "Many operators, one story. Pool partner footage into campaign-ready edits.",
      videos: [
        { title: "Summer in the region", format: "16:9 · 60s" },
        { title: "48 hours itinerary", format: "9:16 · 30s" },
        { title: "Partner spotlight", format: "1:1 · 20s" },
      ],
    },
  ],
  seasons: {
    title: { lead: "Content for every season,", accent: "from one shoot." },
    lead: "Re-cut the same library for each campaign instead of reshooting.",
    items: [
      { when: "Peak season", title: "Launch and fill", media: "coast-sail", prompt: "Summer is here, book your spot", tone: "tint" },
      { when: "Shoulder", title: "Deals and quieter days", media: "alpine-sunrise", prompt: "Midweek special, 20% off", tone: "muted" },
      { when: "Winter", title: "Cosy escapes", media: "geo-valley", prompt: "Hot pools on a cold night", tone: "primary" },
      { when: "Events", title: "Holidays and one-offs", media: "lodge-night", prompt: "New Year’s Eve at the lodge", tone: "dark" },
    ],
  },
  reasons: {
    title: { lead: "Made for how operators", accent: "actually work." },
    items: [
      { title: "Phone first", text: "Autopilot runs on a phone, between guests, with no editing knowledge." },
      { title: "Your footage stays yours", text: "Clips and exports belong to you. Nothing is shared without your say." },
      { title: "On brand, every time", text: "Set your look once. Staff can make videos without going off brand." },
      { title: "Ready for every channel", text: "Socials, booking sites, your website and screens in reception." },
    ],
  },
  agency: {
    title: "Running content for several operators?",
    text: "RTOs, agencies and multi-site groups get one workspace per client, approvals and shared templates.",
    cta: "Talk to us about Agency",
  },
};
