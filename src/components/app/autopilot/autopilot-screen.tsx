"use client";

import { ArrowLeft, ArrowRight, Check, Clapperboard, Pause, Play, Plus, Sparkles, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { MediaArt, PlaceholderTag } from "@/components/media/media-art";
import { AiBadge, PillToggle } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/choice";
import { Modal, ModalClose } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Textarea } from "@/components/ui/input";
import { Avatar, Eyebrow, SampleDataNote } from "@/components/ui/misc";
import { ProgressBar, ProgressRing } from "@/components/ui/progress";
import { SegmentedControl } from "@/components/ui/tabs";
import { toast } from "@/components/ui/toast";
import { getMedia } from "@/content/media";
import {
  AUTOPILOT_CHANGES,
  AUTOPILOT_DEFAULT_BRIEF,
  AUTOPILOT_FOOTAGE,
  AUTOPILOT_FORMATS,
  AUTOPILOT_GOALS,
  AUTOPILOT_LENGTHS,
  AUTOPILOT_OPTIONS,
  AUTOPILOT_STAGES,
} from "@/content/sample/autopilot";
import { SAMPLE_WORKSPACE, sampleUsageMeters } from "@/content/sample/workspace";
import { renderCredits } from "@/lib/pricing";
import { cn } from "@/lib/utils";

/*
  Autopilot (Phase 1 design, from design/explorations/Autopilot*.dc.html).
  Mobile-first flow: Brief → Creating → Review. DESIGN PREVIEW: footage, progress
  and options are sample data; nothing is uploaded, generated, charged or exported.
  The brief can arrive from the dashboard as ?brief=…; ?step=review opens the review.
*/
type Step = "brief" | "creating" | "review";
const STEPS: { id: Step; label: string }[] = [
  { id: "brief", label: "Brief" },
  { id: "creating", label: "Creating" },
  { id: "review", label: "Review" },
];

export function AutopilotScreen({ exitHref = "/dashboard" }: { exitHref?: string }) {
  const [step, setStep] = useState<Step>("brief");
  const [brief, setBrief] = useState(AUTOPILOT_DEFAULT_BRIEF);
  const [goal, setGoal] = useState<string>(AUTOPILOT_GOALS[0]);
  const [formats, setFormats] = useState<string[]>(["9:16"]);
  const [length, setLength] = useState<number>(30);

  // One-time read of ?brief= and ?step= (keeps the page statically rendered).
  useEffect(() => {
    const q = new URLSearchParams(location.search);
    const b = q.get("brief")?.trim();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time sync from the URL
    if (b) setBrief(b.slice(0, 500));
    if (q.get("step") === "review") setStep("review");
  }, []);

  const credits = renderCredits({ seconds: length, formats: formats.length });

  return (
    <div className="flex min-h-dvh flex-col bg-bg text-ink">
      <header className="sticky top-0 z-30 border-b border-line bg-bg/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-[1180px] items-center gap-3 px-4 py-3 sm:px-6">
          <Link
            href={exitHref}
            aria-label="Close Autopilot"
            className="inline-flex size-9 shrink-0 items-center justify-center rounded-md border border-line-strong bg-surface hover:bg-surface-muted"
          >
            <X className="size-4" aria-hidden />
          </Link>
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <Sparkles className="size-4 shrink-0 text-ai" aria-hidden />
            <span className="font-display text-base font-semibold">Autopilot</span>
          </div>
          <ol aria-label="Progress" className="flex items-center gap-1.5 font-mono text-[11px]">
            {STEPS.map((s, i) => {
              const idx = STEPS.findIndex((x) => x.id === step);
              const state = i < idx ? "done" : i === idx ? "now" : "next";
              return (
                <li key={s.id} aria-current={state === "now" ? "step" : undefined} className="flex items-center gap-1.5">
                  {i > 0 && <span aria-hidden className="h-px w-3 bg-line-strong sm:w-6" />}
                  <span
                    className={cn(
                      "inline-flex h-6 items-center gap-1 rounded-pill px-2",
                      state === "now" && "bg-ink text-bg",
                      state === "done" && "bg-surface-muted text-ink",
                      state === "next" && "text-ink-muted",
                    )}
                  >
                    {state === "done" && <Check className="size-3" aria-hidden />}
                    <span className={cn(state !== "now" && "sr-only sm:not-sr-only")}>{s.label}</span>
                    <span className="sr-only">{state === "done" ? " (done)" : state === "next" ? " (next)" : ""}</span>
                  </span>
                </li>
              );
            })}
          </ol>
          <SampleDataNote className="hidden lg:inline-flex" />
        </div>
      </header>

      <main id="main" className="mx-auto flex w-full max-w-[1180px] flex-1 flex-col px-4 py-6 sm:px-6 lg:py-10">
        {step === "brief" && (
          <BriefStep
            brief={brief}
            setBrief={setBrief}
            goal={goal}
            setGoal={setGoal}
            formats={formats}
            setFormats={setFormats}
            length={length}
            setLength={setLength}
            credits={credits}
            onCreate={() => setStep("creating")}
          />
        )}
        {step === "creating" && <CreatingStep onDone={() => setStep("review")} onBack={() => setStep("brief")} />}
        {step === "review" && <ReviewStep credits={credits} formats={formats} length={length} onBack={() => setStep("brief")} />}
      </main>
    </div>
  );
}

/* ---- Step 1: Brief ---------------------------------------------------- */

function BriefStep(props: {
  brief: string;
  setBrief: (v: string) => void;
  goal: string;
  setGoal: (v: string) => void;
  formats: string[];
  setFormats: (f: string[]) => void;
  length: number;
  setLength: (n: number) => void;
  credits: number;
  onCreate: () => void;
}) {
  const { brief, setBrief, goal, setGoal, formats, setFormats, length, setLength, credits, onCreate } = props;
  const videosLeft = sampleUsageMeters().meters[0].value;
  const canCreate = brief.trim().length > 0 && formats.length > 0;

  return (
    <form
      className="grid gap-8 pb-24 lg:grid-cols-[minmax(0,1fr)_360px] lg:pb-0"
      onSubmit={(e) => {
        e.preventDefault();
        if (canCreate) onCreate();
      }}
    >
      <div className="flex min-w-0 flex-col gap-7">
        <div className="flex flex-col gap-2">
          <Eyebrow>Step 1 of 3 · Brief</Eyebrow>
          <h1 className="font-display text-[clamp(32px,4vw,48px)] leading-none font-semibold tracking-display">
            What are we <em className="font-accent font-normal">making?</em>
          </h1>
        </div>

        <section aria-labelledby="footage-h" className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-4">
          <div className="flex items-center justify-between gap-3">
            <h2 id="footage-h" className="text-sm font-semibold">
              {AUTOPILOT_FOOTAGE.count} clips added
            </h2>
            {/* Choosing footage arrives with the media library (Phase 3). */}
            <Button variant="ghost" size="sm" disabled title="Choosing footage arrives with the media library">
              <Plus aria-hidden />
              Add more · soon
            </Button>
          </div>
          <ul className="grid grid-cols-6 gap-2" aria-label="Selected footage">
            {AUTOPILOT_FOOTAGE.thumbs.map((id) => (
              <li key={id} className="relative aspect-[4/5] overflow-hidden rounded-md">
                <MediaArt asset={getMedia(id)} />
              </li>
            ))}
            <li className="flex aspect-[4/5] items-center justify-center rounded-md bg-surface-muted font-mono text-xs text-ink-muted">
              +{AUTOPILOT_FOOTAGE.count - AUTOPILOT_FOOTAGE.thumbs.length}
            </li>
          </ul>
        </section>

        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium" id="brand-l">
            Brand
          </span>
          <div aria-labelledby="brand-l" className="flex items-center gap-3 rounded-xl border border-line bg-surface p-3">
            <Avatar initials={SAMPLE_WORKSPACE.initials} label={SAMPLE_WORKSPACE.name} shape="square" className="size-10 bg-primary text-primary-foreground" />
            <span className="flex min-w-0 flex-col">
              <span className="font-semibold">{SAMPLE_WORKSPACE.name}</span>
              <span className="text-xs text-ink-muted">Brand profile · fonts, colours, logo</span>
            </span>
          </div>
        </div>

        <fieldset className="flex flex-col gap-2.5">
          <legend className="mb-2.5 text-sm font-medium">Goal</legend>
          <div className="flex flex-wrap gap-2">
            {AUTOPILOT_GOALS.map((g) => (
              <PillToggle key={g} pressed={goal === g} onClick={() => setGoal(g)}>
                {g}
              </PillToggle>
            ))}
          </div>
        </fieldset>

        <Field label="Describe it" hint="One or two sentences: the moment, the mood, and what viewers should do.">
          <Textarea value={brief} onChange={(e) => setBrief(e.target.value)} rows={3} required maxLength={500} />
        </Field>

        <div className="grid gap-7 sm:grid-cols-[1fr_auto]">
          <fieldset className="flex flex-col gap-3">
            <legend className="mb-3 text-sm font-medium">Formats</legend>
            <div className="flex flex-wrap gap-x-6 gap-y-3">
              {AUTOPILOT_FORMATS.map((f) => (
                <Checkbox
                  key={f.id}
                  label={f.label}
                  hint={f.hint}
                  checked={formats.includes(f.id)}
                  onCheckedChange={(on) => setFormats(on ? [...formats, f.id] : formats.filter((x) => x !== f.id))}
                />
              ))}
            </div>
            {formats.length === 0 && <p className="text-xs font-medium text-danger">Choose at least one format.</p>}
          </fieldset>
          <div className="flex flex-col gap-3">
            <span className="text-sm font-medium" id="length-l">
              Length
            </span>
            <SegmentedControl
              label="Length"
              value={String(length)}
              onValueChange={(v) => setLength(Number(v))}
              options={AUTOPILOT_LENGTHS.map((l) => ({ value: String(l), label: `${l}s` }))}
            />
          </div>
        </div>
      </div>

      {/* Summary: what you get and what it costs. Sticky on desktop, a bottom bar on phones. */}
      <aside aria-label="Summary" className="lg:sticky lg:top-24 lg:self-start">
        <div className="hidden flex-col gap-5 rounded-xl border border-line bg-surface p-5 lg:flex">
          <div className="relative aspect-[4/3] overflow-hidden rounded-lg">
            <MediaArt asset={getMedia("coast-sail")} />
            <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-media-veil/70 to-transparent" />
            <p className="absolute inset-x-4 bottom-4 font-display text-xl leading-tight font-semibold text-on-media">
              3 storyboard options, cut from your footage
            </p>
            <PlaceholderTag />
          </div>
          <CostLines credits={credits} formats={formats.length} length={length} videosLeft={videosLeft} />
          <Button type="submit" variant="action" size="lg" disabled={!canCreate}>
            Create 3 options <ArrowRight aria-hidden />
          </Button>
        </div>
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface px-4 pt-3 pb-[max(12px,env(safe-area-inset-bottom))] lg:hidden">
          <div className="mx-auto flex max-w-[1180px] items-center gap-3">
            <p className="min-w-0 flex-1 text-xs text-ink-muted">
              Previews free · <span className="font-medium text-ink">{credits} credit{credits === 1 ? "" : "s"}</span> when you approve
            </p>
            <Button type="submit" variant="action" disabled={!canCreate}>
              Create 3 options <ArrowRight aria-hidden />
            </Button>
          </div>
        </div>
      </aside>
    </form>
  );
}

function CostLines({ credits, formats, length, videosLeft }: { credits: number; formats: number; length: number; videosLeft: string }) {
  return (
    <dl className="flex flex-col gap-2.5 text-sm">
      <div className="flex justify-between gap-3">
        <dt className="text-ink-muted">Storyboard previews</dt>
        <dd className="font-medium text-success">Free</dd>
      </div>
      <div className="flex justify-between gap-3">
        <dt className="text-ink-muted">
          When you approve one
          <span className="block font-mono text-[11px]">
            1 video · {length}s · {formats} format{formats === 1 ? "" : "s"}
          </span>
        </dt>
        <dd className="font-mono font-medium">
          {credits} credit{credits === 1 ? "" : "s"}
        </dd>
      </div>
      <div className="flex justify-between gap-3 border-t border-line pt-2.5">
        <dt className="text-ink-muted">This month</dt>
        <dd className="font-mono text-xs">{videosLeft}</dd>
      </div>
    </dl>
  );
}

/* ---- Step 2: Creating --------------------------------------------------- */

function CreatingStep({ onDone, onBack }: { onDone: () => void; onBack: () => void }) {
  const [progress, setProgress] = useState(4);

  // Simulated progress for the design preview.
  useEffect(() => {
    const id = setInterval(() => setProgress((p) => Math.min(100, p + 1.5)), 110);
    return () => clearInterval(id);
  }, []);
  useEffect(() => {
    if (progress < 100) return;
    const t = setTimeout(onDone, 500);
    return () => clearTimeout(t);
  }, [progress, onDone]);

  const current = AUTOPILOT_STAGES.reduce((acc, s, i) => (progress >= s.at ? i : acc), 0);

  return (
    <div className="mx-auto flex w-full max-w-[460px] flex-1 flex-col items-center justify-center gap-8 py-6 text-center">
      <div className="relative grid size-64 place-items-center" aria-hidden>
        <div className="rd-motion absolute inset-0 rounded-full border border-dashed border-line-strong" style={{ animation: "rd-spin 22s linear infinite" }}>
          {["lake-kayak", "alpine-sunrise", "coast-sail"].map((id, i) => (
            <div
              key={id}
              className="absolute size-16 overflow-hidden rounded-xl shadow-float"
              style={{ left: `${50 + 50 * Math.cos((i * 2 * Math.PI) / 3)}%`, top: `${50 + 50 * Math.sin((i * 2 * Math.PI) / 3)}%`, transform: "translate(-50%, -50%)" }}
            >
              <MediaArt asset={getMedia(id as "lake-kayak")} />
            </div>
          ))}
        </div>
        <ProgressRing value={progress} label="Creating your options" size={150} stroke={10}>
          <span className="flex flex-col">
            <span className="font-display text-3xl font-semibold">{Math.round(progress)}%</span>
            <span className="font-mono text-[10px] text-ink-muted uppercase">Stage {current + 1}/4</span>
          </span>
        </ProgressRing>
      </div>

      <div className="flex flex-col gap-2">
        <h1 className="font-display text-3xl font-semibold tracking-tight">Building your video</h1>
        <p className="text-ink-muted">Usually under two minutes. You can leave this screen and we&apos;ll let you know when it&apos;s ready.</p>
      </div>

      <ProgressBar value={progress} label="Overall progress" tone="ai" />

      <ol className="flex w-full flex-col gap-1 text-left" aria-label="Stages">
        {AUTOPILOT_STAGES.map((s, i) => {
          const state = i < current || progress >= 100 ? "done" : i === current ? "now" : "next";
          return (
            <li key={s.label} className={cn("flex items-center gap-3 rounded-md px-3 py-2.5", state === "now" && "bg-surface")}>
              <span
                aria-hidden
                className={cn(
                  "inline-flex size-6 shrink-0 items-center justify-center rounded-full",
                  state === "done" && "bg-ink text-bg",
                  state === "now" && "bg-ai text-ai-foreground",
                  state === "next" && "border-[1.5px] border-line-strong",
                )}
              >
                {state === "done" && <Check className="size-3.5" />}
                {state === "now" && <span className="size-1.5 rounded-full bg-current" />}
              </span>
              <span className={cn("flex-1 text-sm", state === "now" && "font-semibold", state === "next" && "text-ink-muted")}>
                {state === "done" ? s.done : s.label}
                <span className="sr-only"> ({state === "done" ? "done" : state === "now" ? "in progress" : "waiting"})</span>
              </span>
              <span className="font-mono text-[11px] text-ink-muted">{state === "next" ? "—" : s.meta}</span>
            </li>
          );
        })}
      </ol>

      <div className="flex flex-col items-center gap-2">
        <p className="font-mono text-[11px] text-ink-muted">Design preview: progress is simulated, nothing is generated.</p>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft aria-hidden />
            Back to brief
          </Button>
          <Button variant="secondary" size="sm" onClick={onDone}>
            Skip to results
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ---- Step 3: Review ----------------------------------------------------- */

function ReviewStep({ credits, formats, length, onBack }: { credits: number; formats: string[]; length: number; onBack: () => void }) {
  const [selected, setSelected] = useState(0);
  const [changes, setChanges] = useState<string[]>([]);
  const [playing, setPlaying] = useState(false);
  const [pos, setPos] = useState(0);
  const option = AUTOPILOT_OPTIONS[selected];

  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => setPos((p) => (p >= 100 ? 0 : p + 0.5)), 50);
    return () => clearInterval(id);
  }, [playing]);

  const videosLeft = sampleUsageMeters().meters[0].value;
  const formatLabel = formats.join(" + ") || "9:16";

  return (
    <div className="grid flex-1 gap-8 pb-28 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)] lg:items-start lg:pb-0">
      {/* Player */}
      <div className="relative mx-auto aspect-[9/16] w-full max-w-[420px] overflow-hidden rounded-2xl bg-media-veil lg:sticky lg:top-24">
        <MediaArt asset={getMedia(option.media)} />
        <div aria-hidden className="absolute inset-0 bg-gradient-to-b from-media-veil/30 via-transparent to-media-veil/60" />
        <span className="absolute top-4 left-4 rounded-pill bg-media-veil/55 px-2.5 py-1 font-mono text-[10px] text-on-media">
          OPTION {selected + 1} · 0:{String(length).padStart(2, "0")} · {formats[0] ?? "9:16"}
        </span>
        <PlaceholderTag className="top-4 right-4 left-auto" />
        <p className="absolute inset-x-6 bottom-[22%] font-display text-[clamp(28px,4vw,40px)] leading-[1.02] font-bold tracking-tight text-on-media [text-shadow:0_2px_14px_rgb(0_0_0/0.4)]">
          {option.hook}
        </p>
        <button
          type="button"
          onClick={() => setPlaying((p) => !p)}
          aria-label={playing ? "Pause preview" : "Play preview"}
          className="absolute top-1/2 left-1/2 inline-flex size-16 -translate-1/2 items-center justify-center rounded-full bg-on-media/90 text-media-veil shadow-float"
        >
          {playing ? <Pause className="size-6 fill-current" aria-hidden /> : <Play className="ml-1 size-6 fill-current" aria-hidden />}
        </button>
        <div className="absolute inset-x-5 bottom-5 h-1 overflow-hidden rounded-pill bg-on-media/30" aria-hidden>
          <div className="h-full bg-ai" style={{ width: `${pos}%` }} />
        </div>
      </div>

      <div className="flex min-w-0 flex-col gap-7">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <Eyebrow>Step 3 of 3 · Review</Eyebrow>
            <AiBadge size="sm">3 options</AiBadge>
          </div>
          <h1 className="font-display text-[clamp(30px,3.6vw,44px)] leading-none font-semibold tracking-display">
            Pick your <em className="font-accent font-normal">favourite.</em>
          </h1>
          <p className="text-ink-muted">Each option uses your footage and the Lakeside Lodge brand. Previews are free.</p>
        </div>

        <div role="radiogroup" aria-label="Choose an option" className="grid grid-cols-3 gap-3">
          {AUTOPILOT_OPTIONS.map((o, i) => (
            <button
              key={o.id}
              type="button"
              role="radio"
              aria-checked={i === selected}
              onClick={() => {
                setSelected(i);
                setPos(0);
              }}
              onKeyDown={(e) => {
                if (e.key === "ArrowRight" || e.key === "ArrowDown") {
                  e.preventDefault();
                  setSelected((selected + 1) % AUTOPILOT_OPTIONS.length);
                } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
                  e.preventDefault();
                  setSelected((selected + AUTOPILOT_OPTIONS.length - 1) % AUTOPILOT_OPTIONS.length);
                }
              }}
              tabIndex={i === selected ? 0 : -1}
              className={cn(
                "flex flex-col gap-2 rounded-xl border bg-surface p-2 text-left transition-colors",
                i === selected ? "border-ink ring-2 ring-ink" : "border-line hover:border-line-strong",
              )}
            >
              <span className="relative aspect-[4/5] overflow-hidden rounded-lg">
                <MediaArt asset={getMedia(o.media)} />
              </span>
              <span className="px-1 pb-1">
                <span className="block text-sm font-semibold">
                  {i + 1} · {o.name}
                </span>
                <span className="hidden text-xs text-ink-muted sm:block">{o.mood}</span>
              </span>
            </button>
          ))}
        </div>

        <fieldset className="flex flex-col gap-2.5">
          <legend className="mb-2.5 text-sm font-medium">Ask for changes</legend>
          <div className="flex flex-wrap gap-2">
            {AUTOPILOT_CHANGES.map((c) => (
              <PillToggle key={c} size="sm" pressed={changes.includes(c)} onClick={() => setChanges((xs) => (xs.includes(c) ? xs.filter((x) => x !== c) : [...xs, c]))}>
                {c}
              </PillToggle>
            ))}
          </div>
        </fieldset>

        <div className="hidden flex-col gap-3 lg:flex">
          <ReviewActions credits={credits} formatLabel={formatLabel} videosLeft={videosLeft} optionName={option.name} changes={changes} index={selected} />
          <Button variant="ghost" size="sm" className="self-start" onClick={onBack}>
            <ArrowLeft aria-hidden />
            Edit the brief
          </Button>
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface px-4 pt-3 pb-[max(12px,env(safe-area-inset-bottom))] lg:hidden">
        <ReviewActions credits={credits} formatLabel={formatLabel} videosLeft={videosLeft} optionName={option.name} changes={changes} index={selected} compact />
      </div>
    </div>
  );
}

function ReviewActions(props: { credits: number; formatLabel: string; videosLeft: string; optionName: string; changes: string[]; index: number; compact?: boolean }) {
  const { credits, formatLabel, videosLeft, optionName, changes, index, compact } = props;
  const plural = credits === 1 ? "" : "s";
  return (
    <div className={cn("flex flex-col gap-2.5", compact && "mx-auto max-w-[1180px]")}>
      <Modal
        trigger={
          <Button variant="action" size={compact ? "md" : "lg"} className="w-full">
            Approve and export · {credits} credit{plural}
          </Button>
        }
        title={`Export option ${index + 1} · ${optionName}?`}
        description={`Uses ${credits} video credit${plural} (${formatLabel}). ${videosLeft} this month.`}
        footer={
          <>
            <ModalClose asChild>
              <Button variant="ghost">Cancel</Button>
            </ModalClose>
            <ModalClose asChild>
              <Button
                variant="action"
                onClick={() => toast({ title: "Design preview", description: "Nothing was exported or charged. Rendering arrives in Phase 4.", tone: "ai" })}
              >
                Export · {credits} credit{plural}
              </Button>
            </ModalClose>
          </>
        }
      >
        <ul className="flex flex-col gap-2 text-sm">
          <li className="flex justify-between">
            <span className="text-ink-muted">Formats</span>
            <span className="font-mono">{formatLabel}</span>
          </li>
          <li className="flex justify-between">
            <span className="text-ink-muted">Minor revisions</span>
            <span>Up to 3 included</span>
          </li>
          <li className="flex justify-between">
            <span className="text-ink-muted">If a render fails on our side</span>
            <span>Free re-render</span>
          </li>
        </ul>
      </Modal>
      <div className="grid grid-cols-2 gap-2.5">
        <Button
          variant="secondary"
          disabled={changes.length === 0}
          onClick={() => toast({ title: "Design preview", description: `Requested: ${changes.join(", ")}. Re-cutting arrives in Phase 5.`, tone: "ai" })}
        >
          Request changes
        </Button>
        <Button asChild variant="secondary">
          <Link href="/studio">
            <Clapperboard aria-hidden />
            Open in Studio
          </Link>
        </Button>
      </div>
    </div>
  );
}

