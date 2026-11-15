import Link from "next/link";
import { Button } from "@/components/ui/button";

/* Shown for app pages that don't exist or belong to another workspace (the two look the same on purpose). */
export default function AppNotFound() {
  return (
    <main id="main" className="flex min-h-[60dvh] flex-col items-center justify-center gap-4 px-4 py-16 text-center">
      <p className="font-mono text-xs tracking-label text-ink-muted uppercase">404</p>
      <h1 className="font-display text-3xl font-semibold tracking-tight">This isn&apos;t available</h1>
      <p className="max-w-md text-ink-muted">It doesn&apos;t exist, or it belongs to a workspace you&apos;re not a member of.</p>
      <Button asChild variant="primary">
        <Link href="/dashboard">Back to your dashboard</Link>
      </Button>
    </main>
  );
}
