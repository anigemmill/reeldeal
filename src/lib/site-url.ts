import "server-only";
import { publicEnv } from "@/env/public";
import { serverEnv } from "@/env/server";
import { BASE_PATH } from "@/lib/base-path";

/*
  The public website's absolute URL, including the base path, for sitemap.xml, robots.txt,
  metadata and email links. NEXT_PUBLIC_SITE_URL wins (give it the full URL, base path
  included); on Vercel the project's production domain is used; locally it falls back to
  http://localhost:3000. The fallbacks add NEXT_PUBLIC_BASE_PATH.
*/
export function siteUrl(): string {
  const configured = publicEnv.NEXT_PUBLIC_SITE_URL;
  if (configured) return configured.replace(/\/$/, "");
  const vercel = serverEnv.VERCEL_PROJECT_PRODUCTION_URL;
  if (vercel) return `https://${vercel}${BASE_PATH}`;
  return `http://localhost:3000${BASE_PATH}`;
}
