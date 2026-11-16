import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { safeNextPath } from "@/lib/safe-redirect";
import { supabaseServer } from "@/server/app/supabase";

/*
  Landing point for links emailed by Supabase Auth (sign-up confirmation, password
  reset, email change). Exchanges the one-time code for a session cookie, then
  continues to `next`, which must be a path on this site (src/lib/safe-redirect.ts).
  Redirects are always built on this request's own origin.
*/
const OTP_TYPES: readonly EmailOtpType[] = ["signup", "invite", "magiclink", "recovery", "email_change", "email"];

export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const next = safeNextPath(url.searchParams.get("next"));
  const to = (path: string) => NextResponse.redirect(new URL(path, url.origin));

  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const typeParam = url.searchParams.get("type");
  const type = OTP_TYPES.find((t) => t === typeParam) ?? null;

  const supabase = await supabaseServer();
  const { error } = code
    ? await supabase.auth.exchangeCodeForSession(code)
    : tokenHash && type
      ? await supabase.auth.verifyOtp({ type, token_hash: tokenHash })
      : { error: new Error("missing code") };
  if (error) return to(next === "/reset-password" ? "/reset-password" : "/sign-in?expired=1");
  return to(next);
}
