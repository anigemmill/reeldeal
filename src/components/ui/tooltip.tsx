"use client";

import { Tooltip as T } from "radix-ui";
import type { ReactNode } from "react";

/** Wrap the app (or a page) once so tooltips share their open delay. */
export const TooltipProvider = ({ children }: { children: ReactNode }) => (
  <T.Provider delayDuration={300}>{children}</T.Provider>
);

/** Supplementary hint only; never the only way to get information. */
export function Tooltip({ content, children, side = "top" }: { content: ReactNode; children: ReactNode; side?: "top" | "right" | "bottom" | "left" }) {
  return (
    <T.Root>
      <T.Trigger asChild>{children}</T.Trigger>
      <T.Portal>
        <T.Content
          side={side}
          sideOffset={6}
          className="z-50 max-w-64 rounded-sm bg-ink px-2.5 py-1.5 text-xs text-bg shadow-float"
        >
          {content}
          <T.Arrow className="fill-ink" />
        </T.Content>
      </T.Portal>
    </T.Root>
  );
}
