import type { BillingData } from "@/components/app/settings/billing-screen";
import type { TeamData } from "@/components/app/settings/team-screen";
import type { TokensData } from "@/components/app/settings/tokens-screen";
import type { WorkspaceData } from "@/components/app/settings/workspace-screen";
import type { MyToken } from "../services/access-tokens";
import type { BillingOverview } from "../services/billing";
import type { getTeam } from "../services/team";
import type { getWorkspaceSettings } from "../services/workspace-settings";

/*
  Shapes service results into the Stage 3 screens' props for the REAL pages (no sample data).
  Kept apart from the services so the rule is easy to check: nothing here invents a value.
  Missing billing details become empty values, and the screen shows "not set up yet".
*/
export function toBillingScreenData(o: BillingOverview, history: { at: string | null; wallet: string; kind: string; amount: number; note: string | null }[]): BillingData {
  const v = o.usage.video_credits;
  return {
    mode: "live",
    currency: o.currency,
    plan: {
      id: o.plan.id,
      name: o.plan.name,
      priceMonthly: o.plan.price_monthly,
      priceAnnual: o.plan.price_annual,
      users: o.plan.seats,
      brands: o.plan.brand_profiles,
      storageGB: o.plan.storage_gb,
      analysisMinutes: o.plan.analysis_minutes,
      videoCredits: o.plan.video_credits ?? 0,
    },
    videoCreditsOnce: o.plan.video_credits_period === "once",
    billing: o.billing.available ? { available: true } : { available: false, reason: o.billing.reason },
    interval: o.billing.available && o.billing.interval === "annual" ? "annual" : "monthly",
    status: o.billing.available ? (o.billing.status as BillingData["status"]) : "none",
    currentPeriodStart: (o.billing.available ? o.billing.current_period_start : null) ?? `${o.usage.period}-01T00:00:00Z`,
    renewsAt: o.billing.available ? o.billing.current_period_end : null,
    usage: {
      videoCreditsAvailable: v.available,
      videoCreditsHeld: v.held_for_renders_in_progress,
      videoCreditsUsed: v.used,
      analysisMinutesUsed: o.usage.analysis_minutes.used,
      storageGBUsed: o.usage.storage_gb.used,
      brandsUsed: o.usage.brand_profiles,
      seatsUsed: o.usage.seats,
    },
    // Billing details come from Stripe in the billing stage; until then they are empty, never sample values.
    billingEmail: o.billing.available ? (o.billing.billing_email ?? "") : "",
    billingName: "",
    taxNumber: "",
    address: "",
    paymentMethod: null,
    invoices: [],
    history: history.map((h) => ({ at: h.at ?? "", wallet: h.wallet, kind: h.kind, amount: h.amount, note: h.note ?? "" })),
  };
}

/** Settings → Team. Names fall back to the email address; "Active" is the last sign-in. */
export function toTeamData(t: Awaited<ReturnType<typeof getTeam>>, opts: { emailDelivery: boolean; now: number }): TeamData {
  const nameOf = (id: string | null) => {
    const m = t.members.find((x) => x.user_id === id);
    return m ? (m.display_name ?? m.email) : "a former member";
  };
  return {
    workspace: t.workspace,
    myRole: t.my_role,
    seats: t.seats.limit,
    emailDelivery: opts.emailDelivery,
    now: opts.now,
    members: t.members.map((m) => ({ id: m.user_id, name: m.display_name ?? m.email, email: m.email, role: m.role, joinedAt: m.joined_at ?? "", lastActive: m.last_sign_in_at ?? "", you: m.you })),
    invites: t.invitations.map((i) => ({ id: i.id, email: i.email, role: i.role, invitedBy: nameOf(i.invited_by), sentAt: i.created_at ?? "", expiresAt: i.expires_at ?? "" })),
  };
}

/** Settings → Access tokens. There is never a token value here: it's shown once, from the create action. */
export function toTokensData(tokens: MyToken[], opts: { workspace: string; myRole: TokensData["myRole"]; me: string; now: number }): TokensData {
  return {
    workspace: opts.workspace,
    myRole: opts.myRole,
    newToken: "",
    now: opts.now,
    tokens: tokens.map((t) => ({
      id: t.id,
      name: t.name,
      prefix: t.prefix,
      scopes: t.scopes,
      createdAt: t.created_at ?? "",
      expiresAt: t.expires_at,
      lastUsedAt: t.last_used_at,
      createdBy: opts.me,
      revokedAt: t.revoked_at ?? undefined,
      environment: t.environment === "production" ? "production" : "development",
    })),
  };
}

/** Settings → Workspace. A workspace without a brand yet shows an empty brand card, not a sample one. */
export function toWorkspaceData(w: Awaited<ReturnType<typeof getWorkspaceSettings>>, opts: { industries: readonly string[]; region: string | undefined }): WorkspaceData {
  const o = w.organisation;
  const b = w.brands.default;
  return {
    myRole: w.my_role,
    org: {
      name: o.name,
      legalName: o.legal_name ?? "",
      industry: o.industry ?? "Other",
      website: o.website ?? "",
      location: o.location ?? "",
      phone: o.phone ?? "",
      slug: o.slug,
      id: o.id,
      createdAt: o.created_at ?? "",
      // CLAUDE.md: unknown owner-provided values stay bracketed.
      region: opts.region ?? "[DATA REGION, TO CONFIRM]",
      aiConsent: o.ai_media_analysis_consent,
      defaultFormats: o.default_formats,
    },
    owner: w.owner ?? { name: "Unknown", email: "" },
    planName: w.plan.name,
    brands: { used: w.brands.used, limit: w.brands.limit },
    brand: b ? { name: b.name, version: b.version, colours: b.colours, voice: b.voice ?? "No tone of voice yet", updatedAt: b.updated_at ?? "" } : { name: "No brand profile yet", version: 0, colours: [], voice: "Create one in Brand profiles", updatedAt: "" },
    industries: opts.industries,
  };
}
