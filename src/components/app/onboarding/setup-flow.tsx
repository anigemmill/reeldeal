"use client";

import { Check, FileText, ImagePlus, Loader2, RotateCw, Sparkles, Upload, Users, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { recordStepAction, saveBrandStepAction, savePreferencesStepAction, setBrandLogoAction } from "@/app/(app)/_actions/onboarding";
import { Logo } from "@/components/brand/logo";
import { PillToggle } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/choice";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { SegmentedControl } from "@/components/ui/tabs";
import { NEW_BRAND_COLOUR_HEX } from "@/content/brand-defaults";
import { cn } from "@/lib/utils";
import { ACCEPT_ATTR, uploadSmallFile, useUploads } from "../library/use-uploads";
import { perform } from "../settings/live";
import { Footer, NextCard, Step } from "./onboarding-flow";

/*
  Onboarding steps 4–7 for a REAL workspace (/onboarding/setup). Steps 1–3 (account, email,
  workspace and business details) happen before this. Every step saves to the workspace and
  records progress, so leaving and coming back (any device) resumes at the next step. Brand,
  assets and preferences can be skipped and finished later in Settings. Same look as the
  design review flow (onboarding-flow.tsx), with real data and actions.
*/
export type SetupStep = "brand" | "assets" | "preferences" | "done";
export type SetupData = {
  workspace: string;
  planName: string;
  trialVideos: number | null;
  brand: { id: string; name: string; colours: string[]; voice: string; audience: string; hasLogo: boolean } | null;
  prefs: { mode: "workspace" | "studio"; format: "9:16" | "1:1" | "16:9" | "4:5"; aiConsent: boolean; emailWhenReady: boolean };
};

const ORDER: SetupStep[] = ["brand", "assets", "preferences", "done"];
const LABEL: Record<SetupStep, string> = { brand: "Brand", assets: "Logo and assets", preferences: "Preferences", done: "Done" };
/** Position in the seven-step journey shown on the progress bar (account, workspace, business come first). */
const POSITION = { brand: 4, assets: 5, preferences: 6, done: 7 } as const;
const TONES = ["Warm", "Calm", "Adventurous", "Playful", "Premium", "Down-to-earth", "Professional", "Bold"];
const HEX = /^#[0-9a-f]{6}$/i;

export function SetupFlow({ initialStep, data }: { initialStep: SetupStep; data: SetupData }) {
  const [step, setStep] = useState<SetupStep>(initialStep);
  const [summary, setSummary] = useState<string[]>([]);
  const next = () => setStep(ORDER[Math.min(ORDER.length - 1, ORDER.indexOf(step) + 1)]!);
  const back = () => setStep(ORDER[Math.max(0, ORDER.indexOf(step) - 1)]!);
  const note = (s: string) => setSummary((cur) => [...cur.filter((x) => x.split(":")[0] !== s.split(":")[0]), s]);

  return (
    <main id="main" className="flex min-h-dvh flex-col items-center bg-bg px-4 py-8 sm:py-12">
      <div className="flex w-full max-w-[600px] flex-col gap-6">
        <div className="flex items-center justify-between gap-3">
          <Link href="/dashboard" aria-label="Reeldeal dashboard" className="rounded-sm px-1.5 py-1">
            <Logo size="sm" />
          </Link>
          {step !== "done" ? (
            <Link href="/dashboard" className="text-sm text-ink-muted underline-offset-4 hover:underline">
              Finish later
            </Link>
          ) : null}
        </div>

        {step !== "done" ? (
          <nav aria-label="Setup progress" className="flex flex-col gap-2.5">
            <p className="flex justify-between font-mono text-[11px] tracking-label text-ink-muted uppercase">
              <span>Step {POSITION[step]} of 7</span>
              <span>{LABEL[step]}</span>
            </p>
            <ol className="flex gap-1.5">
              {Array.from({ length: 7 }, (_, n) => (
                <li key={n} className="flex-1">
                  <span className={cn("block h-1.5 rounded-pill", n + 1 < POSITION[step] ? "bg-primary" : n + 1 === POSITION[step] ? "bg-primary/60" : "bg-line")} />
                  <span className="sr-only">{n + 1 < POSITION[step] ? "done" : n + 1 === POSITION[step] ? "current step" : "to do"}</span>
                </li>
              ))}
            </ol>
          </nav>
        ) : null}

        <section aria-labelledby="step-title" className="flex flex-col gap-6 rounded-2xl border border-line bg-surface p-6 shadow-card sm:p-8">
          {step === "brand" ? <BrandStep data={data} onDone={(s) => (s && note(s), next())} /> : null}
          {step === "assets" ? <AssetsStep data={data} onBack={back} onDone={(s) => (s.forEach(note), next())} /> : null}
          {step === "preferences" ? <PreferencesStep data={data} onBack={back} onDone={(s) => (s.forEach(note), next())} /> : null}
          {step === "done" ? <DoneStep data={data} summary={summary} /> : null}
        </section>
      </div>
    </main>
  );
}

function BrandStep({ data, onDone }: { data: SetupData; onDone: (summary?: string) => void }) {
  const b = data.brand;
  const [name, setName] = useState(b?.name ?? data.workspace);
  const [colours, setColours] = useState<string[]>(b?.colours.length ? b.colours.slice(0, 6) : [NEW_BRAND_COLOUR_HEX]);
  const [tones, setTones] = useState<string[]>(b?.voice ? TONES.filter((t) => b.voice.toLowerCase().includes(t.toLowerCase())) : []);
  const [audience, setAudience] = useState(b?.audience ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const save = async () => {
    if (!b) return onDone();
    if (!name.trim()) return setError("Give your brand a name.");
    if (colours.some((c) => !HEX.test(c))) return setError("Each colour must be a hex value like #2038E2.");
    setError(null);
    setSaving(true);
    const voice = tones.length ? `${tones.join(", ")}.` : undefined;
    const r = await perform(
      saveBrandStepAction(b.id, {
        name: name.trim(),
        colours: colours.map((hex, n) => ({ name: n === 0 ? "Primary" : `Colour ${n + 1}`, hex: hex.toUpperCase() })),
        voice,
        audiences: audience.trim() ? [audience.trim()] : [],
      }),
      "Brand saved",
    );
    setSaving(false);
    if (r) onDone(`Brand profile: ${colours.length} colour${colours.length === 1 ? "" : "s"}${tones.length ? `, ${tones.join(" and ").toLowerCase()} voice` : ""}`);
  };
  const skip = async () => (await perform(recordStepAction("brand"))) && onDone();
  return (
    <Step title="Set up your" accent="brand." intro="So every video looks and sounds like you. Start simple: you can add more detail later in Brand profiles.">
      <Field label="Brand name" error={error && !name.trim() ? error : undefined}>
        <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} autoComplete="organization" />
      </Field>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium">Brand colours</legend>
        <div className="flex flex-wrap gap-2.5">
          {colours.map((c, n) => (
            <span key={n} className="flex items-center gap-2 rounded-md border border-line bg-surface py-1.5 pr-1.5 pl-1.5">
              <input type="color" value={HEX.test(c) ? c : "#000000"} onChange={(e) => setColours((cs) => cs.map((x, k) => (k === n ? e.target.value : x)))} aria-label={`Colour ${n + 1}`} className="size-8 cursor-pointer rounded border-0 bg-transparent p-0" />
              <span className="font-mono text-xs uppercase">{c}</span>
              {colours.length > 1 ? (
                <button type="button" onClick={() => setColours((cs) => cs.filter((_, k) => k !== n))} aria-label={`Remove colour ${n + 1}`} className="inline-flex size-7 items-center justify-center rounded text-ink-muted hover:bg-surface-muted">
                  <X className="size-3.5" aria-hidden />
                </button>
              ) : null}
            </span>
          ))}
          {colours.length < 6 ? (
            <Button variant="ghost" size="sm" onClick={() => setColours((cs) => [...cs, NEW_BRAND_COLOUR_HEX])}>
              + Add colour
            </Button>
          ) : null}
        </div>
        <p className="text-xs text-ink-muted">Fonts and detailed guidelines live in Brand profiles.</p>
      </fieldset>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium">Tone of voice</legend>
        <div className="flex flex-wrap gap-2">
          {TONES.map((t) => (
            <PillToggle key={t} size="sm" pressed={tones.includes(t)} onClick={() => setTones((cur) => (cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t]))}>
              {t}
            </PillToggle>
          ))}
        </div>
      </fieldset>
      <Field label="Who are your customers? (optional)">
        <Input value={audience} onChange={(e) => setAudience(e.target.value)} maxLength={200} placeholder="e.g. couples on a road trip" />
      </Field>
      {error && name.trim() ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
      {!b ? <p className="text-sm text-ink-muted">This workspace has no brand profile yet. Create one any time in Brand profiles.</p> : null}
      <Footer onNext={save} onSkip={skip} next={saving ? "Saving…" : "Continue"} />
    </Step>
  );
}

type FileState = { phase: "idle" | "uploading" | "done" | "failed"; name?: string; error?: string };

function AssetsStep({ data, onBack, onDone }: { data: SetupData; onBack: () => void; onDone: (summary: string[]) => void }) {
  const [logo, setLogo] = useState<FileState>(data.brand?.hasLogo ? { phase: "done", name: "Logo already uploaded" } : { phase: "idle" });
  const [guide, setGuide] = useState<FileState>({ phase: "idle" });
  const uploads = useUploads(() => {});
  const busy = logo.phase === "uploading" || guide.phase === "uploading" || uploads.active;
  // Interrupted uploads: warn before the tab closes; an abandoned upload is cleaned up by the server (cancel or expiry).
  useEffect(() => {
    if (!busy) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [busy]);

  const upLogo = async (file: File) => {
    const type = ({ png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp" } as Record<string, string>)[file.name.split(".").pop()?.toLowerCase() ?? ""] ?? file.type;
    if (!["image/png", "image/jpeg", "image/webp"].includes(type)) return setLogo({ phase: "failed", error: "Use a PNG, JPG or WebP image." });
    if (file.size > 10e6) return setLogo({ phase: "failed", error: "Logos can be up to 10 MB." });
    setLogo({ phase: "uploading", name: file.name });
    try {
      const id = await uploadSmallFile(file, type, { title: "Logo" });
      if (data.brand && !(await perform(setBrandLogoAction(data.brand.id, id)))) throw new Error("The logo uploaded but couldn't be linked to your brand. Set it in Brand profiles.");
      setLogo({ phase: "done", name: file.name });
    } catch (e) {
      setLogo({ phase: "failed", name: file.name, error: (e as Error).message });
    }
  };
  const upGuide = async (file: File) => {
    if (!/\.pdf$/i.test(file.name) && file.type !== "application/pdf") return setGuide({ phase: "failed", error: "Use a PDF file." });
    if (file.size > 25e6) return setGuide({ phase: "failed", error: "Guidelines can be up to 25 MB." });
    setGuide({ phase: "uploading", name: file.name });
    try {
      await uploadSmallFile(file, "application/pdf", { title: "Brand guidelines" });
      setGuide({ phase: "done", name: file.name });
    } catch (e) {
      setGuide({ phase: "failed", name: file.name, error: (e as Error).message });
    }
  };
  const finish = async (skipped: boolean) => {
    if (!(await perform(recordStepAction("assets")))) return;
    const s: string[] = [];
    if (!skipped && logo.phase === "done") s.push("Logo: uploaded");
    if (!skipped && guide.phase === "done") s.push("Brand guidelines: uploaded to the Library");
    const n = uploads.items.filter((i) => i.phase === "done").length;
    if (n) s.push(`Footage: ${n} file${n === 1 ? "" : "s"} uploaded`);
    onDone(s);
  };

  return (
    <Step title="Logo and" accent="assets." intro="Your logo goes on end cards and watermarks. Guidelines and example videos help keep every video on brand.">
      <SmallUpload title="Logo" hint="PNG, JPG or WebP, up to 10 MB. A transparent background works best." accept="image/png,image/jpeg,image/webp" icon={<ImagePlus aria-hidden />} state={logo} onFile={upLogo} />
      <SmallUpload title="Brand guidelines (optional)" hint="PDF up to 25 MB. Saved in your Library for your team." accept="application/pdf,.pdf" icon={<FileText aria-hidden />} state={guide} onFile={upGuide} />
      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium">Footage and example videos (optional)</p>
        <label className="flex cursor-pointer items-center gap-4 rounded-lg border border-dashed border-line-strong bg-surface-muted/50 p-4 hover:border-ink-muted has-focus-visible:outline-2 has-focus-visible:outline-focus">
          <input type="file" multiple accept={ACCEPT_ATTR} className="sr-only" aria-label="Upload footage or example videos" onChange={(e) => (e.target.files && uploads.add(e.target.files), (e.target.value = ""))} />
          <span className="inline-flex size-12 shrink-0 items-center justify-center rounded-md bg-surface text-ink-muted [&_svg]:size-5">
            <Upload aria-hidden />
          </span>
          <span className="flex min-w-0 flex-col gap-0.5">
            <span className="font-medium">Choose files</span>
            <span className="text-xs text-ink-muted">MP4, MOV, WebM or images. Large files upload in parts and can be retried. They&apos;re analysed in your Library.</span>
          </span>
        </label>
        {uploads.items.length ? (
          <ul aria-label="Uploads" className="flex flex-col divide-y divide-line rounded-lg border border-line text-sm">
            {uploads.items.map((u) => (
              <li key={u.id} className="flex flex-wrap items-center gap-2 p-3">
                <span className="min-w-0 flex-1 truncate font-medium">{u.file.name}</span>
                <span className={cn("text-xs", u.phase === "failed" ? "text-danger" : "text-ink-muted")} role={u.phase === "failed" ? "alert" : undefined}>
                  {u.phase === "uploading" ? `${Math.round((u.loaded / Math.max(1, u.file.size)) * 100)}%` : u.phase === "failed" ? u.error : u.phase === "done" ? (u.note ?? "Uploaded") : u.phase}
                </span>
                {["queued", "preparing", "uploading", "finishing"].includes(u.phase) ? (
                  <Button size="sm" variant="ghost" onClick={() => uploads.cancel(u.id)} aria-label={`Cancel upload of ${u.file.name}`}>
                    <X aria-hidden /> Cancel
                  </Button>
                ) : u.phase === "failed" ? (
                  <Button size="sm" variant="ghost" onClick={() => uploads.retry(u.id)} aria-label={`Retry upload of ${u.file.name}`}>
                    <RotateCw aria-hidden /> Retry
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      {busy ? <p className="text-sm text-ink-muted">Uploads are still running. Wait for them to finish before you continue.</p> : null}
      <div className={cn(busy && "pointer-events-none opacity-60")} aria-disabled={busy || undefined}>
        <Footer onBack={onBack} onNext={() => !busy && finish(false)} onSkip={() => !busy && finish(true)} />
      </div>
    </Step>
  );
}

function SmallUpload({ title, hint, accept, icon, state, onFile }: { title: string; hint: string; accept: string; icon: ReactNode; state: FileState; onFile: (f: File) => void }) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-medium">{title}</p>
      <label className="flex cursor-pointer items-center gap-4 rounded-lg border border-dashed border-line-strong bg-surface-muted/50 p-4 hover:border-ink-muted has-focus-visible:outline-2 has-focus-visible:outline-focus">
        <input ref={input} type="file" accept={accept} className="sr-only" aria-label={`Upload ${title.toLowerCase()}`} disabled={state.phase === "uploading"} onChange={(e) => (e.target.files?.[0] && onFile(e.target.files[0]), (e.target.value = ""))} />
        <span className="inline-flex size-12 shrink-0 items-center justify-center rounded-md bg-surface text-ink-muted [&_svg]:size-5">
          {state.phase === "uploading" ? <Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden /> : state.phase === "done" ? <Check className="text-success" aria-hidden /> : icon}
        </span>
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="truncate font-medium">{state.phase === "idle" || state.phase === "failed" ? "Choose a file" : state.name}</span>
          <span className={cn("text-xs", state.phase === "failed" ? "text-danger" : "text-ink-muted")} role={state.phase === "failed" ? "alert" : "status"}>
            {state.phase === "uploading" ? "Uploading…" : state.phase === "done" ? "Uploaded · choose another to replace it" : state.phase === "failed" ? state.error : hint}
          </span>
        </span>
      </label>
    </div>
  );
}

function PreferencesStep({ data, onBack, onDone }: { data: SetupData; onBack: () => void; onDone: (summary: string[]) => void }) {
  const [mode, setMode] = useState(data.prefs.mode);
  const [format, setFormat] = useState(data.prefs.format);
  const [ai, setAi] = useState(data.prefs.aiConsent);
  const [email, setEmail] = useState(data.prefs.emailWhenReady);
  const [saving, setSaving] = useState(false);
  const finish = async () => {
    setSaving(true);
    const ok = (await perform(savePreferencesStepAction({ mode, format, aiConsent: ai, emailWhenReady: email }))) && (await perform(recordStepAction("done")));
    setSaving(false);
    if (ok) onDone([`Default format: ${format}`, `AI keyframe analysis: ${ai ? "on" : "off"}`]);
  };
  const skip = async () => (await perform(recordStepAction("done"))) && onDone([]);
  return (
    <Step title="A few" accent="preferences." intro="Defaults you can change any time in Settings.">
      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium">Appearance</p>
        <SegmentedControl label="Appearance" value={mode} onValueChange={(v) => setMode(v as typeof mode)} options={[{ value: "workspace", label: "Light Workspace" }, { value: "studio", label: "Dark Studio" }]} />
        <p className="text-xs text-ink-muted">Six colour palettes are in Settings → Appearance.</p>
      </div>
      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium">Main video format</p>
        <SegmentedControl label="Main video format" value={format} onValueChange={(v) => setFormat(v as typeof format)} options={["9:16", "1:1", "4:5", "16:9"].map((f) => ({ value: f, label: f }))} />
      </div>
      <div className="flex flex-col gap-4 rounded-lg border border-line p-4">
        <Switch
          label="Let AI look at keyframes from my footage"
          hint="Stills (never whole videos) are sent to our AI provider to describe scenes and find best moments. Off: analysis still measures quality, length and shot changes. You can change this later."
          checked={ai}
          onCheckedChange={setAi}
        />
        <Switch label="Email me when a video is ready" hint="Saved now. Render emails start once email sending is set up." checked={email} onCheckedChange={setEmail} />
      </div>
      <Footer onBack={onBack} onNext={finish} onSkip={skip} next={saving ? "Saving…" : "Finish setup"} />
    </Step>
  );
}

function DoneStep({ data, summary }: { data: SetupData; summary: string[] }) {
  return (
    <div className="flex flex-col gap-6">
      <span aria-hidden className="inline-flex size-14 items-center justify-center rounded-2xl bg-success text-success-foreground">
        <Check className="size-7" strokeWidth={2.4} />
      </span>
      <header className="flex flex-col gap-2">
        <h1 id="step-title" className="font-display text-[34px] leading-[1.05] font-semibold tracking-display">
          You&apos;re all <em className="font-accent font-normal">set.</em>
        </h1>
        <p className="text-ink-muted">
          {data.workspace} is ready on the {data.planName} plan{data.trialVideos ? `, with ${data.trialVideos} trial video${data.trialVideos === 1 ? "" : "s"} to make` : ""}.
        </p>
      </header>
      <ul className="flex flex-col gap-2 text-sm">
        {[`Workspace: ${data.workspace}`, ...withSaved(summary, data)].map((s) => (
          <li key={s} className="flex gap-2.5">
            <Check className="mt-0.5 size-4 shrink-0 text-success" aria-hidden /> {s}
          </li>
        ))}
      </ul>
      <div className="grid gap-3 sm:grid-cols-3">
        <NextCard icon={<Upload aria-hidden />} title="Upload footage" text="Drop in clips; we analyse them for best moments." />
        <NextCard icon={<Sparkles aria-hidden />} title="Make a video" text="Describe it and Autopilot does the first cut." />
        <NextCard icon={<Users aria-hidden />} title="Invite your team" text="Up to your plan's seats." />
      </div>
      <Button asChild variant="action" size="lg">
        <Link href="/dashboard?welcome=1">Go to dashboard</Link>
      </Button>
    </div>
  );
}

/** What this visit did, plus what was saved on an earlier visit (setup can be resumed on another day or device). */
function withSaved(summary: string[], data: SetupData) {
  const has = (label: string) => summary.some((s) => s.startsWith(`${label}:`));
  const out = [...summary];
  const b = data.brand;
  if (b && !has("Brand profile") && (b.colours.length || b.voice)) {
    const tones = TONES.filter((t) => b.voice.toLowerCase().includes(t.toLowerCase()));
    out.unshift(`Brand profile: ${b.colours.length} colour${b.colours.length === 1 ? "" : "s"}${tones.length ? `, ${tones.join(" and ").toLowerCase()} voice` : ""}`);
  }
  if (b?.hasLogo && !has("Logo")) out.push("Logo: uploaded");
  return out;
}
