import type { Metadata } from "next";
import { AppShell } from "@/components/app/app-shell";
import { DashboardScreen } from "@/components/app/dashboard/dashboard-screen";

export const metadata: Metadata = { title: "Screen · Dashboard" };

/* The dashboard inside the app shell, following the review toolbar's theme. */
export default function DashboardReviewPage() {
  return (
    <AppShell>
      <DashboardScreen />
    </AppShell>
  );
}
