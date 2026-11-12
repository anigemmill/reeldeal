import { cva, type VariantProps } from "class-variance-authority";
import { Sparkles } from "lucide-react";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

/* Small status label. `ai` marks anything the AI produced or is working on. */
export const badgeVariants = cva(
  "inline-flex items-center gap-1 whitespace-nowrap rounded-pill font-mono text-[11px] leading-none font-medium [&_svg]:size-3",
  {
    variants: {
      tone: {
        neutral: "bg-surface-muted text-ink-muted",
        primary: "bg-primary text-primary-foreground",
        ai: "bg-ai text-ai-foreground",
        success: "bg-success text-success-foreground",
        warning: "bg-warning text-warning-foreground",
        danger: "bg-danger text-danger-foreground",
        outline: "border border-line-strong text-ink-muted",
      },
      size: { sm: "h-5 px-2", md: "h-6 px-2.5" },
    },
    defaultVariants: { tone: "neutral", size: "md" },
  },
);

export function Badge({ className, tone, size, ...props }: ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ tone, size }), className)} {...props} />;
}

/** "AI" badge with the sparkle icon. */
export function AiBadge({ children = "AI", className, size, ...props }: ComponentProps<"span"> & { size?: "sm" | "md" }) {
  return (
    <Badge tone="ai" size={size} className={className} {...props}>
      <Sparkles aria-hidden />
      {children}
    </Badge>
  );
}

/*
  Pill: rounded chip for filters, tags and prompts. Pass `pressed` to make it a
  toggle button (filters); omit it for a static tag.
*/
export const pillVariants = cva(
  "inline-flex items-center gap-1.5 whitespace-nowrap rounded-pill border text-sm transition-colors duration-(--rd-dur-fast) [&_svg]:size-3.5",
  {
    variants: {
      tone: {
        neutral: "border-line bg-surface text-ink",
        ai: "border-transparent bg-ai/12 text-ink [&_svg]:text-ai",
        tint: "border-transparent bg-tint text-on-tint",
      },
      size: { sm: "h-7 px-3", md: "h-9 px-4" },
    },
    defaultVariants: { tone: "neutral", size: "md" },
  },
);

type PillProps = VariantProps<typeof pillVariants> & { className?: string; children: React.ReactNode };

export function Pill({ className, tone, size, ...props }: PillProps & ComponentProps<"span">) {
  return <span className={cn(pillVariants({ tone, size }), className)} {...props} />;
}

export function PillToggle({
  className,
  tone,
  size,
  pressed,
  ...props
}: PillProps & Omit<ComponentProps<"button">, "aria-pressed"> & { pressed: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      className={cn(
        pillVariants({ tone, size }),
        "hover:border-line-strong",
        pressed && "border-ink bg-ink text-bg hover:border-ink",
        className,
      )}
      {...props}
    />
  );
}
