import { NextResponse, type NextRequest } from "next/server";
import { designReviewEnabled } from "@/lib/env";

/*
  Hides the design review pages and the app routes in production unless
  REELDEAL_DESIGN_REVIEW=1. The app routes only show sample data until auth
  exists (Phase 3), so they must not be public.
*/
export function proxy(request: NextRequest) {
  if (designReviewEnabled) return NextResponse.next();
  return NextResponse.rewrite(new URL("/_not-available", request.url));
}

export const config = {
  matcher: [
    "/design-system/:path*",
    "/dashboard/:path*",
    "/autopilot/:path*",
    "/studio/:path*",
    "/settings/:path*",
  ],
};
