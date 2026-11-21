import type { MetadataRoute } from "next";
import { BASE_PATH } from "@/lib/base-path";
import { siteUrl } from "@/lib/site-url";

/*
  Crawl the public website; keep the signed-in app, auth flows, the design review
  and APIs out of search. Preview deployments are behind Vercel Authentication.
  Under a base path (theoutsidein.nz/reeldeal) crawlers only read the domain's own
  /robots.txt, which belongs to the main site: copy these rules and the sitemap line there.
*/
const PRIVATE = [
  "/dashboard",
  "/library",
  "/projects",
  "/brands",
  "/exports",
  "/settings",
  "/studio",
  "/autopilot",
  "/onboarding",
  "/sign-in",
  "/sign-up",
  "/forgot-password",
  "/reset-password",
  "/auth/",
  "/api/",
  "/design-system",
];

export default function robots(): MetadataRoute.Robots {
  const base = siteUrl();
  return { rules: [{ userAgent: "*", allow: `${BASE_PATH}/`, disallow: PRIVATE.map((p) => `${BASE_PATH}${p}`) }], sitemap: `${base}/sitemap.xml` };
}
