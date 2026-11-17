import { z } from "zod";
import { getPlan } from "@/lib/pricing";
import { requireRole } from "../auth/principal";
import { asUser, iso, type Ctx, type Platform } from "../context";
import { AppError, fromDbError, parseInput } from "../errors";
import { INDUSTRIES, listMemberships } from "./account";
import { myInvitations } from "./team";

/*
  Settings → Workspace and the onboarding journey (Stage 4/5 backend; needs migration
  20261118000001 for the business-detail and onboarding columns). Screens:
  src/components/app/settings/workspace-screen.tsx, src/components/app/onboarding/onboarding-flow.tsx.
*/

/** Everything the Workspace settings screen shows, for the current workspace. Members can read; admins edit. */
export async function getWorkspaceSettings(ctx: Ctx) {
  return asUser(ctx, async (sql) => {
    const [org] = await sql.query<{
      id: string; name: string; slug: string; plan_id: string; created_at: string; ai_media_analysis_consent: boolean;
      legal_name: string | null; industry: string | null; website: string | null; location: string | null; phone: string | null;
      workspace_kind: "business" | "client"; default_formats: string[];
    }>(
      `select id, name, slug, plan_id, created_at, ai_media_analysis_consent, legal_name, industry, website, location, phone, workspace_kind, default_formats
         from public.organisations where id = $1`,
      [ctx.principal.orgId],
    );
    if (!org) throw new AppError("not_found", "Workspace not available");
    const [owner] = await sql.query<{ email: string; display_name: string | null }>("select email, display_name from private.team_members($1) where role = 'owner'", [org.id]);
    const brands = await sql.query<{ id: string; name: string; version: number; colours: { hex: string }[]; voice: string | null; updated_at: string; logo_media_id: string | null }>(
      "select id, name, version, colours, voice, updated_at, logo_media_id from public.brand_profiles where org_id = $1 order by created_at",
      [org.id],
    );
    const plan = getPlan(org.plan_id);
    return {
      my_role: ctx.principal.role,
      organisation: { ...org, created_at: iso(org.created_at) },
      owner: owner ? { name: owner.display_name ?? owner.email, email: owner.email } : null,
      plan: { id: org.plan_id, name: plan?.name ?? org.plan_id },
      brands: {
        used: brands.length,
        limit: plan?.brandProfiles ?? null,
        default: brands[0] ? { ...brands[0], colours: (brands[0].colours ?? []).map((c) => c.hex), updated_at: iso(brands[0].updated_at) } : null,
      },
      // The live database region is configuration, not data: shown from the environment by the page.
    };
  });
}

const DetailsInput = z
  .object({
    name: z.string().trim().min(2).max(120),
    legal_name: z.string().trim().max(200),
    industry: z.enum(INDUSTRIES),
    website: z
      .string()
      .trim()
      .max(300)
      .transform((v) => (v && !/^https?:\/\//i.test(v) ? `https://${v}` : v))
      .pipe(z.union([z.literal(""), z.url({ protocol: /^https?$/ })])),
    location: z.string().trim().max(120),
    phone: z.string().trim().max(40),
    default_formats: z.array(z.enum(["9:16", "1:1", "16:9", "4:5"])).min(1),
  })
  .partial();

/** Update business details and workspace defaults. Administrators and the owner only (enforced by RLS and grants too). */
export async function updateWorkspaceDetails(ctx: Ctx, raw: z.input<typeof DetailsInput>) {
  requireRole(ctx.principal, "admin");
  const i = parseInput(DetailsInput, raw);
  const empty = (v: string | undefined) => (v === undefined ? undefined : v || null);
  const fields: [string, unknown][] = (
    [
      ["name", i.name],
      ["legal_name", empty(i.legal_name)],
      ["industry", i.industry],
      ["website", empty(i.website)],
      ["location", empty(i.location)],
      ["phone", empty(i.phone)],
      ["default_formats", i.default_formats],
    ] as [string, unknown][]
  ).filter(([, v]) => v !== undefined);
  if (!fields.length) return { updated: false };
  try {
    const rows = await asUser(ctx, (sql) =>
      sql.query(`update public.organisations set ${fields.map(([k], n) => `${k} = $${n + 2}`).join(", ")} where id = $1 returning id`, [ctx.principal.orgId, ...fields.map(([, v]) => v)]),
    );
    if (!rows.length) throw new AppError("forbidden", "Only administrators can change workspace details");
  } catch (e) {
    throw fromDbError(e) ?? e;
  }
  return { updated: true };
}

/* ------------------------------------------------------------- onboarding */

export const ONBOARDING_STEPS = ["business", "brand", "assets", "preferences", "done"] as const;
export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];

/**
 * Where a signed-in, confirmed person is in setup, so a return visit resumes in the right place:
 *   no workspace + invitations  → "invited" (join, or create your own)
 *   no workspace                → "workspace" (create one)
 *   workspace, setup unfinished → the saved step (brand / assets / preferences); the dashboard offers to resume
 *   finished                    → "complete"
 * Only the workspace's owner is asked to finish setup; invited members never see onboarding.
 */
export async function getOnboardingState(p: Platform, userId: string, preferredOrgId?: string | null) {
  const memberships = await listMemberships(p, userId);
  if (!memberships.length) {
    const invitations = await myInvitations(p, userId);
    return { stage: invitations.length ? ("invited" as const) : ("workspace" as const), invitations, workspace: null };
  }
  const m = memberships.find((x) => x.org_id === preferredOrgId) ?? memberships[0]!;
  const [org] = await p.db.asUser(userId, (sql) =>
    sql.query<{ onboarding_step: OnboardingStep | null; onboarding_completed_at: string | null; name: string }>(
      "select name, onboarding_step, onboarding_completed_at from public.organisations where id = $1",
      [m.org_id],
    ),
  );
  const done = Boolean(org?.onboarding_completed_at) || m.role !== "owner";
  return {
    stage: done ? ("complete" as const) : ("setup" as const),
    next_step: done ? null : nextStep(org?.onboarding_step ?? null),
    invitations: [],
    workspace: { id: m.org_id, name: org?.name ?? m.name, role: m.role },
  };
}

const nextStep = (saved: OnboardingStep | null): OnboardingStep => {
  if (!saved) return "brand"; // the workspace and business details exist once the org does
  const i = ONBOARDING_STEPS.indexOf(saved);
  return ONBOARDING_STEPS[Math.min(i + 1, ONBOARDING_STEPS.length - 1)]!;
};

/** Record a finished (or skipped) step. Moving backwards never loses progress; "done" completes setup. Owner only. */
export async function saveOnboardingStep(ctx: Ctx, step: OnboardingStep) {
  const s = parseInput(z.enum(ONBOARDING_STEPS), step);
  requireRole(ctx.principal, "owner");
  const rows = await asUser(ctx, (sql) =>
    sql.query(
      `update public.organisations
          set onboarding_step = case when onboarding_step is null or array_position($3::text[], onboarding_step) < array_position($3::text[], $2) then $2 else onboarding_step end,
              onboarding_completed_at = case when $2 = 'done' then coalesce(onboarding_completed_at, now()) else onboarding_completed_at end
        where id = $1 returning id`,
      [ctx.principal.orgId, s, [...ONBOARDING_STEPS]],
    ),
  );
  if (!rows.length) throw new AppError("forbidden", "Only the workspace owner finishes setup");
  return { saved: s };
}

/** Workspace kind chosen in onboarding ("my business" or "a client"). Set when the workspace is created. */
export async function setWorkspaceKind(ctx: Ctx, kind: "business" | "client") {
  requireRole(ctx.principal, "owner");
  const k = parseInput(z.enum(["business", "client"]), kind);
  // A label only (it changes onboarding wording and the workspace switcher), so admins may set it under RLS.
  const rows = await asUser(ctx, (sql) => sql.query("update public.organisations set workspace_kind = $2 where id = $1 returning id", [ctx.principal.orgId, k]));
  if (!rows.length) throw new AppError("forbidden", "Only the workspace owner can do that");
  return { workspace_kind: k };
}

/** The signed-in person's appearance and notification preferences (defaults until saved). */
export async function getPreferences(p: Platform, userId: string) {
  const [row] = await p.db.asUser(userId, (sql) =>
    sql.query<{ palette: string; mode: string; type: string; email_when_render_ready: boolean }>("select palette, mode, type, email_when_render_ready from public.user_preferences where user_id = $1", [userId]),
  );
  return row ?? { palette: "crossroads", mode: "workspace", type: "a", email_when_render_ready: true };
}

const PrefsInput = z.object({ palette: z.string().regex(/^[a-z0-9]{1,40}$/), mode: z.enum(["workspace", "studio"]), type: z.enum(["a", "b", "c"]), email_when_render_ready: z.boolean() }).partial();

export async function savePreferences(p: Platform, userId: string, raw: z.input<typeof PrefsInput>) {
  const i = parseInput(PrefsInput, raw);
  const cur = await getPreferences(p, userId);
  const next = { ...cur, ...i };
  await p.db.asUser(userId, (sql) =>
    sql.query(
      `insert into public.user_preferences (user_id, palette, mode, type, email_when_render_ready) values ($1, $2, $3, $4, $5)
       on conflict (user_id) do update set palette = excluded.palette, mode = excluded.mode, type = excluded.type, email_when_render_ready = excluded.email_when_render_ready`,
      [userId, next.palette, next.mode, next.type, next.email_when_render_ready],
    ),
  );
  return next;
}
