import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { designReviewEnabled } from "@/env/flags";
import { publicEnv } from "@/env/public";

/*
  Runs before every page request:
  - Refreshes the Supabase Auth session (rotating cookies) so server components see
    a valid session, as @supabase/ssr recommends.
  - Protects the app: signed-out visitors are sent to /sign-in (with ?expired=1 when
    an old session cookie was present), signed-in users skip the sign-in pages, and
    signed-in users whose email isn't confirmed yet are sent to /verify-email.
  - Hides the design review pages in production unless REELDEAL_DESIGN_REVIEW=1.
  Pages still verify the user themselves (src/server/app/session.ts); this is not the
  only check.
*/
export const APP_PREFIXES = ["/dashboard", "/autopilot", "/studio", "/settings", "/library", "/brands", "/projects", "/exports", "/onboarding"];
const AUTH_PAGES = ["/sign-in", "/sign-up"];

const matches = (path: string, prefixes: string[]) => prefixes.some((p) => path === p || path.startsWith(`${p}/`));

export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  if (path.startsWith("/design-system")) {
    return designReviewEnabled ? NextResponse.next() : NextResponse.rewrite(new URL("/_not-available", request.url));
  }

  const isApp = matches(path, APP_PREFIXES);
  const url = publicEnv.NEXT_PUBLIC_SUPABASE_URL;
  const key = publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    // No auth configured on this server: the app cannot be used (the sign-in page explains why).
    return isApp ? NextResponse.redirect(new URL("/sign-in", request.url)) : NextResponse.next();
  }

  let response = NextResponse.next({ request });
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list) => {
        for (const { name, value } of list) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of list) response.cookies.set(name, value, options);
      },
    },
  });
  const { data } = await supabase.auth.getUser().catch(() => ({ data: { user: null } }));
  const user = data.user;

  if (!user && isApp) {
    const to = new URL("/sign-in", request.url);
    to.searchParams.set("next", path + request.nextUrl.search);
    if (request.cookies.getAll().some((c) => c.name.startsWith("sb-") && c.name.includes("auth-token"))) to.searchParams.set("expired", "1");
    return NextResponse.redirect(to);
  }
  // Email confirmation is required before onboarding or any app page (D10). Pages and
  // actions check it again (src/server/app/session.ts); this only routes people.
  const verified = Boolean(user?.email_confirmed_at);
  if (user && !verified && isApp) return NextResponse.redirect(new URL("/verify-email", request.url));
  if (user && verified && path === "/verify-email") return NextResponse.redirect(new URL("/onboarding", request.url));
  if (user && matches(path, AUTH_PAGES)) return NextResponse.redirect(new URL(verified ? "/dashboard" : "/verify-email", request.url));
  return response;
}

export const config = {
  matcher: ["/((?!_next/|api/|\\.well-known/|favicon|.*\\.(?:png|jpg|jpeg|svg|webp|ico|txt|xml|woff2?)$).*)"],
};
