import type { Metadata } from "next";
import { AppShell } from "@/components/app/app-shell";
import { DashboardPreview } from "@/components/app/dashboard/dashboard-preview";

export const metadata: Metadata = { title: "Screen · Dashboard" };

/* The dashboard inside the app shell, following the review toolbar's theme. */
export default function DashboardReviewPage() {
  return (
    <AppShell>
      <DashboardPreview />
    </AppShell>
  );
}
