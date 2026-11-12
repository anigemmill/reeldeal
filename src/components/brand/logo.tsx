import { cn } from "@/lib/utils";

/*
  BRAND EXCEPTION: the logo mark keeps the full Crossroads gradient in every
  theme (CLAUDE.md). The outlined square follows the text colour.
*/
export function LogoMark({ className }: { className?: string }) {
  return (
    <span aria-hidden className={cn("relative inline-block size-6 shrink-0", className)}>
      <span className="absolute top-0 left-0 size-[68%] rounded-[25%] bg-grad-logo" />
      <span className="absolute right-0 bottom-0 size-[68%] rounded-[25%] border-2 border-current" />
    </span>
  );
}

/** "Reeldeal" is the working name (CLAUDE.md); confirm before launch. */
export function Logo({ className, size = "md" }: { className?: string; size?: "sm" | "md" }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5 font-display font-bold tracking-tight", size === "md" ? "text-[21px]" : "text-[19px]", className)}>
      <LogoMark className={size === "md" ? "size-[26px]" : "size-6"} />
      Reeldeal
    </span>
  );
}

/** BRAND EXCEPTION: giant footer wordmark with the full Crossroads gradient. */
export function Wordmark({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        "bg-grad-wordmark bg-clip-text text-center font-display text-[23vw] leading-[0.78] font-bold tracking-[-0.07em] whitespace-nowrap text-transparent",
        className,
      )}
    >
      Reeldeal
    </div>
  );
}
