"use client";

import { Tabs as T, ToggleGroup as G } from "radix-ui";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

/* Tabs: switch between panels of content (Radix: arrow keys, roles). */
export const Tabs = T.Root;

export function TabsList({ className, ...props }: ComponentProps<typeof T.List>) {
  return <T.List className={cn("flex gap-1 border-b border-line", className)} {...props} />;
}

export function TabsTrigger({ className, ...props }: ComponentProps<typeof T.Trigger>) {
  return (
    <T.Trigger
      className={cn(
        "-mb-px inline-flex h-10 items-center gap-2 border-b-2 border-transparent px-3 text-sm font-medium text-ink-muted transition-colors hover:text-ink data-[state=active]:border-primary data-[state=active]:text-ink",
        className,
      )}
      {...props}
    />
  );
}

export function TabsContent({ className, ...props }: ComponentProps<typeof T.Content>) {
  return <T.Content className={cn("pt-4", className)} {...props} />;
}

/*
  SegmentedControl: pick one option in place (aspect ratio, view mode).
  Not for navigation between panels; use Tabs for that.
*/
export function SegmentedControl({
  label,
  options,
  value,
  onValueChange,
  size = "md",
  className,
}: {
  label: string;
  options: { value: string; label: ReactNode; title?: string }[];
  value: string;
  onValueChange: (value: string) => void;
  size?: "sm" | "md";
  className?: string;
}) {
  return (
    <G.Root
      type="single"
      aria-label={label}
      value={value}
      onValueChange={(v) => v && onValueChange(v)}
      className={cn("inline-flex gap-0.5 rounded-md border border-line bg-surface-muted p-0.5", className)}
    >
      {options.map((o) => (
        <G.Item
          key={o.value}
          value={o.value}
          title={o.title}
          className={cn(
            "inline-flex items-center justify-center gap-1.5 rounded-[9px] px-3 font-medium text-ink-muted transition-colors hover:text-ink data-[state=on]:bg-surface data-[state=on]:text-ink data-[state=on]:shadow-sm [&_svg]:size-4",
            size === "sm" ? "h-7 text-xs" : "h-9 text-sm",
          )}
        >
          {o.label}
        </G.Item>
      ))}
    </G.Root>
  );
}
