import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { safeNextPath } from "@/lib/safe-redirect";
import { supabaseServer } from "@/server/app/supabase";

/*
  Landing point for links emailed by Supabase Auth. Exchanges the one-time code (PKCE)
  or token hash for a session cookie, then sends the person to the right screen for the
  flow. Redirects are always built on this request's own origin, and `next` must be a
  path on this site (src/lib/safe-redirect.ts).

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

function flowOf(url: URL, type: EmailOtpType | null, next: string): Flow {
  const f = url.searchParams.get("flow");
  if (f === "signup" || f === "recovery" || f === "email_change") return f;
  if (type === "signup" || type === "email") return "signup";
  if (type === "recovery" || next === "/reset-password") return "recovery";
  if (type === "email_change") return "email_change";
  if (next === "/onboarding") return "signup"; // links sent before flows existed
  return "other";
}

export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const next = safeNextPath(url.searchParams.get("next"));
  const to = (path: string) => NextResponse.redirect(new URL(path, url.origin));

  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const typeParam = url.searchParams.get("type");
  const type = OTP_TYPES.find((t) => t === typeParam) ?? null;
  const flow = flowOf(url, type, next);

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
  if (flow === "email_change" && !code && !tokenHash && url.searchParams.get("message")) return to("/settings/account?email=one_confirmed");

  const { data } = await supabase.auth.getUser().catch(() => ({ data: { user: null } }));
  const user = data.user;
  if (flow === "signup") return to(user?.email_confirmed_at ? "/onboarding?verified=already" : "/verify-email?link=invalid");
  if (flow === "recovery") return to("/reset-password");
  if (flow === "email_change") return to(user ? "/settings/account?email=link_invalid" : "/sign-in?expired=1&next=/settings/account");
  return to("/sign-in?expired=1");
}
