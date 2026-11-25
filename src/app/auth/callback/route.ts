import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { safeNextPath } from "@/lib/safe-redirect";
import { supabaseServer } from "@/server/app/supabase";
import { withBasePath } from "@/lib/base-path";
import { publicEnv } from "@/env/public";

/*
  Landing point for links emailed by Supabase Auth. Exchanges the one-time code (PKCE)
  or token hash for a session cookie, then sends the person to the right screen for the
  flow. Redirects are always built on this request's own origin, and `next` must be a
  path on this site (src/lib/safe-redirect.ts).

  Link scanners: work email (Microsoft 365 Safe Links and similar) opens every link in an
  incoming email to check it. Token-hash links are single use, so a GET that verified them
  let the scanner use up the link before the person tapped it ("link expired"). A GET with a
  token hash therefore only shows /confirm-link, whose button POSTs back here; only that POST
  verifies. PKCE codes still verify on GET: they need the code-verifier cookie of the browser
  that asked, which a scanner doesn't have.

  flow (set by our own emailRedirectTo, or inferred from `type` for token-hash links):
    signup        ok → /onboarding?verified=1
                  failed, but already confirmed and signed in → /onboarding?verified=already
                  failed → /verify-email?link=invalid (expired or used; offers a new link)
    recovery      ok → /reset-password; failed → /reset-password (shows "expired")
    email_change  ok → /settings/account?email=confirmed
                  one of two addresses confirmed (Supabase sends a message, no code) → ?email=one_confirmed
                  failed → /settings/account?email=link_invalid (or sign-in when signed out)
*/
const OTP_TYPES: readonly EmailOtpType[] = ["signup", "invite", "magiclink", "recovery", "email_change", "email"];
type Flow = "signup" | "recovery" | "email_change" | "other";

function flowOf(params: URLSearchParams, type: EmailOtpType | null, next: string): Flow {
  const f = params.get("flow");
  if (f === "signup" || f === "recovery" || f === "email_change") return f;
  if (type === "signup" || type === "email") return "signup";
  if (type === "recovery" || next === "/reset-password") return "recovery";
  if (type === "email_change") return "email_change";
  if (next === "/onboarding") return "signup"; // links sent before flows existed
  return "other";
}

export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const params = url.searchParams;
  const tokenHash = params.get("token_hash");
  const type = OTP_TYPES.find((t) => t === params.get("type")) ?? null;
  if (tokenHash && type && !params.get("code")) {
    // Don't use the one-time token on a GET (see above): ask the person to press Confirm.
    const confirm = new URL(withBasePath("/confirm-link"), url.origin);
    confirm.searchParams.set("token_hash", tokenHash);
    confirm.searchParams.set("type", type);
    confirm.searchParams.set("flow", flowOf(params, type, safeNextPath(params.get("next"))));
    const next = params.get("next");
    if (next) confirm.searchParams.set("next", safeNextPath(next));
    return NextResponse.redirect(confirm);
  }
  return handle(request, params, 307);
}

/** The Confirm button on /confirm-link. A plain form post, so it works without JavaScript. */
export async function POST(request: NextRequest) {
  if (!sameSite(request)) return new NextResponse("Forbidden", { status: 403 });
  const form = await request.formData().catch(() => null);
  const params = new URLSearchParams();
  for (const key of ["token_hash", "type", "flow", "next"]) {
    const value = form?.get(key);
    if (typeof value === "string" && value) params.set(key, value);
  }
  // 303: the browser follows with a GET, so a refresh never posts the token again.
  return handle(request, params, 303);
}

/*
  Login-CSRF guard: the post must come from this site's own pages. Requests arrive either
  directly or through the main site's proxy (NEXT_PUBLIC_SITE_URL), so both origins count.
  Browsers always send Origin on a form POST; a request without one is allowed (very old browsers).
*/
function sameSite(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  const allowed = [request.nextUrl.origin];
  if (publicEnv.NEXT_PUBLIC_SITE_URL) allowed.push(new URL(publicEnv.NEXT_PUBLIC_SITE_URL).origin);
  return allowed.includes(origin);
}

async function handle(request: NextRequest, params: URLSearchParams, status: 303 | 307) {
  const url = request.nextUrl;
  const next = safeNextPath(params.get("next"));
  const to = (path: string) => NextResponse.redirect(new URL(withBasePath(path), url.origin), status);

  const code = params.get("code");
  const tokenHash = params.get("token_hash");
  const typeParam = params.get("type");
  const type = OTP_TYPES.find((t) => t === typeParam) ?? null;
  const flow = flowOf(params, type, next);

  const supabase = await supabaseServer();
  const { error } = code
    ? await supabase.auth.exchangeCodeForSession(code)
    : tokenHash && type
      ? await supabase.auth.verifyOtp({ type, token_hash: tokenHash })
      : { error: new Error("missing code") };

  if (!error) {
    if (flow === "signup") return to("/onboarding?verified=1");
    if (flow === "recovery") return to("/reset-password");
    if (flow === "email_change") {
      // Secure email change: until both addresses are confirmed the user still has a pending new_email.
      const { data } = await supabase.auth.getUser().catch(() => ({ data: { user: null } }));
      return to(data.user?.new_email ? "/settings/account?email=one_confirmed" : "/settings/account?email=confirmed");
    }
    return to(next);
  }

  // Secure email change: the first of the two links returns a message and no code.
  if (flow === "email_change" && !code && !tokenHash && params.get("message")) return to("/settings/account?email=one_confirmed");

  const { data } = await supabase.auth.getUser().catch(() => ({ data: { user: null } }));
  const user = data.user;
  if (flow === "signup") return to(user?.email_confirmed_at ? "/onboarding?verified=already" : "/verify-email?link=invalid");
  if (flow === "recovery") return to("/reset-password");
  if (flow === "email_change") return to(user ? "/settings/account?email=link_invalid" : "/sign-in?expired=1&next=/settings/account");
  return to("/sign-in?expired=1");
}
