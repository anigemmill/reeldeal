import { publicEnv } from "@/env/public";

/*
  The sub-path the site is served under (NEXT_PUBLIC_BASE_PATH, e.g. "/reeldeal"), or "".
  Next.js adds it to <Link>, redirect() and router navigation by itself. Use withBasePath()
  only where a URL is built by hand: NextResponse.redirect/rewrite, new URL(...), and plain
  <img>/<video> sources for files in /public.
*/
export const BASE_PATH = publicEnv.NEXT_PUBLIC_BASE_PATH ?? "";

/** Prefixes a site-relative path ("/sign-in") with the base path. Other URLs pass through. */
export function withBasePath(path: string): string {
  return path.startsWith("/") && !path.startsWith("//") ? `${BASE_PATH}${path}` : path;
}
