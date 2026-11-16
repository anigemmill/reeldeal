import { randomBytes } from "node:crypto";
import { z } from "zod";
import type { Principal, MemberRole } from "../auth/principal";
import { SCOPES } from "../auth/principal";
import type { Ctx, Platform } from "../context";
import { AppError, parseInput } from "../errors";
import { createBrand } from "./brands";
import { ensureGrant } from "./usage";

/*
  Accounts and workspaces for the customer web app. The user's identity always
  comes from a verified Supabase Auth session (src/server/app/session.ts); this
  module only turns that identity into a Principal using their real memberships,
  and creates a workspace for a signed-in user who has none yet.
*/

export type Membership = { org_id: string; name: string; role: MemberRole };

/** The signed-in user's memberships (trusted lookup by verified user id). */
export async function listMemberships(p: Platform, userId: string): Promise<Membership[]> {
  return p.db.asUser(userId, (sql) =>
    sql.query<Membership>(
      "select m.org_id, o.name, m.role from public.memberships m join public.organisations o on o.id = m.org_id where m.user_id = $1 order by m.created_at",
      [userId],
    ),
  );
}

/**
 * Principal for a web session. The organisation is the one the user chose (a cookie)
 * only if they are a member of it; otherwise their first workspace. Null if they have none.
 * A browser session may use every capability its role allows; billable work still
 * needs an explicit, quoted confirmation in the service layer.
 */
export async function principalForSession(p: Platform, userId: string, preferredOrgId?: string | null): Promise<{ principal: Principal; memberships: Membership[] } | null> {
  const memberships = await listMemberships(p, userId);
  const m = memberships.find((x) => x.org_id === preferredOrgId) ?? memberships[0];
  if (!m) return null;
  return { principal: { userId, orgId: m.org_id, role: m.role, scopes: [...SCOPES], via: "session" }, memberships };
}

export const INDUSTRIES = [
  "Accommodation",
  "Tours and activities",
  "Food and drink",
  "Attractions and venues",
  "Events",
  "Transport",
  "Retail",
  "Professional services",
  "Other",
] as const;

export const WorkspaceInput = z.object({
  business_name: z.string().trim().min(2, "Enter your business name").max(120),
  industry: z.enum(INDUSTRIES, { message: "Choose an industry" }),
  website: z
    .string()
    .trim()
    .max(300)
    .transform((v) => (v && !/^https?:\/\//i.test(v) ? `https://${v}` : v))
    .pipe(z.union([z.literal(""), z.url({ message: "Enter a valid website address", protocol: /^https?$/ })]))
    .optional(),
  display_name: z.string().trim().min(1).max(120).optional(),
});
export type WorkspaceInput = z.input<typeof WorkspaceInput>;

const MAX_OWNED_WORKSPACES = 5;

/**
 * Create a workspace (organisation) for a signed-in user, make them its owner and
 * create its first brand profile from the same details. New workspaces start on the
 * Free plan from config/pricing.json; nothing is billed.
 */
export async function createWorkspace(p: Platform, userId: string, raw: WorkspaceInput) {
  const i = parseInput(WorkspaceInput, raw);
  const orgId = await p.db.system(async (sql) => {
    // Serialise per user so a double submit cannot create two workspaces.
    await sql.query("select pg_advisory_xact_lock(hashtext($1))", [`workspace:${userId}`]);
    const [{ n }] = await sql.query<{ n: number }>("select count(*)::int as n from public.memberships where user_id = $1 and role = 'owner'", [userId]);
    const [same] = await sql.query<{ id: string }>(
      "select o.id from public.organisations o join public.memberships m on m.org_id = o.id where m.user_id = $1 and m.role = 'owner' and o.name = $2 and o.created_at > now() - interval '1 minute'",
      [userId, i.business_name],
    );
    if (same) return same.id; // a repeated submit of the same form
    if (n >= MAX_OWNED_WORKSPACES) throw new AppError("conflict", `You already own ${n} workspaces, the most an account can create.`);
    const slug = `${i.business_name.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "workspace"}-${randomBytes(3).toString("hex")}`;
    const [org] = await sql.query<{ id: string }>("insert into public.organisations (name, slug, plan_id) values ($1, $2, 'free') returning id", [i.business_name, slug]);
    await sql.query("insert into public.memberships (org_id, user_id, role) values ($1, $2, 'owner')", [org.id, userId]);
    await ensureGrant(sql, org.id);
    return org.id;
  }).catch((e: { code?: string }) => {
    // The membership's foreign key to auth.users is the account check: the web app's
    // database role cannot read auth.users (migration 20261117000001).
    if (e?.code === "23503") throw new AppError("unauthenticated", "Your account was not found. Sign in again.");
    throw e;
  });
  if (i.display_name) await saveProfile(p, userId, i.display_name);
  const ctx: Ctx = { ...p, principal: { userId, orgId, role: "owner", scopes: [...SCOPES], via: "session" } };
  const [existingBrand] = await p.db.asUser(userId, (sql) => sql.query<{ id: string }>("select id from public.brand_profiles where org_id = $1 limit 1", [orgId]));
  const brand = existingBrand ?? (await createBrand(ctx, { name: i.business_name, industry: i.industry, website: i.website || undefined }));
  return { org_id: orgId, brand_id: brand.id as string };
}

/** The signed-in user's own profile (RLS: users only ever see their own row). */
export async function getProfile(p: Platform, userId: string) {
  const [row] = await p.db.asUser(userId, (sql) => sql.query<{ display_name: string | null }>("select display_name from public.profiles where user_id = $1", [userId]));
  return { display_name: row?.display_name ?? null };
}

export async function saveProfile(p: Platform, userId: string, displayName: string) {
  const name = parseInput(z.string().trim().min(1).max(120), displayName);
  await p.db.asUser(userId, (sql) =>
    sql.query("insert into public.profiles (user_id, display_name) values ($1, $2) on conflict (user_id) do update set display_name = excluded.display_name", [userId, name]),
  );
}
