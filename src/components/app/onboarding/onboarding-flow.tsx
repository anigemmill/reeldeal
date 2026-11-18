"use client";

import { ArrowLeft, Briefcase, Building2, Check, FileText, ImagePlus, MailCheck, Sparkles, Upload, Users } from "lucide-react";
import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { Logo } from "@/components/brand/logo";
import { PillToggle } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/choice";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { SegmentedControl } from "@/components/ui/tabs";
import { NEW_BRAND_COLOUR_HEX } from "@/content/brand-defaults";
import { SAMPLE_ORG } from "@/content/sample/settings";
import { cn } from "@/lib/utils";
import { previewOnly, SampleBadge } from "../settings/preview";

/*
  Onboarding journey (DESIGN for review, Stage 4 wires it). Seven steps, only the first
  three required; brand, assets and preferences can be skipped and finished later from
  the dashboard checklist. Invited people skip straight to the dashboard. Agencies
  create one workspace per client (D1).
  The real steps 1–3 exist today (sign-up, /verify-email, /onboarding); this flow adds
  brand, assets, preferences and the completion screen.
*/
export const ONBOARDING_STEPS = [
  { id: "account", label: "Account" },
  { id: "workspace", label: "Workspace" },
  { id: "business", label: "Business" },
  { id: "brand", label: "Brand" },
  { id: "assets", label: "Logo and assets" },
  { id: "preferences", label: "Preferences" },
  { id: "done", label: "Done" },
] as const;
type StepId = (typeof ONBOARDING_STEPS)[number]["id"] | "verify";
const ORDER: StepId[] = ["account", "verify", "workspace", "business", "brand", "assets", "preferences", "done"];
const indexOf = (s: StepId) => ONBOARDING_STEPS.findIndex((x) => x.id === (s === "verify" ? "account" : s));

const INDUSTRIES = ["Accommodation", "Tours and activities", "Food and drink", "Attractions and venues", "Events", "Transport", "Retail", "Professional services", "Other"];
const TONES = ["Warm", "Calm", "Adventurous", "Playful", "Premium", "Down-to-earth", "Professional", "Bold"];

export function OnboardingFlow({ initialStep = "account", invite }: { initialStep?: StepId; invite?: { workspace: string; role: string; from: string } }) {
  const [step, setStep] = useState<StepId>(initialStep);
  const [use, setUse] = useState<"business" | "agency">("business");
  // U10: someone with an invitation isn't on the seven-step path unless they choose their own workspace.
  const [ownInstead, setOwnInstead] = useState(false);
  const invited = Boolean(invite) && !ownInstead;
  useEffect(() => {
    const s = new URLSearchParams(location.search).get("step") as StepId | null;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time sync from the URL (review pages only)
    if (s && ORDER.includes(s)) setStep(s);
  }, []);
  const go = (d: 1 | -1) => setStep(ORDER[Math.max(0, Math.min(ORDER.length - 1, ORDER.indexOf(step) + d))]!);
  const i = indexOf(step);

  return (
    <main id="main" className="flex min-h-dvh flex-col items-center bg-bg px-4 py-8 sm:py-12">
      <div className="flex w-full max-w-[600px] flex-col gap-6">
        <div className="flex items-center justify-between gap-3">
          <Link href="/" aria-label="Reeldeal home" className="rounded-sm px-1.5 py-1">
            <Logo size="sm" />
          </Link>
          <SampleBadge />
        </div>

        {step !== "done" && !invited ? (
          <nav aria-label="Setup progress" className="flex flex-col gap-2.5">
            <p className="flex justify-between font-mono text-[11px] tracking-label text-ink-muted uppercase">
              <span>
                Step {i + 1} of {ONBOARDING_STEPS.length}
              </span>
              <span>{ONBOARDING_STEPS[i]!.label}</span>
            </p>
            <ol className="flex gap-1.5">
              {ONBOARDING_STEPS.map((s, n) => (
                <li key={s.id} className="flex-1">
                  <span className={cn("block h-1.5 rounded-pill", n < i ? "bg-primary" : n === i ? "bg-primary/60" : "bg-line")} />
                  <span className="sr-only">
                    {s.label}: {n < i ? "done" : n === i ? "current step" : "to do"}
                  </span>
                </li>
              ))}
            </ol>
          </nav>
        ) : null}

        <section aria-labelledby="step-title" className="flex flex-col gap-6 rounded-2xl border border-line bg-surface p-6 shadow-card sm:p-8">
          {step === "account" && (
            <Step title="Start making" accent="videos." intro="Create your account. Setting up your workspace and brand takes about a minute after that.">
              <Field label="Your name">
                <Input autoComplete="name" defaultValue="Aroha Ngata" />
              </Field>
              <Field label="Work email">
                <Input type="email" autoComplete="email" defaultValue="aroha@lakesidelodge.example" />
              </Field>
              <Field label="Password" hint="At least 8 characters.">
                <Input type="password" autoComplete="new-password" defaultValue="placeholder-pass" />
              </Field>
              <label className="flex items-start gap-2.5 text-sm">
                <input type="checkbox" defaultChecked className="mt-1 size-4 accent-primary" />
                <span>
                  I agree to the <Link href="/terms" className="text-link underline underline-offset-4">Terms of Service</Link> and <Link href="/privacy" className="text-link underline underline-offset-4">Privacy Policy</Link>.
                </span>
              </label>
              <Footer onNext={() => go(1)} next="Create account" />
            </Step>
          )}

          {step === "verify" && (
            <Step title="Check your" accent="inbox." intro={<>We sent a confirmation link to <strong className="font-semibold text-ink">aroha@lakesidelodge.example</strong>. Open it to continue. It works on any device.</>}>
              <span aria-hidden className="inline-flex size-12 items-center justify-center rounded-xl bg-tint text-on-tint">
                <MailCheck className="size-6" strokeWidth={1.8} />
              </span>
              <Button variant="secondary" size="lg" disabled>
                Send a new link in 52s
              </Button>
              <Footer onBack={() => go(-1)} onNext={() => go(1)} next="I've confirmed (preview)" />
            </Step>
          )}

          {step === "workspace" && (
            <Step
              title={invited ? "Join your" : "Who is this"}
              accent={invited ? "team." : "for?"}
              intro={invited ? "Your account is ready. Join the workspace you were invited to, or set up one of your own." : "Your workspace holds your footage, brand and videos. Only people you invite can see it."}
            >
              {invite && invited ? (
                <div className="flex flex-col gap-3 rounded-lg border border-primary/40 bg-surface-muted p-4">
                  <p className="text-sm">
                    <strong className="font-semibold">{invite.from}</strong> invited you to <strong className="font-semibold">{invite.workspace}</strong> as {invite.role}.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="action" onClick={() => previewOnly("You haven't joined")}>
                      Join {invite.workspace}
                    </Button>
                    <Button variant="ghost" onClick={() => setOwnInstead(true)}>
                      Create my own workspace instead
                    </Button>
                  </div>
                </div>
              ) : null}
              {invited ? null : (
                <>
                  <fieldset className="grid gap-3 sm:grid-cols-2">
                    <legend className="sr-only">Workspace type</legend>
                <ChoiceCard checked={use === "business"} onSelect={() => setUse("business")} icon={<Building2 aria-hidden />} title="My business" text="Videos for a business you own or work for." />
                <ChoiceCard checked={use === "agency"} onSelect={() => setUse("agency")} icon={<Briefcase aria-hidden />} title="A client (agency)" text="Each client gets its own workspace. Add more clients any time." />
              </fieldset>
              <p className="flex gap-2.5 text-sm text-ink-muted">
                <Users className="mt-0.5 size-4 shrink-0" aria-hidden />
                Joining a team that already uses Reeldeal? Ask them to invite this email address: you&apos;ll go straight in.
                  </p>
                  <Footer onBack={() => go(-1)} onNext={() => go(1)} />
                </>
              )}
            </Step>
          )}

          {step === "business" && (
            <Step title={use === "agency" ? "Your first" : "About your"} accent={use === "agency" ? "client." : "business."} intro="This names the workspace and gives your videos the right context. You can change it later in Settings.">
              <Field label={use === "agency" ? "Client's business name" : "Business name"}>
                <Input autoComplete="organization" defaultValue="Lakeside Lodge" />
              </Field>
              <Field label="Industry">
                <Select options={INDUSTRIES.map((x) => ({ value: x, label: x }))} defaultValue="Accommodation" />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Website (optional)">
                  <Input type="url" inputMode="url" defaultValue="lakesidelodge.example" />
                </Field>
                <Field label="Location (optional)">
                  <Input defaultValue="Queenstown, NZ" />
                </Field>
              </div>
              <Footer onBack={() => go(-1)} onNext={() => go(1)} next="Create workspace" />
            </Step>
          )}

          {step === "brand" && <BrandStep onBack={() => go(-1)} onNext={() => go(1)} />}

          {step === "assets" && (
            <Step title="Logo and" accent="assets." intro="Your logo goes on end cards and watermarks. Guidelines help keep every video on brand.">
              <DropZone icon={<ImagePlus aria-hidden />} title="Logo" hint="PNG, SVG or JPG, up to 10 MB. A transparent background works best." done="lakeside-logo.svg · 24 KB" />
              <DropZone icon={<FileText aria-hidden />} title="Brand guidelines (optional)" hint="PDF up to 25 MB. We read it for colours, fonts and words to avoid." />
              <p className="text-sm text-ink-muted">You&apos;ll upload footage from the Library once you&apos;re in.</p>
              <Footer onBack={() => go(-1)} onNext={() => go(1)} onSkip={() => go(1)} />
            </Step>
          )}

          {step === "preferences" && <PreferencesStep onBack={() => go(-1)} onNext={() => go(1)} />}

          {step === "done" && (
            <div className="flex flex-col gap-6">
              <span aria-hidden className="inline-flex size-14 items-center justify-center rounded-2xl bg-success text-success-foreground">
                <Check className="size-7" strokeWidth={2.4} />
              </span>
              <header className="flex flex-col gap-2">
                <h1 id="step-title" className="font-display text-[34px] leading-[1.05] font-semibold tracking-display">
                  You&apos;re all <em className="font-accent font-normal">set.</em>
                </h1>
                <p className="text-ink-muted">Lakeside Lodge is ready on the Free plan, with 2 trial videos to make.</p>
              </header>
              <ul className="flex flex-col gap-2 text-sm">
                {["Workspace: Lakeside Lodge", "Brand profile: 3 colours, warm and calm voice, logo", "Default formats: 9:16 and 1:1"].map((s) => (
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
              <Button variant="action" size="lg">
                Go to dashboard
              </Button>
            </div>
          )}
        </section>
        {step === "account" ? (
          <p className="text-center text-sm text-ink-muted">
            Already have an account? <Link href="/sign-in" className="font-medium text-link underline-offset-4 hover:underline">Sign in</Link>
          </p>
        ) : null}
      </div>
    </main>
  );
}

export function Step({ title, accent, intro, children }: { title: string; accent: string; intro: ReactNode; children: ReactNode }) {
  return (
    <>
      <header className="flex flex-col gap-2">
        <h1 id="step-title" className="font-display text-[30px] leading-[1.05] font-semibold tracking-display">
          {title} <em className="font-accent font-normal">{accent}</em>
        </h1>
        <p className="text-[15px] leading-relaxed text-ink-muted">{intro}</p>
      </header>
      <div className="flex flex-col gap-4">{children}</div>
    </>
  );
}

export function Footer({ onBack, onNext, onSkip, next = "Continue" }: { onBack?: () => void; onNext: () => void; onSkip?: () => void; next?: string }) {
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-line pt-5">
      {onBack ? (
        <Button variant="ghost" onClick={onBack}>
          <ArrowLeft aria-hidden /> Back
        </Button>
      ) : null}
      <span className="flex-1" />
      {onSkip ? (
        <Button variant="ghost" onClick={onSkip}>
          Skip for now
        </Button>
      ) : null}
      <Button variant="action" size="lg" onClick={onNext}>
        {next}
      </Button>
    </div>
  );
}

function ChoiceCard({ checked, onSelect, icon, title, text }: { checked: boolean; onSelect: () => void; icon: ReactNode; title: string; text: string }) {
  return (
    <label className={cn("flex cursor-pointer flex-col gap-2 rounded-lg border bg-surface p-4 transition-colors has-focus-visible:outline-2 has-focus-visible:outline-focus", checked ? "border-primary shadow-[inset_0_0_0_1px_var(--color-primary)]" : "border-line hover:border-line-strong")}>
      <input type="radio" name="workspace-type" className="sr-only" checked={checked} onChange={onSelect} />
      <span className={cn("inline-flex size-9 items-center justify-center rounded-md [&_svg]:size-5", checked ? "bg-primary text-primary-foreground" : "bg-surface-muted text-ink")}>{icon}</span>
      <span className="font-semibold">{title}</span>
      <span className="text-sm text-ink-muted">{text}</span>
    </label>
  );
}

function BrandStep({ onBack, onNext }: { onBack: () => void; onNext: () => void }) {
  const [tones, setTones] = useState<string[]>(["Warm", "Calm"]);
  const [colours, setColours] = useState<string[]>(SAMPLE_ORG.brand.colours.slice(0, 3));
  return (
    <Step title="Set up your" accent="brand." intro="So every video looks and sounds like you. Start simple; you can add more detail later.">
      <Field label="Brand name">
        <Input defaultValue="Lakeside Lodge" />
      </Field>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium">Brand colours</legend>
        <div className="flex flex-wrap gap-2.5">
          {colours.map((c, n) => (
            <label key={n} className="flex items-center gap-2 rounded-md border border-line bg-surface py-1.5 pr-3 pl-1.5">
              <input type="color" value={c} onChange={(e) => setColours((cs) => cs.map((x, k) => (k === n ? e.target.value : x)))} aria-label={`Colour ${n + 1}`} className="size-8 cursor-pointer rounded border-0 bg-transparent p-0" />
              <span className="font-mono text-xs uppercase">{c}</span>
            </label>
          ))}
          {colours.length < 6 ? (
            <Button variant="ghost" size="sm" onClick={() => setColours((cs) => [...cs, NEW_BRAND_COLOUR_HEX])}>
              + Add colour
            </Button>
          ) : null}
        </div>
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
        <Input defaultValue="Couples and small groups on a South Island road trip" />
      </Field>
      <Footer onBack={onBack} onNext={onNext} onSkip={onNext} />
    </Step>
  );
}

function PreferencesStep({ onBack, onNext }: { onBack: () => void; onNext: () => void }) {
  const [mode, setMode] = useState("workspace");
  const [format, setFormat] = useState("9:16");
  return (
    <Step title="A few" accent="preferences." intro="Defaults you can change any time in Settings.">
      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium" id="mode-label">Appearance</p>
        <SegmentedControl label="Appearance" value={mode} onValueChange={setMode} options={[{ value: "workspace", label: "Light Workspace" }, { value: "studio", label: "Dark Studio" }]} />
        <p className="text-xs text-ink-muted">Six colour palettes are in Settings → Appearance.</p>
      </div>
      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium">Main video format</p>
        <SegmentedControl label="Main video format" value={format} onValueChange={setFormat} options={["9:16", "1:1", "4:5", "16:9"].map((f) => ({ value: f, label: f }))} />
      </div>
      <div className="flex flex-col gap-4 rounded-lg border border-line p-4">
        <Switch label="Let AI look at keyframes from my footage" hint="Stills (never whole videos) are sent to our AI provider to describe scenes and find best moments. You can turn this off later." defaultChecked />
        <Switch label="Email me when a video is ready" hint="Renders can take a few minutes." defaultChecked />
      </div>
      <Footer onBack={onBack} onNext={onNext} onSkip={onNext} next="Finish setup" />
    </Step>
  );
}

function DropZone({ icon, title, hint, done }: { icon: ReactNode; title: string; hint: string; done?: string }) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-medium">{title}</p>
      <label className="flex cursor-pointer items-center gap-4 rounded-lg border border-dashed border-line-strong bg-surface-muted/50 p-4 hover:border-ink-muted has-focus-visible:outline-2 has-focus-visible:outline-focus">
        <input type="file" className="sr-only" aria-label={`Upload ${title.toLowerCase()}`} />
        <span className="inline-flex size-12 shrink-0 items-center justify-center rounded-md bg-surface text-ink-muted [&_svg]:size-5">{done ? <span aria-hidden className="font-display text-base font-bold text-ink">LL</span> : icon}</span>
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="font-medium">{done ?? "Choose a file or drop it here"}</span>
          <span className="text-xs text-ink-muted">{done ? "Uploaded · choose another to replace it" : hint}</span>
        </span>
      </label>
    </div>
  );
}

export function NextCard({ icon, title, text }: { icon: ReactNode; title: string; text: string }) {
  return (
    <div className="flex flex-col gap-1.5 rounded-lg border border-line p-3.5">
      <span className="text-primary [&_svg]:size-5">{icon}</span>
      <span className="font-semibold">{title}</span>
      <span className="text-xs text-ink-muted">{text}</span>
    </div>
  );
}
