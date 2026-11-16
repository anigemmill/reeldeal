import type { MediaId } from "./media";

/*
  About page content (design/website/W-About.dc.html). Anything in [BRACKETS]
  is a fact only the owner can supply: keep it bracketed until they do.
*/
export const ABOUT = {
  gallery: [
    { media: "geo-valley", grow: "sm:flex-[2]" },
    { media: "forest-ride", grow: "sm:flex-1" },
    { media: "coast-sail", grow: "sm:flex-[1.3]" },
  ] satisfies { media: MediaId; grow: string }[],
  problem: "[Founder story: operators sitting on hundreds of great clips, with no time or budget to turn them into content. Replace with the real story.]",
  belief:
    "AI should do the slow, repetitive part of video production. People should keep the parts that need taste: the story, the brand and the final yes.",
  principles: [
    { title: "The footage is the hero", text: "We design around your clips, not around templates or stock." },
    { title: "Simple first, powerful second", text: "Anyone can finish a video in Autopilot. Studio is there when you want it." },
    { title: "You stay in control", text: "AI suggests and builds. You approve. Nothing is published without you." },
    { title: "Your content is yours", text: "Clear ownership, private by default, and easy to take with you." },
  ],
  founder: {
    quote: "[A line from the founder on why this matters to them.]",
    name: "[Founder name]",
    role: "founder",
    photo: "[FOUNDER PHOTO]",
  },
} as const;
