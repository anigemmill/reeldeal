"use client";

import { Check, ChevronDown } from "lucide-react";
import { Select as S } from "radix-ui";
import { cn } from "@/lib/utils";
import { controlClass, useField } from "./field";

export type SelectOption = { value: string; label: string; disabled?: boolean };

/** Accessible select (Radix). Use inside <Field> for the label. */
export function Select({
  options,
  value,
  defaultValue,
  onValueChange,
  placeholder = "Select…",
  disabled,
  className,
  "aria-label": ariaLabel,
}: {
  options: SelectOption[];
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  "aria-label"?: string;
}) {
  const field = useField();
  return (
    <S.Root value={value} defaultValue={defaultValue} onValueChange={onValueChange} disabled={disabled}>
      <S.Trigger
        id={field?.id}
        aria-label={ariaLabel}
        aria-describedby={field?.describedBy}
        aria-invalid={field?.invalid || undefined}
        className={cn(
          controlClass,
          "flex h-11 items-center justify-between gap-2 px-3.5 text-left text-[15px] data-placeholder:text-ink-muted",
          className,
        )}
      >
        <S.Value placeholder={placeholder} />
        <S.Icon>
          <ChevronDown className="size-4 text-ink-muted" aria-hidden />
        </S.Icon>
      </S.Trigger>
      <S.Portal>
        <S.Content
          position="popper"
          sideOffset={6}
          className="z-50 max-h-(--radix-select-content-available-height) min-w-(--radix-select-trigger-width) overflow-hidden rounded-md border border-line bg-surface p-1 text-ink shadow-float"
        >
          <S.Viewport>
            {options.map((o) => (
              <S.Item
                key={o.value}
                value={o.value}
                disabled={o.disabled}
                className="relative flex h-10 cursor-default select-none items-center rounded-sm pr-3 pl-8 text-[15px] outline-none data-disabled:opacity-50 data-highlighted:bg-surface-muted"
              >
                <S.ItemIndicator className="absolute left-2.5">
                  <Check className="size-4 text-primary" aria-hidden />
                </S.ItemIndicator>
                <S.ItemText>{o.label}</S.ItemText>
              </S.Item>
            ))}
          </S.Viewport>
        </S.Content>
      </S.Portal>
    </S.Root>
  );
}
