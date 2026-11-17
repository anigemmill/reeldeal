import { getPlan } from "@/lib/pricing";
import type { NavData } from "@/server/app/view";

/*
  SAMPLE DATA for the Stage 3 design review screens (onboarding, account, workspace,
  team, usage and billing, access tokens). Shown only on /design-system/screens/*,
  labelled "Sample data" on screen. Plan names, prices and limits come from
  config/pricing.json; people, dates, usage and tokens are invented.
  Bracketed values are owner copy or data still needed.
*/
export const SAMPLE_PLAN_ID = "business";
const plan = getPlan(SAMPLE_PLAN_ID)!;

export const SAMPLE_ORG = {
  name: "Lakeside Lodge",
  initials: "LL",
  legalName: "Lakeside Lodge Limited",
  industry: "Accommodation",
  website: "https://lakesidelodge.example",
  location: "Queenstown, New Zealand",
  phone: "+64 3 000 0000",
  slug: "lakeside-lodge-3f9a2c",
  id: "6f1c2a7e-0b3d-4e59-9a1c-3f9a2c11d8e4",
  createdAt: "2026-09-02T09:12:00Z",
  region: "Sydney (Australia)",
  aiConsent: true,
  defaultFormats: ["9:16", "1:1"],
  brand: { name: "Lakeside Lodge", version: 4, colours: ["#2038E2", "#0E2A47", "#F4EBDD", "#FF5A00"], voice: "Warm, unhurried, quietly confident.", updatedAt: "2026-11-12T03:30:00Z" },
};

export type SampleMember = { id: string; name: string; email: string; role: "owner" | "admin" | "editor" | "viewer"; joinedAt: string; lastActive: string; you?: boolean };
export const SAMPLE_MEMBERS: SampleMember[] = [
  { id: "u1", name: "Aroha Ngata", email: "aroha@lakesidelodge.example", role: "owner", joinedAt: "2026-09-02T09:12:00Z", lastActive: "2026-11-17T07:40:00Z", you: true },
  { id: "u2", name: "Ben Carter", email: "ben@lakesidelodge.example", role: "admin", joinedAt: "2026-09-04T22:01:00Z", lastActive: "2026-11-16T23:15:00Z" },
  { id: "u3", name: "Cleo Martin", email: "cleo@harbourstudio.example", role: "editor", joinedAt: "2026-10-11T01:44:00Z", lastActive: "2026-11-15T04:02:00Z" },
];
export const SAMPLE_INVITES = [
  { id: "i1", email: "dev@lakesidelodge.example", role: "viewer" as const, invitedBy: "Aroha Ngata", sentAt: "2026-11-15T21:00:00Z", expiresAt: "2026-11-22T21:00:00Z" },
];

export const SAMPLE_BILLING = {
  plan: { id: plan.id, name: plan.name, priceMonthly: plan.priceMonthly, priceAnnual: plan.priceAnnual, users: plan.users ?? null, brands: plan.brandProfiles ?? null, storageGB: plan.storageGB ?? null, analysisMinutes: plan.analysisMinutes ?? null, videoCredits: plan.videoCredits.amount ?? 0 },
  interval: "monthly" as const,
  status: "active" as const,
  currentPeriodStart: "2026-11-01T00:00:00Z",
  renewsAt: "2026-12-01T00:00:00Z",
  usage: { videoCreditsAvailable: 41, videoCreditsHeld: 1, videoCreditsUsed: 18, analysisMinutesUsed: 742, storageGBUsed: 864.2, brandsUsed: 2 },
  billingEmail: "accounts@lakesidelodge.example",
  billingName: "Lakeside Lodge Limited",
  taxNumber: "[GST NUMBER]",
  address: "[BILLING ADDRESS]",
  paymentMethod: { brand: "Visa", last4: "4242", expires: "08/28" },
  history: [
    { at: "2026-11-16T22:41:00Z", wallet: "video", kind: "charge", amount: -1, note: "Render of Summer mornings · 9:16" },
    { at: "2026-11-16T22:38:00Z", wallet: "video", kind: "release", amount: 1, note: "Render succeeded: hold released" },
    { at: "2026-11-16T22:35:00Z", wallet: "video", kind: "hold", amount: -1, note: "Hold for render of Summer mornings" },
    { at: "2026-11-14T03:12:00Z", wallet: "analysis", kind: "charge", amount: -14, note: "Analysis of drone_ridge.mp4 (14 min)" },
    { at: "2026-11-12T20:05:00Z", wallet: "video", kind: "release", amount: 2, note: "Render failed on our side: hold released, not charged" },
    { at: "2026-11-01T00:00:00Z", wallet: "video", kind: "grant", amount: 60, note: "Business plan allowance (November)" },
  ],
  invoices: [
    { id: "[INV-0003]", date: "2026-11-01T00:00:00Z", amount: plan.priceMonthly ?? 0, status: "paid" },
    { id: "[INV-0002]", date: "2026-10-01T00:00:00Z", amount: plan.priceMonthly ?? 0, status: "paid" },
  ],
};

export const SAMPLE_TOKENS = [
  { id: "t1", name: "Claude Desktop (studio laptop)", prefix: "rdl_pat_k7Qm", scopes: ["mcp:read", "mcp:write", "mcp:render"], createdAt: "2026-10-02T02:00:00Z", expiresAt: "2026-12-31T02:00:00Z", lastUsedAt: "2026-11-17T06:58:00Z", createdBy: "Aroha Ngata" },
  { id: "t2", name: "Reporting script", prefix: "rdl_pat_Zp3x", scopes: ["mcp:read"], createdAt: "2026-08-20T02:00:00Z", expiresAt: "2026-11-24T02:00:00Z", lastUsedAt: "2026-11-01T10:20:00Z", createdBy: "Aroha Ngata", environment: "development" as const },
  { id: "t3", name: "Old Claude connection", prefix: "rdl_pat_b2Lw", scopes: ["mcp:read", "mcp:write"], createdAt: "2026-07-01T02:00:00Z", expiresAt: null, lastUsedAt: "2026-08-03T10:20:00Z", createdBy: "Aroha Ngata", revokedAt: "2026-09-10T00:00:00Z" },
];
/** Shown once in the "token created" state. Not a real token: the wrong length and an obvious marker. */
export const SAMPLE_NEW_TOKEN = "rdl_pat_SAMPLE-not-a-real-token-shown-once-only";

export const SAMPLE_ACCOUNT = {
  name: "Aroha Ngata",
  initials: "AN",
  email: "aroha@lakesidelodge.example",
  emailVerified: true,
  pendingEmail: null,
  createdAt: "2026-09-02T09:12:00Z",
  lastSignInAt: "2026-11-17T07:40:00Z",
  workspaces: [
    { name: "Lakeside Lodge", role: "owner" },
    { name: "Harbour Café", role: "editor" },
  ],
};

/** App chrome for these review screens (matches the sample plan above). */
export function sampleSettingsNav(): NavData {
  const u = SAMPLE_BILLING.usage;
  const pct = (a: number, b: number | null) => (b ? Math.min(100, (a / b) * 100) : 0);
  return {
    workspace: { name: SAMPLE_ORG.name, initials: SAMPLE_ORG.initials, kind: `Owner · ${plan.name}` },
    user: { name: SAMPLE_ACCOUNT.name, initials: SAMPLE_ACCOUNT.initials, email: SAMPLE_ACCOUNT.email },
    planName: plan.name,
    usageLabel: "Sample usage",
    workspaces: [],
    meters: [
      { id: "videos", label: "Videos", value: `${u.videoCreditsAvailable} of ${SAMPLE_BILLING.plan.videoCredits} left`, pct: pct(u.videoCreditsAvailable, SAMPLE_BILLING.plan.videoCredits) },
      { id: "analysis", label: "Media analysis", value: `${u.analysisMinutesUsed} of ${SAMPLE_BILLING.plan.analysisMinutes} min`, pct: pct(u.analysisMinutesUsed, SAMPLE_BILLING.plan.analysisMinutes) },
      { id: "storage", label: "Storage", value: `${u.storageGBUsed} of ${SAMPLE_BILLING.plan.storageGB} GB`, pct: pct(u.storageGBUsed, SAMPLE_BILLING.plan.storageGB) },
    ],
  };
}

/** Every settings area linked, for the review pages. */
export const REVIEW_SETTINGS = [
  { id: "account", label: "Account", href: "/design-system/screens/account" },
  { id: "workspace", label: "Workspace", href: "/design-system/screens/workspace" },
  { id: "brands", label: "Brand profiles", href: "/brands" },
  { id: "team", label: "Team", href: "/design-system/screens/team" },
  { id: "billing", label: "Usage and billing", href: "/design-system/screens/billing" },
  { id: "tokens", label: "Access tokens", href: "/design-system/screens/tokens" },
  { id: "appearance", label: "Appearance", href: "/settings/appearance" },
];
