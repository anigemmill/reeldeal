import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site-url";

/*
  Crawl the public website; keep the signed-in app, auth flows, the design review
  and APIs out of search. Preview deployments are behind Vercel Authentication.
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
  return { rules: [{ userAgent: "*", allow: "/", disallow: PRIVATE }], sitemap: `${base}/sitemap.xml` };
}
