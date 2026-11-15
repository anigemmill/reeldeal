import { Skeleton } from "@/components/ui/misc";

/* Shown while a signed-in page loads its data (Suspense fallback). */
export function PageLoading({ label = "Loading" }: { label?: string }) {
  return (
    <div role="status" aria-live="polite" className="mx-auto flex w-full max-w-[1440px] flex-col gap-6 px-4 py-6 sm:px-6 lg:px-10 lg:py-9">
      <span className="sr-only">{label}…</span>
      <Skeleton className="h-10 w-2/5" />
      <div className="grid gap-4 xl:grid-cols-[1.35fr_1fr]">
        <Skeleton className="h-72" />
        <Skeleton className="h-72" />
      </div>
      <Skeleton className="h-48" />
    </div>
  );
}
