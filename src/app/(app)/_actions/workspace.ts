"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { serverEnv } from "@/env/server";
import { getPlatform } from "@/server/app/platform";
import { ORG_COOKIE, getSessionUser } from "@/server/app/session";
import { listMemberships } from "@/server/services/account";

/** Switch the current workspace: accepted only for workspaces the user is a member of. */
export async function switchWorkspace(form: FormData) {
  const user = await getSessionUser();
  if (!user) return;
  const orgId = String(form.get("org_id") ?? "");
  const memberships = await listMemberships(await getPlatform(), user.id);
  if (!memberships.some((m) => m.org_id === orgId)) return;
  (await cookies()).set(ORG_COOKIE, orgId, { httpOnly: true, sameSite: "lax", path: "/", secure: serverEnv.NODE_ENV === "production", maxAge: 60 * 60 * 24 * 365 });
  revalidatePath("/", "layout");
}
