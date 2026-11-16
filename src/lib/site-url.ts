import "server-only";
import { publicEnv } from "@/env/public";
import { serverEnv } from "@/env/server";

/*
  The public website's absolute origin, for sitemap.xml, robots.txt and metadata.
  NEXT_PUBLIC_SITE_URL wins; on Vercel the project's production domain is used;
  locally it falls back to http://localhost:3000.
*/
export function siteUrl(): string {
  const configured = publicEnv.NEXT_PUBLIC_SITE_URL;
  if (configured) return configured.replace(/\/$/, "");
  const vercel = serverEnv.VERCEL_PROJECT_PRODUCTION_URL;
  if (vercel) return `https://${vercel}`;
  return "http://localhost:3000";
}
