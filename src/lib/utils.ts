import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/*
  tailwind-merge must know our custom theme keys (globals.css @theme), otherwise
  it misreads e.g. `shadow-card` as a shadow colour and fails to dedupe it.
  Colours need no entry: any `bg-*` / `text-*` name is treated as a colour.
*/
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      shadow: ["card", "float", "prompt"],
      radius: ["pill"],
      font: ["display", "accent"],
      tracking: ["display", "label"],
      ease: ["brand"],
      container: ["container"],
    },
  },
});

/** Merge class names, with later Tailwind classes overriding conflicting earlier ones. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
