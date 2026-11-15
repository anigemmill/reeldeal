"use client";

import { AlertTriangle, ArrowLeft, ArrowRight, Check, Clapperboard, Loader2, Pause, Play, Sparkles, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { projectState, startProject, writeBrief, writeConcepts, writeStoryboard } from "@/app/(app)/_actions/creative";
import { Thumb } from "@/components/app/media/thumb";
import { RenderPanel } from "@/components/app/render/render-panel";
import { AiBadge, Badge, PillToggle } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/choice";
import { Field } from "@/components/ui/field";
import { Input, Textarea } from "@/components/ui/input";
import { Eyebrow } from "@/components/ui/misc";
import { Select } from "@/components/ui/select";
import { SegmentedControl } from "@/components/ui/tabs";
import { renderCredits } from "@/lib/pricing";
import { duration } from "@/lib/format";
import { cn } from "@/lib/utils";

/*
  Autopilot on the real platform (Phase 1 design, mobile-first): Brief → Creating → Review.
  Creating runs the shared creative services one step at a time; a stage shows as
  running exactly while its request is in flight (no simulated percentages). Review
  shows the saved concepts and storyboard; rendering goes through the server-quoted,
  confirmed flow in RenderPanel. Storyboard previews are free.
*/

export type AutopilotProps = {
  ai: { configured: boolean; provider: string | null; fixture: boolean };
  brands: { id: string; name: string; industry: string | null }[];
  footage: { id: string; title: string; duration_seconds: number | null; thumbnail_url?: string | null }[];
  credits: { available: number; label: string };
  canEdit: boolean;
  initial: { brief: string; mediaId: string | null; projectId: string | null };
};

type Step = "brief" | "creating" | "review";
const STEPS: { id: Step; label: string }[] = [
  { id: "brief", label: "Brief" },
  { id: "creating", label: "Creating" },
  { id: "review", label: "Review" },
];
const GOALS = ["Drive bookings", "Promote an offer", "Show the experience", "Seasonal update"] as const;
const FORMAT_OPTIONS = [
  { id: "9:16", hint: "Reels, TikTok, Stories" },
  { id: "1:1", hint: "Feed posts" },
  { id: "16:9", hint: "YouTube, website" },
  { id: "4:5", hint: "Portrait feed" },
] as const;
const LENGTHS = [15, 30, 60] as const;
const CHANGE_IDEAS = ["Make it shorter", "Warmer opening line", "Put the call to action earlier", "Less on-screen text"];

type Format = (typeof FORMAT_OPTIONS)[number]["id"];
type ProjectState = Extract<Awaited<ReturnType<typeof projectState>>, { ok: true }>["data"];

export function AutopilotScreen(props: AutopilotProps) {
  const router = useRouter();
  const [step, setStep] = useState<Step>(props.initial.projectId ? "review" : "brief");
  const [brief, setBrief] = useState(props.initial.brief);
  const [goal, setGoal] = useState<string>(GOALS[0]);
  const [audience, setAudience] = useState("");
  const [brandId, setBrandId] = useState(props.brands[0]?.id ?? "");
  const [media, setMedia] = useState<string[]>(props.initial.mediaId ? [props.initial.mediaId] : []);
  const [formats, setFormats] = useState<Format[]>(["9:16"]);
  const [length, setLength] = useState<number>(15);
  const [variants, setVariants] = useState(3);
  const [projectId, setProjectId] = useState<string | null>(props.initial.projectId);
  const [state, setState] = useState<ProjectState | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async (id: string) => {
    const r = await projectState(id);
    if (r.ok) setState(r.data);
    else setLoadError(r.error.message);
  }, []);
  useEffect(() => {
    if (!props.initial.projectId) return;
    let live = true;
    projectState(props.initial.projectId).then((r) => live && (r.ok ? setState(r.data) : setLoadError(r.error.message)));
    return () => {
      live = false;
    };
  }, [props.initial.projectId]);

  const credits = renderCredits({ seconds: length, formats: formats.length });

  return (
    <div className="flex min-h-dvh flex-col bg-bg text-ink">
      <header className="sticky top-0 z-30 border-b border-line bg-bg/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-[1180px] items-center gap-3 px-4 py-3 sm:px-6">
          <Link href="/dashboard" aria-label="Close Autopilot" className="inline-flex size-9 shrink-0 items-center justify-center rounded-md border border-line-strong bg-surface hover:bg-surface-muted">
            <X className="size-4" aria-hidden />
          </Link>
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <Sparkles className="size-4 shrink-0 text-ai" aria-hidden />
            <span className="font-display text-base font-semibold">Autopilot</span>
            {props.ai.fixture ? <Badge tone="warning">Test AI: fixture output, not real generation</Badge> : null}
          </div>
          <ol aria-label="Progress" className="flex items-center gap-1.5 font-mono text-[11px]">
            {STEPS.map((s, i) => {
              const idx = STEPS.findIndex((x) => x.id === step);
              const st = i < idx ? "done" : i === idx ? "now" : "next";
              return (
                <li key={s.id} aria-current={st === "now" ? "step" : undefined} className="flex items-center gap-1.5">
                  {i > 0 && <span aria-hidden className="h-px w-3 bg-line-strong sm:w-6" />}
                  <span className={cn("inline-flex h-6 items-center gap-1 rounded-pill px-2", st === "now" && "bg-ink text-bg", st === "done" && "bg-surface-muted text-ink", st === "next" && "text-ink-muted")}>
                    {st === "done" && <Check className="size-3" aria-hidden />}
                    <span className={cn(st !== "now" && "sr-only sm:not-sr-only")}>{s.label}</span>
                    <span className="sr-only">{st === "done" ? " (done)" : st === "next" ? " (next)" : ""}</span>
                  </span>
                </li>
              );
            })}
          </ol>
        </div>
      </header>

      <main id="main" className="mx-auto flex w-full max-w-[1180px] flex-1 flex-col px-4 py-6 sm:px-6 lg:py-10">
        {step === "brief" && (
          <BriefStep
            {...props}
            v={{ brief, goal, audience, brandId, media, formats, length, variants, credits }}
            set={{ setBrief, setGoal, setAudience, setBrandId, setMedia, setFormats, setLength, setVariants }}
            onCreate={() => setStep("creating")}
          />
        )}
        {step === "creating" && (
          <CreatingStep
            input={{ request: brief, objective: goal, audience, brand_id: brandId || undefined, media_ids: media, formats, duration_seconds: length, variants }}
            onBack={() => setStep("brief")}
            onDone={async (id) => {
              setProjectId(id);
              router.replace(`/autopilot?project=${id}`, { scroll: false });
              await load(id);
              setStep("review");
            }}
          />
        )}
        {step === "review" &&
          (loadError ? (
            <p role="alert" className="rounded-md bg-danger/10 px-4 py-3">
              {loadError} <Link href="/autopilot" className="underline">Start a new video</Link>
            </p>
          ) : !state || !projectId ? (
            <p role="status" className="flex items-center gap-2 text-ink-muted">
              <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden /> Loading your storyboard…
            </p>
          ) : (
            <ReviewStep state={state} canEdit={props.canEdit} aiConfigured={props.ai.configured} reload={() => load(projectId)} onNew={() => (router.replace("/autopilot"), setState(null), setProjectId(null), setStep("brief"))} />
          ))}
      </main>
    </div>
  );
}

/* ---- Step 1: Brief ---------------------------------------------------- */

function BriefStep(
  props: AutopilotProps & {
    v: { brief: string; goal: string; audience: string; brandId: string; media: string[]; formats: Format[]; length: number; variants: number; credits: number };
    set: { setBrief: (v: string) => void; setGoal: (v: string) => void; setAudience: (v: string) => void; setBrandId: (v: string) => void; setMedia: (v: string[]) => void; setFormats: (v: Format[]) => void; setLength: (v: number) => void; setVariants: (v: number) => void };
    onCreate: () => void;
  },
) {
  const { v, set } = props;
  const [touched, setTouched] = useState(false);
  const briefError = v.brief.trim().length < 10 ? "Describe the video in at least a few words (10+ characters)." : null;
  const formatError = v.formats.length === 0 ? "Choose at least one format." : null;
  const blocked = !props.ai.configured ? "AI generation isn't configured on this server yet." : !props.canEdit ? "Your role can't create videos in this workspace." : null;
  const canCreate = !briefError && !formatError && !blocked;
  const toggle = (id: string) => set.setMedia(v.media.includes(id) ? v.media.filter((x) => x !== id) : v.media.length >= 12 ? v.media : [...v.media, id]);

  return (
    <form
      noValidate
      className="grid gap-8 pb-24 lg:grid-cols-[minmax(0,1fr)_360px] lg:pb-0"
      onSubmit={(e) => {
        e.preventDefault();
        setTouched(true);
        if (canCreate) props.onCreate();
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
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 id="footage-h" className="text-sm font-semibold">
              {v.media.length ? `${v.media.length} clip${v.media.length === 1 ? "" : "s"} selected` : "Footage"}
            </h2>
            <Link href="/library" className="text-sm text-link underline-offset-4 hover:underline">
              Upload more
            </Link>
          </div>
          {props.footage.length ? (
            <>
              <ul className="grid grid-cols-4 gap-2 sm:grid-cols-6" aria-label="Your analysed footage">
                {props.footage.map((f) => {
                  const on = v.media.includes(f.id);
                  return (
                    <li key={f.id}>
                      <button type="button" aria-pressed={on} onClick={() => toggle(f.id)} className={cn("relative block w-full overflow-hidden rounded-md ring-offset-2 ring-offset-surface", on && "ring-2 ring-primary")} title={f.title}>
                        <Thumb src={f.thumbnail_url} alt={f.title} ratio="4:5" className="rounded-md" />
                        {on ? (
                          <span className="absolute top-1 right-1 inline-flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                            <Check className="size-3" aria-hidden />
                          </span>
                        ) : null}
                        <span className="sr-only">{f.title}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
              <p className="text-xs text-ink-muted">{v.media.length ? "Autopilot will build from these clips first." : "None selected: Autopilot chooses from your whole analysed library."}</p>
            </>
          ) : (
            <p className="text-sm text-ink-muted">
              No analysed footage yet. <Link href="/library" className="text-link underline">Upload clips</Link> first, or continue and Autopilot will plan text-only scenes you can fill later.
            </p>
          )}
        </section>

        {props.brands.length ? (
          <Field label="Brand">
            <Select options={props.brands.map((b) => ({ value: b.id, label: b.name }))} value={v.brandId} onValueChange={set.setBrandId} />
          </Field>
        ) : (
          <p className="text-sm text-ink-muted">
            No brand profile yet. <Link href="/brands" className="text-link underline">Add one</Link> so videos use your voice and colours.
          </p>
        )}

        <fieldset className="flex flex-col gap-2.5">
          <legend className="mb-2.5 text-sm font-medium">Goal</legend>
          <div className="flex flex-wrap gap-2">
            {GOALS.map((g) => (
              <PillToggle key={g} pressed={v.goal === g} onClick={() => set.setGoal(g)}>
                {g}
              </PillToggle>
            ))}
          </div>
        </fieldset>

        <Field label="Describe it" hint="The moment, the mood, and what viewers should do." error={touched ? briefError : undefined}>
          <Textarea value={v.brief} onChange={(e) => set.setBrief(e.target.value)} rows={3} required maxLength={2000} />
        </Field>

        <Field label="Audience (optional)" hint="Who should this reach? Leave blank to let the brief suggest one.">
          <Input value={v.audience} onChange={(e) => set.setAudience(e.target.value)} maxLength={300} placeholder="e.g. Couples from Auckland planning a weekend away" />
        </Field>

        <div className="grid gap-7 sm:grid-cols-[1fr_auto]">
          <fieldset className="flex flex-col gap-3">
            <legend className="mb-3 text-sm font-medium">Formats</legend>
            <div className="flex flex-wrap gap-x-6 gap-y-3">
              {FORMAT_OPTIONS.map((f) => (
                <Checkbox key={f.id} label={f.id} hint={f.hint} checked={v.formats.includes(f.id)} onCheckedChange={(on) => set.setFormats(on ? [...v.formats, f.id] : v.formats.filter((x) => x !== f.id))} />
              ))}
            </div>
            {formatError ? <p className="text-xs font-medium text-danger">{formatError}</p> : null}
          </fieldset>
          <div className="flex flex-col gap-5">
            <div className="flex flex-col gap-3">
              <span className="text-sm font-medium">Length</span>
              <SegmentedControl label="Length" value={String(v.length)} onValueChange={(x) => set.setLength(Number(x))} options={LENGTHS.map((l) => ({ value: String(l), label: `${l}s` }))} />
            </div>
            <div className="flex flex-col gap-3">
              <span className="text-sm font-medium">Concepts to compare</span>
              <SegmentedControl label="Concepts to compare" value={String(v.variants)} onValueChange={(x) => set.setVariants(Number(x))} options={[1, 2, 3].map((n) => ({ value: String(n), label: String(n) }))} />
            </div>
          </div>
        </div>
      </div>

      <aside aria-label="Summary" className="lg:sticky lg:top-24 lg:self-start">
        <div className="hidden flex-col gap-5 rounded-xl border border-line bg-surface p-5 lg:flex">
          <p className="font-display text-xl leading-tight font-semibold">
            {v.variants} concept{v.variants === 1 ? "" : "s"} and a storyboard, from your footage
          </p>
          <CostLines credits={v.credits} formats={v.formats.length} length={v.length} available={props.credits} />
          <p className="text-[11px] leading-relaxed text-ink-muted">The exact cost is confirmed from the final storyboard before anything renders.</p>
          {blocked ? <p className="rounded-md bg-surface-muted px-3 py-2 text-sm text-ink-muted">{blocked}</p> : null}
          <Button type="submit" variant="action" size="lg" disabled={Boolean(blocked)}>
            Create {v.variants === 1 ? "storyboard" : `${v.variants} concepts`} <ArrowRight aria-hidden />
          </Button>
        </div>
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface px-4 pt-3 pb-[max(12px,env(safe-area-inset-bottom))] lg:hidden">
          <div className="mx-auto flex max-w-[1180px] items-center gap-3">
            <p className="min-w-0 flex-1 text-xs text-ink-muted">
              Previews free · <span className="font-medium text-ink">{v.credits} credit{v.credits === 1 ? "" : "s"}</span> when you approve
            </p>
            <Button type="submit" variant="action" disabled={Boolean(blocked)}>
              Create <ArrowRight aria-hidden />
            </Button>
          </div>
        </div>
      </aside>
    </form>
  );
}

function CostLines({ credits, formats, length, available }: { credits: number; formats: number; length: number; available: { available: number; label: string } }) {
  return (
    <dl className="flex flex-col gap-2.5 text-sm">
      <div className="flex justify-between gap-3">
        <dt className="text-ink-muted">Brief, concepts and storyboard</dt>
        <dd className="font-medium text-success">Free</dd>
      </div>
      <div className="flex justify-between gap-3">
        <dt className="text-ink-muted">
          When you approve and render
          <span className="block font-mono text-[11px]">
            1 video · up to {length}s · {formats} format{formats === 1 ? "" : "s"}
          </span>
        </dt>
        <dd className="font-mono font-medium">
          {credits} credit{credits === 1 ? "" : "s"}
        </dd>
      </div>
      <div className="flex justify-between gap-3 border-t border-line pt-2.5">
        <dt className="text-ink-muted">{available.label}</dt>
        <dd className="font-mono text-xs">{available.available} available</dd>
      </div>
    </dl>
  );
}

/* ---- Step 2: Creating (real requests, one stage at a time) ---------------- */

type StageId = "project" | "brief" | "concepts" | "storyboard";
type StageState = "waiting" | "running" | "done" | "failed";

function CreatingStep({ input, onBack, onDone }: { input: { request: string; objective: string; audience: string; brand_id?: string; media_ids: string[]; formats: Format[]; duration_seconds: number; variants: number }; onBack: () => void; onDone: (projectId: string) => void }) {
  const stages: { id: StageId; label: string; done: string }[] = [
    { id: "project", label: "Setting up your project", done: "Project saved" },
    { id: "brief", label: "Understanding your brief and footage", done: "Brief written" },
    { id: "concepts", label: `Developing ${input.variants} concept${input.variants === 1 ? "" : "s"}`, done: `${input.variants} concept${input.variants === 1 ? "" : "s"} ready` },
    { id: "storyboard", label: "Building your storyboard", done: "Storyboard saved" },
  ];
  const [status, setStatus] = useState<Record<StageId, StageState>>({ project: "waiting", brief: "waiting", concepts: "waiting", storyboard: "waiting" });
  const [error, setError] = useState<{ stage: StageId; message: string } | null>(null);
  const [started, setStarted] = useState<number>(0);
  const [now, setNow] = useState(0);
  const ids = useRef<{ project?: string; brief?: string; concepts?: string }>({});
  const ran = useRef(false);

  const run = useCallback(async () => {
    setError(null);
    const step = async (id: StageId, fn: () => Promise<{ ok: true; data: unknown } | { ok: false; error: { message: string } }>) => {
      setStatus((s) => ({ ...s, [id]: "running" }));
      setStarted(Date.now());
      const r = await fn();
      if (!r.ok) {
        setStatus((s) => ({ ...s, [id]: "failed" }));
        setError({ stage: id, message: r.error.message });
        throw new Error("stopped");
      }
      setStatus((s) => ({ ...s, [id]: "done" }));
      return r.data as Record<string, unknown>;
    };
    try {
      if (!ids.current.project) ids.current.project = (await step("project", () => startProject(input))).project_id as string;
      if (!ids.current.brief) ids.current.brief = (await step("brief", () => writeBrief(ids.current.project!, input.request))).brief_id as string;
      if (!ids.current.concepts) ids.current.concepts = (await step("concepts", () => writeConcepts(ids.current.brief!, input.variants))).concepts_id as string;
      await step("storyboard", () => writeStoryboard({ project_id: ids.current.project!, brief_id: ids.current.brief, concepts_id: ids.current.concepts, concept_index: 0 }));
      onDone(ids.current.project!);
    } catch {
      /* the failed stage is shown with a retry */
    }
  }, [input, onDone]);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    void run();
  }, [run]);
  const running = Object.values(status).includes("running");
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, [running]);

  return (
    <div className="mx-auto flex w-full max-w-[460px] flex-1 flex-col items-center justify-center gap-8 py-6 text-center">
      <div className="flex flex-col items-center gap-3">
        {error ? <AlertTriangle className="size-10 text-danger" aria-hidden /> : <Loader2 className="size-10 animate-spin text-ai motion-reduce:animate-none" aria-hidden />}
        <h1 className="font-display text-3xl font-semibold tracking-tight">{error ? "Something stopped" : "Building your storyboard"}</h1>
        <p className="text-ink-muted">{error ? "Nothing was charged. You can try that step again." : "Each step is a real AI request using your brief, brand and footage details (never the footage itself). Usually under a minute."}</p>
      </div>
      <ol className="flex w-full flex-col gap-1 text-left" aria-label="Stages" aria-live="polite">
        {stages.map((s) => {
          const st = status[s.id];
          return (
            <li key={s.id} className={cn("flex items-center gap-3 rounded-md px-3 py-2.5", st === "running" && "bg-surface")}>
              <span aria-hidden className={cn("inline-flex size-6 shrink-0 items-center justify-center rounded-full", st === "done" && "bg-ink text-bg", st === "running" && "bg-ai text-ai-foreground", st === "failed" && "bg-danger text-danger-foreground", st === "waiting" && "border-[1.5px] border-line-strong")}>
                {st === "done" ? <Check className="size-3.5" /> : st === "failed" ? <X className="size-3.5" /> : st === "running" ? <span className="size-1.5 rounded-full bg-current" /> : null}
              </span>
              <span className={cn("flex-1 text-sm", st === "running" && "font-semibold", st === "waiting" && "text-ink-muted")}>
                {st === "done" ? s.done : s.label}
                <span className="sr-only"> ({st === "running" ? "in progress" : st})</span>
              </span>
              <span className="font-mono text-[11px] text-ink-muted">{st === "running" && now > started ? `${Math.max(0, Math.round((now - started) / 1000))}s` : ""}</span>
            </li>
          );
        })}
      </ol>
      {error ? (
        <div className="flex w-full flex-col gap-3">
          <p role="alert" className="rounded-md bg-danger/10 px-3.5 py-2.5 text-left text-sm">
            {error.message}
          </p>
          <div className="flex justify-center gap-2">
            <Button variant="ghost" size="sm" onClick={onBack}>
              <ArrowLeft aria-hidden /> Back to brief
            </Button>
            <Button variant="primary" size="sm" onClick={() => void run()}>
              Try again
            </Button>
          </div>
        </div>
      ) : (
        <Button variant="ghost" size="sm" onClick={onBack} disabled={running}>
          <ArrowLeft aria-hidden /> Back to brief
        </Button>
      )}
    </div>
  );
}

/* ---- Step 3: Review ----------------------------------------------------- */

type Scene = { scene_number: number; duration_seconds: number; purpose: string | null; on_screen_text: string | null; voiceover: string | null; visual_description: string | null; asset_id: string | null; asset_title?: string; transition: string };
type Concept = { title: string; creative_angle: string; hook: string; narrative: string; call_to_action: string };

function ReviewStep({ state, canEdit, aiConfigured, reload, onNew }: { state: ProjectState; canEdit: boolean; aiConfigured: boolean; reload: () => Promise<void>; onNew: () => void }) {
  const { project, thumbnails } = state;
  const sb = project.storyboard;
  const scenes = (sb?.scenes ?? []) as Scene[];
  const concepts = ((project.latest_concepts?.concepts ?? []) as Concept[]).slice(0, 5);
  const brief = project.latest_briefs[0]?.brief as { key_message?: string; call_to_action?: string; audience?: string; tone?: string; assumptions?: { field: string; assumption: string }[]; missing_information?: string[] } | undefined;
  const [concept, setConcept] = useState(0);
  const [change, setChange] = useState("");
  const [busy, setBusy] = useState<"concept" | "change" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const lastRender = project.renders[0] as { job_id: string; status: string; stage: string | null; progress_percent: number; error: { message: string; retryable: boolean } | null } | undefined;
  const renderable = scenes.length > 0 && scenes.every((s) => s.asset_id || s.on_screen_text);
  const total = scenes.reduce((a, s) => a + s.duration_seconds, 0);

  const rebuild = async (kind: "concept" | "change") => {
    setBusy(kind);
    setError(null);
    const r =
      kind === "concept"
        ? await writeStoryboard({ project_id: project.id, brief_id: project.latest_briefs[0]?.id, concepts_id: project.latest_concepts?.id, concept_index: concept })
        : await writeStoryboard({ project_id: project.id, base_storyboard_id: sb?.id, direction: change });
    if (!r.ok) setError(r.error.message);
    else {
      setChange("");
      await reload();
    }
    setBusy(null);
  };

  if (!sb) {
    return (
      <div className="flex flex-col items-start gap-3">
        <p>This project has no storyboard yet.</p>
        <Button onClick={onNew}>Start a new video</Button>
      </div>
    );
  }

  return (
    <div className="grid flex-1 gap-8 pb-10 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)] lg:items-start">
      <StoryboardPlayer scenes={scenes} thumbnails={thumbnails} format={sb.format} />

      <div className="flex min-w-0 flex-col gap-7">
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <Eyebrow>Step 3 of 3 · Review</Eyebrow>
            <AiBadge size="sm">Storyboard v{sb.version}</AiBadge>
          </div>
          <h1 className="font-display text-[clamp(30px,3.6vw,44px)] leading-none font-semibold tracking-display">{sb.title}</h1>
          <p className="text-ink-muted">
            {sb.format} · {duration(total)} · {scenes.length} scenes{project.brand ? ` · ${project.brand.name} brand` : ""}. Previews are free; nothing renders until you confirm the credits.
          </p>
        </div>

        {concepts.length > 1 ? (
          <section aria-labelledby="concepts-h" className="flex flex-col gap-3">
            <h2 id="concepts-h" className="text-sm font-medium">
              Concepts
            </h2>
            <div role="radiogroup" aria-label="Choose a concept" className="grid gap-3 sm:grid-cols-3">
              {concepts.map((c, i) => (
                <button key={i} type="button" role="radio" aria-checked={i === concept} onClick={() => setConcept(i)} className={cn("flex flex-col gap-1 rounded-xl border bg-surface p-3 text-left text-sm", i === concept ? "border-ink ring-2 ring-ink" : "border-line hover:border-line-strong")}>
                  <span className="font-semibold">
                    {i + 1} · {c.title}
                  </span>
                  <span className="text-xs text-ink-muted">{c.creative_angle}</span>
                  <span className="text-xs">&ldquo;{c.hook}&rdquo;</span>
                </button>
              ))}
            </div>
            {canEdit && aiConfigured ? (
              <Button variant="secondary" size="sm" className="w-fit" loading={busy === "concept"} onClick={() => rebuild("concept")}>
                Build storyboard for concept {concept + 1} · free
              </Button>
            ) : null}
          </section>
        ) : null}

        <section aria-labelledby="scenes-h" className="flex flex-col gap-2">
          <h2 id="scenes-h" className="text-sm font-medium">
            Scenes
          </h2>
          <ol className="flex flex-col divide-y divide-line rounded-xl border border-line bg-surface">
            {scenes.map((s) => (
              <li key={s.scene_number} className="flex gap-3 p-3">
                <Thumb src={s.asset_id ? thumbnails[s.asset_id] : null} alt="" ratio="16:9" className="w-24 shrink-0" />
                <div className="flex min-w-0 flex-1 flex-col gap-0.5 text-sm">
                  <span className="font-mono text-[11px] text-ink-muted">
                    SCENE {s.scene_number} · {s.duration_seconds}s · {s.asset_title ?? (s.asset_id ? "clip" : "brand card")} · {s.transition}
                  </span>
                  {s.on_screen_text ? <span className="font-semibold">&ldquo;{s.on_screen_text}&rdquo;</span> : null}
                  {s.visual_description ? <span className="text-ink-muted">{s.visual_description}</span> : null}
                  {s.voiceover ? <span className="text-xs">Voiceover (script only, not recorded): {s.voiceover}</span> : null}
                </div>
              </li>
            ))}
          </ol>
        </section>

        {brief ? (
          <details className="rounded-xl border border-line bg-surface p-4 text-sm">
            <summary className="cursor-pointer font-medium">The brief behind it</summary>
            <dl className="mt-3 flex flex-col gap-1.5">
              {brief.key_message ? <Row k="Key message" v={brief.key_message} /> : null}
              {brief.audience ? <Row k="Audience" v={brief.audience} /> : null}
              {brief.tone ? <Row k="Tone" v={brief.tone} /> : null}
              {brief.call_to_action ? <Row k="Call to action" v={brief.call_to_action} /> : null}
            </dl>
            {brief.assumptions?.length ? (
              <p className="mt-3 text-ink-muted">Assumed: {brief.assumptions.map((a) => a.assumption).join("; ")}</p>
            ) : null}
            {brief.missing_information?.length ? <p className="mt-1 text-ink-muted">Worth telling us: {brief.missing_information.join("; ")}</p> : null}
          </details>
        ) : null}

        {canEdit && aiConfigured ? (
          <section aria-labelledby="changes-h" className="flex flex-col gap-2.5">
            <h2 id="changes-h" className="text-sm font-medium">
              Ask for changes
            </h2>
            <div className="flex flex-wrap gap-2">
              {CHANGE_IDEAS.map((c) => (
                <PillToggle key={c} size="sm" pressed={change === c} onClick={() => setChange(change === c ? "" : c)}>
                  {c}
                </PillToggle>
              ))}
            </div>
            <div className="flex gap-2">
              <Input aria-label="Describe the change" value={change} onChange={(e) => setChange(e.target.value)} maxLength={500} placeholder="e.g. Open on the kayak, end on the lodge" />
              <Button variant="secondary" disabled={change.trim().length < 3} loading={busy === "change"} onClick={() => rebuild("change")}>
                Revise · free
              </Button>
            </div>
            <p className="text-xs text-ink-muted">Revisions are saved as new storyboard versions; earlier versions stay in Studio.</p>
          </section>
        ) : null}
        {error ? (
          <p role="alert" className="rounded-md bg-danger/10 px-3.5 py-2.5 text-sm">
            {error}
          </p>
        ) : null}

        <div className="flex flex-col gap-3">
          <RenderPanel key={sb.id} projectId={project.id} storyboardId={sb.id} renderable={renderable} canRender={canEdit} initialJob={lastRender && (lastRender.status === "queued" || lastRender.status === "running") ? lastRender : null} onFinished={reload} />
          <div className="grid grid-cols-2 gap-2.5">
            <Button asChild variant="secondary">
              <Link href={`/studio?project=${project.id}`}>
                <Clapperboard aria-hidden /> Open in Studio
              </Link>
            </Button>
            <Button variant="secondary" onClick={onNew}>
              New video
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex gap-3">
      <dt className="w-32 shrink-0 text-ink-muted">{k}</dt>
      <dd>{v}</dd>
    </div>
  );
}

/* A storyboard preview (an animatic of keyframes and on-screen text), clearly not the rendered video. */
export function StoryboardPlayer({ scenes, thumbnails, format }: { scenes: Scene[]; thumbnails: Record<string, string | null>; format: string }) {
  const [i, setI] = useState(0);
  const [playing, setPlaying] = useState(false);
  const scene = scenes[Math.min(i, scenes.length - 1)];
  useEffect(() => {
    if (!playing || !scene) return;
    const t = setTimeout(() => (i + 1 < scenes.length ? setI(i + 1) : (setPlaying(false), setI(0))), scene.duration_seconds * 1000);
    return () => clearTimeout(t);
  }, [playing, i, scene, scenes.length]);
  const aspect = useMemo(() => ({ "9:16": "aspect-[9/16]", "1:1": "aspect-square", "16:9": "aspect-video", "4:5": "aspect-[4/5]" })[format] ?? "aspect-[9/16]", [format]);
  if (!scene) return null;
  const src = scene.asset_id ? thumbnails[scene.asset_id] : null;
  return (
    <div className={cn("relative mx-auto w-full max-w-[420px] overflow-hidden rounded-2xl bg-primary lg:sticky lg:top-24", aspect)}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element -- signed keyframe URL
        <img src={src} alt="" className="absolute inset-0 size-full object-cover" />
      ) : null}
      <div aria-hidden className="absolute inset-0 bg-gradient-to-b from-media-veil/30 via-transparent to-media-veil/60" />
      <span className="absolute top-4 left-4 rounded-pill bg-media-veil/55 px-2.5 py-1 font-mono text-[10px] text-on-media">
        STORYBOARD PREVIEW · SCENE {scene.scene_number}/{scenes.length} · {format}
      </span>
      {scene.on_screen_text ? (
        <p className="absolute inset-x-6 bottom-[22%] font-display text-[clamp(24px,3.5vw,36px)] leading-[1.05] font-bold tracking-tight text-on-media [text-shadow:0_2px_14px_rgb(0_0_0/0.4)]">{scene.on_screen_text}</p>
      ) : null}
      <button type="button" onClick={() => setPlaying((p) => !p)} aria-label={playing ? "Pause storyboard preview" : "Play storyboard preview"} className="absolute top-1/2 left-1/2 inline-flex size-16 -translate-1/2 items-center justify-center rounded-full bg-on-media/90 text-media-veil shadow-float">
        {playing ? <Pause className="size-6 fill-current" aria-hidden /> : <Play className="ml-1 size-6 fill-current" aria-hidden />}
      </button>
      <div className="absolute inset-x-5 bottom-5 flex gap-1" aria-hidden>
        {scenes.map((s, k) => (
          <span key={k} className={cn("h-1 rounded-pill", k <= i ? "bg-ai" : "bg-on-media/30")} style={{ flex: s.duration_seconds }} />
        ))}
      </div>
      <p className="absolute inset-x-0 bottom-8 text-center font-mono text-[10px] text-on-media/80">Keyframes only · the rendered MP4 appears after you approve</p>
    </div>
  );
}
