"use client";

import { X } from "lucide-react";
import { Dialog as D } from "radix-ui";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { IconButton } from "./button";

/*
  Modal dialog (Radix): traps focus, closes on Esc, returns focus to the trigger.
  `title` is required for the accessible name; `description` is optional.
*/
export function Modal({
  trigger,
  title,
  description,
  children,
  footer,
  open,
  onOpenChange,
  size = "md",
}: {
  trigger?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  size?: "sm" | "md" | "lg";
}) {
  return (
    <D.Root open={open} onOpenChange={onOpenChange}>
      {trigger && <D.Trigger asChild>{trigger}</D.Trigger>}
      <D.Portal>
        <D.Overlay className="fixed inset-0 z-40 bg-scrim backdrop-blur-[2px]" />
        <D.Content
          className={cn(
            "fixed top-1/2 left-1/2 z-50 flex max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] -translate-1/2 flex-col overflow-hidden rounded-xl border border-line bg-surface text-ink shadow-float",
            size === "sm" && "max-w-sm",
            size === "md" && "max-w-lg",
            size === "lg" && "max-w-3xl",
          )}
          {...(description ? {} : { "aria-describedby": undefined })}
        >
          <div className="flex items-start justify-between gap-4 p-6 pb-0">
            <div className="flex flex-col gap-1.5">
              <D.Title className="font-display text-xl font-semibold tracking-tight">{title}</D.Title>
              {description && <D.Description className="text-sm text-ink-muted">{description}</D.Description>}
            </div>
            <D.Close asChild>
              <IconButton label="Close" size="sm" className="-mt-1 -mr-2">
                <X aria-hidden />
              </IconButton>
            </D.Close>
          </div>
          {children && <div className="overflow-y-auto p-6">{children}</div>}
          {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-line p-4">{footer}</div>}
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}

export const ModalClose = D.Close;
