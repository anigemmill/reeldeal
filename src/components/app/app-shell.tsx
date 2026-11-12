"use client";

import { Menu, X } from "lucide-react";
import { Dialog } from "radix-ui";
import { useState, type ReactNode } from "react";
import { Logo } from "@/components/brand/logo";
import { AppNav } from "./app-nav";

/*
  App layout: fixed sidebar from 1024px, a top bar with a drawer below that.
  Studio does not use this shell (full-screen focus mode).
*/
export function AppShell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex min-h-dvh bg-bg">
      <aside className="sticky top-0 hidden h-dvh w-62 shrink-0 border-r border-line lg:block">
        <AppNav />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="sticky top-0 z-30 flex items-center justify-between border-b border-line bg-surface px-4 py-3 lg:hidden">
          <Logo size="sm" />
          <Dialog.Root open={open} onOpenChange={setOpen}>
            <Dialog.Trigger aria-label="Open navigation" className="inline-flex size-11 items-center justify-center rounded-md border border-line">
              <Menu className="size-5" aria-hidden />
            </Dialog.Trigger>
            <Dialog.Portal>
              <Dialog.Overlay className="fixed inset-0 z-40 bg-scrim lg:hidden" />
              <Dialog.Content
                aria-describedby={undefined}
                onClick={(e) => (e.target as HTMLElement).closest("a") && setOpen(false)}
                className="fixed inset-y-0 left-0 z-50 w-[min(300px,86vw)] border-r border-line shadow-float lg:hidden"
              >
                <Dialog.Title className="sr-only">Navigation</Dialog.Title>
                <Dialog.Close aria-label="Close navigation" className="absolute top-3.5 right-3 inline-flex size-9 items-center justify-center rounded-md text-ink-muted hover:bg-surface-muted">
                  <X className="size-4" aria-hidden />
                </Dialog.Close>
                <AppNav className="overflow-y-auto" />
              </Dialog.Content>
            </Dialog.Portal>
          </Dialog.Root>
        </div>
        <main id="main" className="min-w-0 flex-1">
          {children}
        </main>
      </div>
    </div>
  );
}
