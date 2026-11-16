"use client";

import { useId, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input, Textarea } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { DEMO_EMAIL, DEMO_INDUSTRIES, DEMO_SAMPLE_SLOTS, DEMO_TEAM_SIZES } from "@/content/demo";
import { cn } from "@/lib/utils";

/*
  Demo booking form (W-Demo). MOCK: no booking provider is connected, so the
  form does not submit and never shows the "You're booked in" confirmation from
  the design. The submit button is disabled with a visible note, and the time
  slots are labelled as samples. Wire this to [BOOKING PROVIDER] (calendar +
  email) before enabling it.
*/
export function DemoForm() {
  const noteId = useId();
  return (
    <form className="flex flex-col gap-4.5" aria-describedby={noteId} onSubmit={(e) => e.preventDefault()}>
      <div className="grid gap-3.5 sm:grid-cols-2">
        <Field label="Full name">
          <Input name="name" type="text" autoComplete="name" />
        </Field>
        <Field label="Work email">
          <Input name="email" type="email" autoComplete="email" />
        </Field>
        <Field label="Business name">
          <Input name="business" type="text" autoComplete="organization" />
        </Field>
        <Field label="Industry">
          <Select options={DEMO_INDUSTRIES.map((i) => ({ value: i, label: i }))} defaultValue={DEMO_INDUSTRIES[0]} />
        </Field>
      </div>

      <PillRadios legend="Team size" name="team" defaultIndex={1} options={DEMO_TEAM_SIZES.map((l) => ({ value: l, label: l }))} />

      <PillRadios
        legend={
          <>
            Pick a time <span className="font-normal text-ink-muted">(sample times: live availability arrives with [BOOKING PROVIDER])</span>
          </>
        }
        name="slot"
        defaultIndex={1}
        grid
        options={DEMO_SAMPLE_SLOTS.map((s) => ({
          value: `${s.day} ${s.time}`,
          label: (
            <>
              <span className="block font-mono text-[11px] opacity-80">{s.day}</span>
              <span className="mt-0.5 block font-semibold">{s.time}</span>
            </>
          ),
        }))}
      />

      <Field label="What would you like to make?" hint="Optional">
        <Textarea name="message" rows={3} />
      </Field>

      <Button type="submit" variant="action" shape="pill" size="lg" disabled className="h-14 text-base">
        Book my demo
      </Button>
      <p id={noteId} className="rounded-[14px] bg-surface-muted px-4 py-3 text-sm text-ink">
        [BOOKING PROVIDER] Online booking isn’t connected yet, so this form can’t send. Email{" "}
        <span className="font-semibold">{DEMO_EMAIL}</span> to book a time.
      </p>
    </form>
  );
}

/* Native radios drawn as pills: arrow keys move between options, the legend names the group. */
function PillRadios({
  legend,
  name,
  options,
  defaultIndex,
  grid,
}: {
  legend: ReactNode;
  name: string;
  options: { value: string; label: ReactNode }[];
  defaultIndex: number;
  grid?: boolean;
}) {
  const id = useId();
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-medium">{legend}</legend>
      <div className={cn(grid ? "grid grid-cols-2 gap-2 sm:grid-cols-3" : "flex flex-wrap gap-1.5")}>
        {options.map((o, i) => (
          <label key={o.value} htmlFor={`${id}-${i}`} className="relative">
            <input
              id={`${id}-${i}`}
              type="radio"
              name={name}
              value={o.value}
              defaultChecked={i === defaultIndex}
              className="peer sr-only"
            />
            <span
              className={cn(
                "block cursor-pointer border border-field-line bg-surface text-sm text-ink transition-colors peer-checked:border-ink peer-checked:bg-ink peer-checked:text-bg peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-focus motion-reduce:transition-none",
                grid ? "rounded-[14px] p-3 text-left" : "rounded-pill px-4 py-2.5",
              )}
            >
              {o.label}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
