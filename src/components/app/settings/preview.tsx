"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/toast";

/*
  Helpers for the design review versions of the new settings and onboarding screens
  (sample data, nothing saved). Real pages pass real data and actions instead.
*/

/** Which dialog to open on load (?dialog=invite), so a reviewer or screenshot can show it. */
export function useInitialDialog(): [string | null, (d: string | null) => void] {
  const [dialog, setDialog] = useState<string | null>(null);
  useEffect(() => {
    const d = new URLSearchParams(location.search).get("dialog");
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time sync from the URL (review pages only)
    if (d) setDialog(d);
  }, []);
  return [dialog, setDialog];
}

export const previewOnly = (what = "Nothing was saved") => toast({ title: "Design preview", description: `${what}: this screen isn't connected yet.`, tone: "neutral" });

export function SampleBadge() {
  return <Badge tone="outline">Sample data · not connected</Badge>;
}

export const dateFmt = (iso: string | null | undefined, opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" }) =>
  iso ? new Intl.DateTimeFormat("en-NZ", { timeZone: "Pacific/Auckland", ...opts }).format(new Date(iso)) : "—";

/** "3 days ago" relative to a fixed review date, so screenshots stay stable. */
export function agoFmt(iso: string | null | undefined, now = Date.parse("2026-11-17T08:00:00Z")) {
  if (!iso) return "Never";
  const m = Math.round((now - Date.parse(iso)) / 60000);
  if (m < 60) return `${Math.max(1, m)} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} hr ago`;
  const d = Math.round(h / 24);
  return d === 1 ? "Yesterday" : d < 30 ? `${d} days ago` : dateFmt(iso);
}

export const ROLE_LABEL = { owner: "Owner", admin: "Administrator", editor: "Editor", viewer: "Viewer" } as const;
export const ROLE_SUMMARY = {
  owner: "Everything, including billing, the plan, ownership and deleting the workspace. One per workspace.",
  admin: "Manage the workspace and team (except the owner and other admins), delete content, AI settings.",
  editor: "Upload footage, edit brands and projects, generate and render videos (spends credits).",
  viewer: "View the library, projects and exports, and download finished videos.",
} as const;
