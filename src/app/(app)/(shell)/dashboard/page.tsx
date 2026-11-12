import type { Metadata } from "next";
import { Eyebrow, SampleDataNote } from "@/components/ui/misc";

export const metadata: Metadata = { title: "Home" };

// CHECKPOINT 1 PLACEHOLDER. The designed Dashboard is delivered at Checkpoint 2.
export default function DashboardPage() {
  return (
    <div className="flex flex-col gap-4 px-6 py-16 lg:px-12">
      <SampleDataNote className="w-fit" />
      <Eyebrow>Placeholder · Checkpoint 1</Eyebrow>
      <h1 className="font-display text-4xl font-semibold tracking-display">Dashboard</h1>
      <p className="max-w-prose text-ink-muted">
        The app shell and sidebar are in place. The designed dashboard arrives at Checkpoint 2.
      </p>
    </div>
  );
}
