/* Example briefs shown under the Autopilot prompt, by industry. Suggestions only: nothing is generated until the customer submits. */
const BY_INDUSTRY: Record<string, string[]> = {
  Accommodation: ["15s reel for summer weekend bookings", "Show our rooms and the morning view", "Midweek winter escape offer"],
  "Tours and activities": ["30s highlight of our most popular tour", "First-timer's guide to the experience", "Behind the scenes with our guides"],
  "Food and drink": ["15s reel of our signature dish", "Brunch weekend promo", "Meet the team in the kitchen"],
  "Attractions and venues": ["What to expect on your visit", "School holidays family reel", "Evening event highlights"],
  Events: ["Event announcement teaser", "Last year's highlights in 30s", "Tickets on sale now reel"],
};
const DEFAULT = ["15s reel for this month's offer", "Introduce our business in 30s", "Customer favourite moments"];

export const briefSuggestions = (industry: string | null | undefined) => BY_INDUSTRY[industry ?? ""] ?? DEFAULT;
