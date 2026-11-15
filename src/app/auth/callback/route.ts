import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { supabaseServer } from "@/server/app/supabase";

/*
  Landing point for links emailed by Supabase Auth (sign-up confirmation, password
  reset). Exchanges the one-time code for a session cookie, then continues to `next`.
*/
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const nextParam = url.searchParams.get("next") ?? "/dashboard";
  const next = nextParam.startsWith("/") && !nextParam.startsWith("//") ? nextParam : "/dashboard";
  const supabase = await supabaseServer();
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;
  const { error } = code
    ? await supabase.auth.exchangeCodeForSession(code)
    : tokenHash && type
      ? await supabase.auth.verifyOtp({ type, token_hash: tokenHash })
      : { error: new Error("missing code") };
  if (error) return NextResponse.redirect(new URL(next === "/reset-password" ? "/reset-password" : "/sign-in?expired=1", url));
  return NextResponse.redirect(new URL(next, url));
}
