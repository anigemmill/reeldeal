"use client";

import { ArrowUp, Music2, Search, Sparkles } from "lucide-react";
import { useId, useState, type FormEvent } from "react";
import { LogoMark } from "@/components/brand/logo";
import { MediaArt } from "@/components/media/media-art";
import { AiBadge, Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/choice";
import { Eyebrow } from "@/components/ui/misc";
import { SegmentedControl, Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/components/ui/toast";
import { getMedia } from "@/content/media";
import { STUDIO_AUDIO, STUDIO_CLIPS, STUDIO_LIBRARY, STUDIO_VERSIONS, timecode } from "@/content/sample/studio";
import { cn } from "@/lib/utils";

const panelTab = "h-8 flex-1 rounded-[8px] border-0 px-2 text-xs data-[state=active]:bg-surface-muted";

/* ---- Left: media library ------------------------------------------------ */

export function MediaPanel() {
  const [query, setQuery] = useState("");
  const searchId = useId();
  const results = STUDIO_LIBRARY.filter((m) => m.name.toLowerCase().includes(query.trim().toLowerCase()));

  return (
    <aside aria-label="Media" className="flex w-[220px] shrink-0 flex-col gap-2.5 overflow-hidden rounded-xl bg-surface p-3 xl:w-[250px]">
      <Tabs defaultValue="media" className="flex min-h-0 flex-1 flex-col">
        <TabsList aria-label="Library" className="gap-0.5 border-0">
          {["Media", "Brand", "Text", "Audio"].map((t) => (
            <TabsTrigger key={t} value={t.toLowerCase()} className={panelTab}>
              {t}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="media" className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto pt-2.5">
          <label htmlFor={searchId} className="sr-only">
            Search footage
          </label>
          <div className="flex items-center gap-2 rounded-[10px] border border-line bg-bg px-2.5">
            <Search className="size-3.5 text-ink-muted" aria-hidden />
            <input
              id={searchId}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search “guests laughing”…"
              className="h-9 min-w-0 flex-1 bg-transparent text-xs text-ink outline-none placeholder:text-ink-muted"
            />
          </div>
          <Eyebrow className="text-[10px]">{query ? `${results.length} matches` : "AI suggests for this spot"}</Eyebrow>
          <ul className="grid grid-cols-2 gap-2">
            {results.map((m) => (
              <li key={m.id}>
                <div className="relative aspect-[16/10] overflow-hidden rounded-[9px]">
                  <MediaArt asset={getMedia(m.media)} />
                  <span
                    className={cn(
                      "absolute top-1 left-1 rounded-pill px-1.5 font-mono text-[9px] leading-4",
                      m.score >= 8.4 ? "bg-ai text-ai-foreground" : "bg-on-media text-media-veil",
                    )}
                  >
                    <span className="sr-only">AI score </span>
                    {m.score}
                  </span>
                  <span className="absolute right-1 bottom-1 rounded-[4px] bg-media-veil/60 px-1 font-mono text-[9px] text-on-media">{m.duration}</span>
                </div>
                <p className="mt-1 truncate text-[11px] text-ink-muted">{m.name}</p>
              </li>
            ))}
          </ul>
          {results.length === 0 && <p className="text-xs text-ink-muted">No clips match “{query}”. AI search arrives with the library (Phase 3).</p>}
        </TabsContent>

        <TabsContent value="brand" className="flex flex-col gap-3 pt-3 text-xs">
          <div className="flex items-center gap-2.5 rounded-[10px] bg-bg p-2.5">
            <LogoMark className="size-6" />
            <span className="flex-1 font-semibold">Lakeside Lodge</span>
            <Badge size="sm">Logo</Badge>
          </div>
          <div className="flex gap-1.5" aria-label="Brand colours (sample)">
            {["bg-primary", "bg-action", "bg-tint", "bg-ink"].map((c) => (
              <span key={c} className={cn("h-8 flex-1 rounded-md border border-line", c)} />
            ))}
          </div>
          <p className="text-ink-muted">Headings in the display face, captions in the body face. The full brand profile arrives in Phase 3.</p>
          <Switch label="Logo end card" defaultChecked />
        </TabsContent>

        <TabsContent value="text" className="flex flex-col gap-2 pt-3">
          {[
            ["Headline", "font-display text-lg font-bold tracking-tight"],
            ["Lower third", "text-sm font-semibold"],
            ["Caption", "font-mono text-[11px]"],
          ].map(([name, cls]) => (
            <div key={name} className="rounded-[10px] bg-bg p-3">
              <p className={cls}>Wake up to this.</p>
              <p className="mt-1 text-[11px] text-ink-muted">{name}</p>
            </div>
          ))}
        </TabsContent>

        <TabsContent value="audio" className="flex flex-col gap-2 pt-3">
          {STUDIO_AUDIO.map((a) => (
            <div key={a.id} className={cn("flex items-center gap-2.5 rounded-[10px] p-2.5", a.current ? "bg-surface-muted ring-1 ring-ai" : "bg-bg")}>
              <Music2 className="size-4 text-ink-muted" aria-hidden />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-xs font-medium">{a.name}</span>
                <span className="text-[11px] text-ink-muted">
                  {a.mood} · {a.duration}
                </span>
              </span>
              {a.current && <Badge size="sm">In use</Badge>}
            </div>
          ))}
          <p className="text-[11px] text-ink-muted">[MUSIC LICENSING PARTNER] Sample tracks only.</p>
        </TabsContent>
      </Tabs>
    </aside>
  );
}

/* ---- Right: assistant, inspector, versions -------------------------------- */

export type ToolTab = "assistant" | "inspector" | "versions";

export function ToolsPanel({ tab, setTab, clipIndex }: { tab: ToolTab; setTab: (t: ToolTab) => void; clipIndex: number }) {
  return (
    <aside aria-label="Tools" className="flex w-[300px] shrink-0 flex-col overflow-hidden rounded-xl bg-surface p-3 xl:w-[320px]">
      <Tabs value={tab} onValueChange={(v) => setTab(v as ToolTab)} className="flex min-h-0 flex-1 flex-col">
        <TabsList aria-label="Panel" className="gap-0.5 rounded-[10px] border-0 bg-bg p-[3px]">
          {(["assistant", "inspector", "versions"] as const).map((t) => (
            <TabsTrigger key={t} value={t} className={cn(panelTab, "capitalize")}>
              {t}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="assistant" className="flex min-h-0 flex-1 flex-col pt-3">
          <Assistant />
        </TabsContent>
        <TabsContent value="inspector" className="min-h-0 flex-1 overflow-y-auto pt-3">
          <Inspector index={clipIndex} />
        </TabsContent>
        <TabsContent value="versions" className="min-h-0 flex-1 overflow-y-auto pt-3">
          <Versions />
        </TabsContent>
      </Tabs>
    </aside>
  );
}

type Msg = { from: "ai" | "you"; text: string };

function Assistant() {
  const inputId = useId();
  const [draft, setDraft] = useState("");
  const [decision, setDecision] = useState<"pending" | "kept" | "undone">("pending");
  const [extra, setExtra] = useState<Msg[]>([]);

  const send = (text: string) => {
    if (!text.trim()) return;
    setExtra((xs) => [
      ...xs,
      { from: "you", text: text.trim() },
      { from: "ai", text: "Design preview: the assistant arrives in Phase 4, so this request was not applied." },
    ]);
    setDraft("");
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2.5">
      <div className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto pr-0.5" role="log" aria-label="Assistant conversation">
        <p className="rounded-xl bg-bg p-3 leading-normal">This cut is 30s with 6 shots, warm acoustic music and brand captions. What would you like to change?</p>
        <p className="max-w-[85%] self-end rounded-xl bg-primary p-3 leading-normal text-primary-foreground">
          Open on the jetty laughing shot and make the middle faster.
        </p>
        <div className="flex flex-col gap-2 rounded-xl bg-bg p-3">
          <span className="flex items-center gap-1.5">
            <span aria-hidden className="size-[7px] rounded-full bg-ai" />
            Done. 3 changes:
          </span>
          {[
            ["Opened on jetty_dusk_03", "00:00"],
            ["Trimmed 3 middle shots", "−4.2s"],
            ["Re-timed captions to beat", "3 cues"],
          ].map(([a, b]) => (
            <span key={a} className="flex justify-between gap-2 rounded-[9px] bg-surface-muted px-2.5 py-2 text-xs">
              <span>{a}</span>
              <span className="font-mono text-ink-muted">{b}</span>
            </span>
          ))}
          {decision === "pending" ? (
            <div className="flex gap-1.5">
              <Button variant="action" size="sm" className="flex-1" onClick={() => setDecision("kept")}>
                Keep
              </Button>
              <Button variant="secondary" size="sm" className="flex-1" onClick={() => setDecision("undone")}>
                Undo
              </Button>
            </div>
          ) : (
            <p role="status" className="text-xs text-ink-muted">
              {decision === "kept" ? "Kept as v3." : "Undone. Back to v2."} (Design preview)
            </p>
          )}
        </div>
        {extra.map((m, i) =>
          m.from === "you" ? (
            <p key={i} className="max-w-[85%] self-end rounded-xl bg-primary p-3 leading-normal text-primary-foreground">
              {m.text}
            </p>
          ) : (
            <p key={i} className="rounded-xl bg-bg p-3 leading-normal text-ink-muted">
              {m.text}
            </p>
          ),
        )}
      </div>
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Suggested edits">
        {["Make a 15s cut", "Warmer colour", "Try different music"].map((s) => (
          <button key={s} type="button" onClick={() => send(s)} className="rounded-pill border border-line px-2.5 py-1.5 text-[11px] hover:bg-surface-muted">
            {s}
          </button>
        ))}
      </div>
      <form
        className="flex items-center gap-2 rounded-xl border border-line bg-bg py-1.5 pr-1.5 pl-3"
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          send(draft);
        }}
      >
        <label htmlFor={inputId} className="sr-only">
          Ask for an edit
        </label>
        <input
          id={inputId}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Ask for an edit…"
          className="h-8 min-w-0 flex-1 bg-transparent text-ink outline-none placeholder:text-ink-muted"
        />
        <button type="submit" aria-label="Send" className="inline-flex size-8.5 items-center justify-center rounded-[9px] bg-ai text-ai-foreground">
          <ArrowUp className="size-4" strokeWidth={2.4} aria-hidden />
        </button>
      </form>
    </div>
  );
}

function Inspector({ index }: { index: number }) {
  const clip = STUDIO_CLIPS[index];
  const [speed, setSpeed] = useState("1");
  const [transition, setTransition] = useState("cut");
  const length = clip.end - clip.start;
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2.5">
        <div className="relative h-10 w-16 shrink-0 overflow-hidden rounded-lg">
          <MediaArt asset={getMedia(clip.media)} />
        </div>
        <div className="min-w-0">
          <p className="truncate font-semibold">{clip.name}</p>
          <p className="font-mono text-[11px] text-ink-muted">
            Shot {index + 1} of {STUDIO_CLIPS.length} · {length.toFixed(1)}s
          </p>
        </div>
      </div>
      <dl className="grid grid-cols-2 gap-2">
        {[
          ["In", timecode(clip.sourceIn)],
          ["Out", timecode(clip.sourceIn + length)],
        ].map(([k, v]) => (
          <div key={k} className="rounded-[10px] bg-bg p-2.5">
            <dt className="text-[11px] text-ink-muted">{k}</dt>
            <dd className="font-mono tabular-nums">{v}</dd>
          </div>
        ))}
      </dl>
      <div className="flex flex-col gap-1.5">
        <span className="text-[11px] text-ink-muted">Speed</span>
        <SegmentedControl label="Speed" size="sm" value={speed} onValueChange={setSpeed} className="w-full [&>*]:flex-1" options={["0.5", "1", "1.5", "2"].map((v) => ({ value: v, label: `${v}×` }))} />
      </div>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-[11px] text-ink-muted">Colour</legend>
        {["Exposure", "Warmth", "Contrast"].map((name) => (
          <Slider key={name} name={name} />
        ))}
      </fieldset>
      <div className="rounded-[10px] bg-bg p-2.5">
        <Switch label={<span className="inline-flex items-center gap-2">Keep subject in frame <AiBadge size="sm">AI</AiBadge></span>} defaultChecked />
      </div>
      <div className="flex flex-col gap-1.5">
        <span className="text-[11px] text-ink-muted">Transition in</span>
        <SegmentedControl
          label="Transition in"
          size="sm"
          value={transition}
          onValueChange={setTransition}
          className="w-full [&>*]:flex-1"
          options={[
            { value: "cut", label: "Cut" },
            { value: "dissolve", label: "Dissolve" },
            { value: "whip", label: "Whip" },
          ]}
        />
      </div>
      <Button
        variant="secondary"
        size="sm"
        className="border-ai text-ai hover:bg-ai/10"
        onClick={() => toast({ title: "Design preview", description: "Shot suggestions arrive in Phase 4.", tone: "ai" })}
      >
        <Sparkles aria-hidden />
        Ask AI for a better shot here
      </Button>
      <p className="text-[11px] text-ink-muted">Changes here are not saved in the design preview.</p>
    </div>
  );
}

function Slider({ name }: { name: string }) {
  const id = useId();
  const [value, setValue] = useState(0);
  return (
    <div className="flex items-center gap-2.5">
      <label htmlFor={id} className="w-[70px] shrink-0">
        {name}
      </label>
      <input
        id={id}
        type="range"
        min={-100}
        max={100}
        value={value}
        onChange={(e) => setValue(Number(e.target.value))}
        className="flex-1 accent-ai"
      />
      <output htmlFor={id} className="w-8 text-right font-mono text-[11px] text-ink-muted tabular-nums">
        {value > 0 ? `+${value}` : value}
      </output>
    </div>
  );
}

function Versions() {
  return (
    <div className="flex flex-col gap-1.5">
      <ul className="flex flex-col gap-1.5">
        {STUDIO_VERSIONS.map((v, i) => (
          <li key={v.id} className={cn("flex flex-col gap-1.5 rounded-xl border p-3", i === 0 ? "border-ai bg-surface-muted" : "border-line bg-bg")}>
            <div className="flex items-center justify-between gap-2">
              <span className="font-semibold">{v.name}</span>
              <span className={cn("rounded-pill px-1.5 py-0.5 font-mono text-[10px]", v.who.includes("AI") ? "bg-ai text-ai-foreground" : "bg-tint text-on-tint")}>{v.who}</span>
            </div>
            <span className="text-xs text-ink-muted">{v.text}</span>
            <div className="flex items-center justify-between">
              <span className="font-mono text-[10px] text-ink-muted">{v.when}</span>
              {i > 0 && (
                <Button variant="ghost" size="sm" disabled title="Restoring arrives in Phase 4" className="h-6 px-2 text-[11px]">
                  Restore · soon
                </Button>
              )}
            </div>
          </li>
        ))}
      </ul>
      <p className="mt-1.5 text-xs leading-normal text-ink-muted">Every change is saved. Restore any version, or branch a new one to compare side by side.</p>
    </div>
  );
}
