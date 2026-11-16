/*
  Book-a-demo copy (design/website/W-Demo.dc.html). Bracketed values are still
  needed from the owner. The time slots are SAMPLE times only: no booking
  provider is connected, so they are not real availability.
*/

export const DEMO_EMAIL = "[hello@yourdomain]";

export const DEMO_POINTS = [
  { text: "A walkthrough of Autopilot and Studio", dot: "bg-ai" },
  { text: "Your brand profile set up on the call", dot: "bg-primary" },
  { text: "Plan advice for agencies and multi-site teams", dot: "bg-link" },
] as const;

export const DEMO_INDUSTRIES = [
  "Tours and activities",
  "Accommodation",
  "Attractions",
  "Hospitality",
  "Destination or RTO",
  "Agency",
  "Other",
] as const;

export const DEMO_TEAM_SIZES = ["Just me", "2–10", "11–50", "50+", "Agency"] as const;

/** Sample slots shown until a booking provider supplies real availability. */
export const DEMO_SAMPLE_SLOTS = [
  { day: "MON", time: "10:00" },
  { day: "MON", time: "14:30" },
  { day: "TUE", time: "09:00" },
  { day: "WED", time: "11:00" },
  { day: "WED", time: "15:00" },
  { day: "THU", time: "10:30" },
] as const;
