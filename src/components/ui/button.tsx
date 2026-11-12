import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";
import { Slot } from "radix-ui";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

/*
  primary: the main blue action (e.g. "Start free").
  action:  the one orange action on a screen, or an AI action (brand rule: 5–10% orange).
  secondary / ghost: everything else.
  Use asChild to render a link with button styling: <Button asChild><Link …/></Button>.
*/
export const buttonVariants = cva(
  "inline-flex shrink-0 select-none items-center justify-center gap-2 whitespace-nowrap font-medium transition-[background-color,color,border-color,box-shadow,opacity] duration-(--rd-dur-fast) ease-brand disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary: "bg-primary text-primary-foreground hover:bg-primary/90",
        action: "bg-action font-semibold text-action-foreground hover:bg-action/90",
        secondary: "border border-line-strong bg-surface text-ink hover:bg-surface-muted",
        ghost: "text-ink hover:bg-surface-muted",
      },
      size: {
        sm: "h-9 px-3 text-sm",
        md: "h-11 px-4 text-[15px]",
        lg: "h-13 px-6 text-base",
      },
      shape: {
        rounded: "rounded-md",
        pill: "rounded-pill",
      },
    },
    compoundVariants: [
      { size: "md", shape: "pill", class: "px-5" },
      { size: "lg", shape: "pill", class: "px-7" },
    ],
    defaultVariants: { variant: "secondary", size: "md", shape: "rounded" },
  },
);

type ButtonProps = ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & { asChild?: boolean; loading?: boolean };

export function Button({ className, variant, size, shape, asChild, loading, disabled, children, ...props }: ButtonProps) {
  const Comp = asChild ? Slot.Root : "button";
  return (
    <Comp
      className={cn(buttonVariants({ variant, size, shape }), className)}
      disabled={asChild ? undefined : disabled || loading}
      aria-busy={loading || undefined}
      {...(asChild ? {} : { type: props.type ?? "button" })}
      {...props}
    >
      {loading && !asChild ? (
        <>
          <Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden />
          {children}
        </>
      ) : (
        children
      )}
    </Comp>
  );
}

const iconSizes = { sm: "size-9", md: "size-11", lg: "size-13" } as const;

/** Square icon button. `label` is required: it is the accessible name. */
export function IconButton({
  label,
  className,
  variant = "ghost",
  size = "md",
  shape = "rounded",
  children,
  ...props
}: Omit<ButtonProps, "asChild" | "loading"> & { label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      className={cn(buttonVariants({ variant, size, shape }), iconSizes[size ?? "md"], "px-0", className)}
      {...props}
    >
      {children}
    </button>
  );
}
