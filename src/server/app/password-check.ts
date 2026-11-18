import "server-only";
import { createClient } from "@supabase/supabase-js";
import { publicEnv } from "@/env/public";

/**
 * Is this the account's current password? A separate Supabase client that keeps nothing
 * (no cookies, no storage, no refresh) signs in once; the temporary session is revoked
 * immediately, so it never becomes a usable session.
 */
export async function verifyCurrentPassword(email: string, password: string): Promise<"ok" | "wrong" | "limited" | "unavailable"> {
  if (!email || !publicEnv.NEXT_PUBLIC_SUPABASE_URL || !publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY) return "unavailable";
  const probe = createClient(publicEnv.NEXT_PUBLIC_SUPABASE_URL, publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { data, error } = await probe.auth.signInWithPassword({ email, password });
  if (error) {
    if (error.code === "invalid_credentials" || error.status === 400) return "wrong";
    if (error.status === 429 || error.code?.startsWith("over_")) return "limited";
    return "unavailable";
  }
  if (data.session) await probe.auth.signOut({ scope: "local" }).catch(() => {});
  return "ok";
}
