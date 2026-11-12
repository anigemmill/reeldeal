import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

/** Surface container. `raised` adds the brand card shadow; `muted` sits on the page tint. */
export function Card({
  className,
  tone = "surface",
  ...props
}: ComponentProps<"div"> & { tone?: "surface" | "muted" | "raised" }) {
  return (
    <div
      className={cn(
        "rounded-lg border border-line",
        tone === "surface" && "bg-surface",
        tone === "muted" && "border-transparent bg-surface-muted",
        tone === "raised" && "bg-surface shadow-card studio:shadow-none",
        className,
      )}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("flex items-start justify-between gap-3 p-5 pb-0", className)} {...props} />;
}

export function CardTitle({ className, ...props }: ComponentProps<"h3">) {
  return <h3 className={cn("font-display text-lg font-semibold tracking-tight", className)} {...props} />;
}

export function CardBody({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("p-5", className)} {...props} />;
}
