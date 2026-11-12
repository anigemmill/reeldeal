"use client";

import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";
import { controlClass, useField } from "./field";

export function Input({ className, id, ...props }: ComponentProps<"input">) {
  const field = useField();
  return (
    <input
      id={id ?? field?.id}
      aria-describedby={field?.describedBy}
      aria-invalid={field?.invalid || undefined}
      className={cn(controlClass, "h-11 px-3.5 text-[15px]", className)}
      {...props}
    />
  );
}

export function Textarea({ className, id, ...props }: ComponentProps<"textarea">) {
  const field = useField();
  return (
    <textarea
      id={id ?? field?.id}
      aria-describedby={field?.describedBy}
      aria-invalid={field?.invalid || undefined}
      className={cn(controlClass, "min-h-24 resize-y px-3.5 py-3 text-[15px] leading-relaxed", className)}
      {...props}
    />
  );
}
