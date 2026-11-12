"use client";

import { Check } from "lucide-react";
import { Checkbox as C, RadioGroup as R, Switch as Sw } from "radix-ui";
import { useId, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/* Switch, Checkbox and RadioGroup, each with its own visible label. */

function Labelled({ id, label, hint, children }: { id: string; label: ReactNode; hint?: ReactNode; children: ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      {children}
      <div className="flex flex-col gap-0.5 pt-px">
        <label htmlFor={id} className="text-sm font-medium text-ink">
          {label}
        </label>
        {hint && <span className="text-xs text-ink-muted">{hint}</span>}
      </div>
    </div>
  );
}

export function Switch({
  label,
  hint,
  className,
  ...props
}: { label: ReactNode; hint?: ReactNode; className?: string } & Omit<Sw.SwitchProps, "id">) {
  const id = useId();
  return (
    <Labelled id={id} label={label} hint={hint}>
      <Sw.Root
        id={id}
        className={cn(
          "relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-pill border border-field-line bg-surface-muted transition-colors duration-(--rd-dur-fast) data-[state=checked]:border-primary data-[state=checked]:bg-primary disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        {...props}
      >
        <Sw.Thumb className="block size-[18px] translate-x-0.5 rounded-full bg-ink-muted shadow-sm transition-transform duration-(--rd-dur-fast) data-[state=checked]:translate-x-[22px] data-[state=checked]:bg-primary-foreground" />
      </Sw.Root>
    </Labelled>
  );
}

export function Checkbox({
  label,
  hint,
  className,
  ...props
}: { label: ReactNode; hint?: ReactNode; className?: string } & Omit<C.CheckboxProps, "id">) {
  const id = useId();
  return (
    <Labelled id={id} label={label} hint={hint}>
      <C.Root
        id={id}
        className={cn(
          "inline-flex size-5 shrink-0 items-center justify-center rounded-[6px] border border-field-line bg-surface data-[state=checked]:border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground disabled:opacity-50",
          className,
        )}
        {...props}
      >
        <C.Indicator>
          <Check className="size-3.5" strokeWidth={3} aria-hidden />
        </C.Indicator>
      </C.Root>
    </Labelled>
  );
}

export function RadioGroup({
  legend,
  options,
  className,
  ...props
}: {
  legend: ReactNode;
  options: { value: string; label: ReactNode; hint?: ReactNode }[];
  className?: string;
} & Omit<R.RadioGroupProps, "children">) {
  const baseId = useId();
  return (
    <fieldset className={cn("flex flex-col gap-3", className)}>
      <legend className="mb-1 text-sm font-medium text-ink">{legend}</legend>
      <R.Root className="flex flex-col gap-3" {...props}>
        {options.map((o) => {
          const id = `${baseId}-${o.value}`;
          return (
            <Labelled key={o.value} id={id} label={o.label} hint={o.hint}>
              <R.Item
                id={id}
                value={o.value}
                className="inline-flex size-5 shrink-0 items-center justify-center rounded-full border border-field-line bg-surface data-[state=checked]:border-primary"
              >
                <R.Indicator className="size-2.5 rounded-full bg-primary" />
              </R.Item>
            </Labelled>
          );
        })}
      </R.Root>
    </fieldset>
  );
}
