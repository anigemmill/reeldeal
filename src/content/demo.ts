/*
  Book-a-demo copy (design/website/W-Demo.dc.html). Booking happens on Cal.com
  (owner, 2026-11-21): the page links out to the real calendar instead of the
  design's in-page form, so availability and confirmations are Cal.com's own.
*/

export const DEMO_BOOKING_URL = "https://cal.com/ani-gemmill-yg4gmo";

export const DEMO_EMAIL = "anigemmill@theoutsidein.nz";

export const DEMO_STEPS = [
  "Pick a time that suits you in our calendar.",
  "Cal.com emails you a confirmation and a calendar invite.",
  "Send us a few clips before the call, if you have them.",
] as const;

export const DEMO_POINTS = [
  { text: "A walkthrough of Autopilot and Studio", dot: "bg-ai" },
  { text: "Your brand profile set up on the call", dot: "bg-primary" },
  { text: "Plan advice for agencies and multi-site teams", dot: "bg-link" },
] as const;
