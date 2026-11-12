"use client";

import { createContext, useContext, useId, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/*
  Field wires a visible label, optional hint and error message to the control
  inside it (Input, Textarea, Select), so every control has an accessible name
  and description without passing ids by hand.
*/
type FieldState = { id: string; describedBy?: string; invalid: boolean };
const FieldContext = createContext<FieldState | null>(null);

export function useField() {
  return useContext(FieldContext);
}

export function Field({
  label,
  hint,
  error,
  hideLabel,
  className,
  children,
}: {
  label: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  hideLabel?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [errorId, hintId].filter(Boolean).join(" ") || undefined;

  return (
    <FieldContext.Provider value={{ id, describedBy, invalid: Boolean(error) }}>
      <div className={cn("flex flex-col gap-1.5", className)}>
        <label htmlFor={id} className={cn("text-sm font-medium text-ink", hideLabel && "sr-only")}>
          {label}
        </label>
        {children}
        {hint && !error && (
          <p id={hintId} className="text-xs text-ink-muted">
            {hint}
          </p>
        )}
        {error && (
          <p id={errorId} className="text-xs font-medium text-danger">
            {error}
          </p>
        )}
      </div>
    </FieldContext.Provider>
  );
}

/** Shared look for text-like controls. */
export const controlClass =
  "w-full rounded-md border border-field-line bg-surface text-ink placeholder:text-ink-muted transition-[border-color,box-shadow] duration-(--rd-dur-fast) hover:border-ink-muted focus-visible:border-focus focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-focus disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-danger";
