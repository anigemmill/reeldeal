import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site-url";

/* Public website pages (docs/sitemap.md). App, review and auth routes are not listed. */
const PAGES: { path: string; priority: number }[] = [
  { path: "/", priority: 1 },
  { path: "/product", priority: 0.9 },
  { path: "/pricing", priority: 0.9 },
  { path: "/solutions/tourism", priority: 0.8 },
  { path: "/showcase", priority: 0.7 },
  { path: "/about", priority: 0.6 },
  { path: "/demo", priority: 0.6 },
];

export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl();
  return PAGES.map(({ path, priority }) => ({ url: `${base}${path === "/" ? "" : path}`, changeFrequency: "monthly", priority }));
}
