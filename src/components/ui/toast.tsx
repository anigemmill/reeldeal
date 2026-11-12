"use client";

import { CheckCircle2, AlertTriangle, Info, Sparkles, X, XCircle } from "lucide-react";
import { Toast as T } from "radix-ui";
import { useSyncExternalStore } from "react";
import { cn } from "@/lib/utils";

/*
  Toasts. Call toast({ title, description, tone }) from anywhere on the client;
  render <Toaster /> once per root layout. Announced to screen readers by Radix.
*/
type Tone = "neutral" | "success" | "warning" | "danger" | "ai";
type ToastItem = { id: number; title: string; description?: string; tone: Tone };

let items: ToastItem[] = [];
let nextId = 1;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function toast(t: { title: string; description?: string; tone?: Tone }) {
  items = [...items, { id: nextId++, tone: "neutral", ...t }];
  emit();
}

function dismiss(id: number) {
  items = items.filter((t) => t.id !== id);
  emit();
}

const icons = { neutral: Info, success: CheckCircle2, warning: AlertTriangle, danger: XCircle, ai: Sparkles };
const iconTone = { neutral: "text-ink-muted", success: "text-success", warning: "text-warning", danger: "text-danger", ai: "text-ai" };

const empty: ToastItem[] = [];

export function Toaster() {
  const list = useSyncExternalStore(
    (l) => (listeners.add(l), () => listeners.delete(l)),
    () => items,
    () => empty,
  );
  return (
    <T.Provider swipeDirection="right" duration={5000}>
      {list.map((t) => {
        const Icon = icons[t.tone];
        return (
          <T.Root
            key={t.id}
            type={t.tone === "danger" ? "foreground" : "background"}
            onOpenChange={(open) => !open && dismiss(t.id)}
            className="flex items-start gap-3 rounded-lg border border-line bg-surface p-4 text-ink shadow-float"
          >
            <Icon className={cn("mt-0.5 size-5 shrink-0", iconTone[t.tone])} aria-hidden />
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <T.Title className="text-sm font-semibold">{t.title}</T.Title>
              {t.description && <T.Description className="text-sm text-ink-muted">{t.description}</T.Description>}
            </div>
            <T.Close aria-label="Dismiss" className="-m-1 rounded-sm p-1 text-ink-muted hover:text-ink">
              <X className="size-4" aria-hidden />
            </T.Close>
          </T.Root>
        );
      })}
      <T.Viewport className="fixed right-0 bottom-0 z-50 flex w-full max-w-sm flex-col gap-2 p-4 outline-none" />
    </T.Provider>
  );
}
