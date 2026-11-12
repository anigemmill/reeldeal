import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

/** Page-width wrapper: 1360px max with the brand side gutter. */
export function Container({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("mx-auto w-full max-w-container px-5 sm:px-8 lg:px-10", className)} {...props} />;
}

/** Mono uppercase label used for section eyebrows and metadata. */
export function Eyebrow({ className, ...props }: ComponentProps<"p">) {
  return <p className={cn("font-mono text-[11px] uppercase tracking-label text-ink-muted", className)} {...props} />;
}

export function Skeleton({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      aria-hidden
      className={cn("animate-pulse rounded-md bg-surface-muted motion-reduce:animate-none", className)}
      {...props}
    />
  );
}

export function Kbd({ className, ...props }: ComponentProps<"kbd">) {
  return (
    <kbd
      className={cn(
        "inline-flex h-5 min-w-5 items-center justify-center rounded-sm border border-line-strong bg-surface px-1 font-mono text-[11px] text-ink-muted",
        className,
      )}
      {...props}
    />
  );
}

/** Initials avatar. Real profile images arrive with accounts (Phase 3). */
export function Avatar({
  initials,
  label,
  className,
  shape = "circle",
}: {
  initials: string;
  label: string;
  className?: string;
  shape?: "circle" | "square";
}) {
  return (
    <span
      role="img"
      aria-label={label}
      className={cn(
        "inline-flex size-8 shrink-0 items-center justify-center bg-ink font-display text-xs font-bold text-bg",
        shape === "circle" ? "rounded-full" : "rounded-[9px]",
        className,
      )}
    >
      {initials}
    </span>
  );
}

/** Visible label for anything showing sample data (CLAUDE.md: no fake functionality presented as real). */
export function SampleDataNote({ className, children = "Design preview · sample data" }: ComponentProps<"p">) {
  return (
    <p
      className={cn(
        "inline-flex items-center gap-2 rounded-pill border border-dashed border-line-strong px-3 py-1 font-mono text-[11px] text-ink-muted",
        className,
      )}
    >
      <span aria-hidden className="size-1.5 rounded-full bg-ai" />
      {children}
    </p>
  );
}
