"use client";

import { ArrowRight, Download, Monitor, Pause, Play, Smartphone, Square, Sparkles, Trash2, Wand2 } from "lucide-react";
import { useState, type ReactNode } from "react";
import { AppNav } from "@/components/app/app-nav";
import { Logo } from "@/components/brand/logo";
import { MediaThumb } from "@/components/media/media-thumb";
import { SCENE_VARIANTS, Scene } from "@/components/media/scene";
import { VideoFrame, type AspectRatio } from "@/components/media/video-frame";
import { AiBadge, Badge, Pill, PillToggle } from "@/components/ui/badge";
import { Button, IconButton } from "@/components/ui/button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox, RadioGroup, Switch } from "@/components/ui/choice";
import { Modal, ModalClose } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input, Textarea } from "@/components/ui/input";
import { Avatar, Eyebrow, Kbd, SampleDataNote, Skeleton } from "@/components/ui/misc";
import { ProgressBar, ProgressRing } from "@/components/ui/progress";
import { Select } from "@/components/ui/select";
import { SegmentedControl, Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/components/ui/toast";
import { Tooltip } from "@/components/ui/tooltip";
import { getMedia, MEDIA } from "@/content/media";

function Section({ id, title, note, children }: { id: string; title: string; note?: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-5 border-t border-line py-10">
      <div className="flex flex-col gap-1">
        <h2 id={id} className="font-display text-2xl font-semibold tracking-tight">
          {title}
        </h2>
        {note && <p className="max-w-prose text-sm text-ink-muted">{note}</p>}
      </div>
      {children}
    </section>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2.5">
      <Eyebrow>{label}</Eyebrow>
      <div className="flex flex-wrap items-center gap-3">{children}</div>
    </div>
  );
}

export function ComponentsGallery() {
  const [filters, setFilters] = useState(["AI picks"]);
  const [aspect, setAspect] = useState<AspectRatio>("9:16");
  const [playing, setPlaying] = useState(false);
  const assets = Object.values(MEDIA);

  return (
    <div className="mx-auto w-full max-w-container px-5 pb-24 sm:px-8 lg:px-10">
      <div className="flex flex-col gap-3 py-12">
        <Eyebrow>Phase 1 · Checkpoint 1</Eyebrow>
        <h1 className="font-display text-[length:var(--rd-display-sm)] leading-[0.95] font-semibold tracking-display">
          Core <em className="font-accent font-normal">components</em>
        </h1>
        <p className="max-w-2xl text-ink-muted">
          Every shared component, in the palette, mode and type chosen in the toolbar. Components use semantic tokens only,
          so each one re-themes across all six palettes and both modes.
        </p>
      </div>

      <Section id="actions" title="Actions" note="Primary is the main blue action. Action (orange in Crossroads) is for the one main action on a screen, or an AI action.">
        <Row label="Variants">
          <Button variant="primary">Start free</Button>
          <Button variant="action">
            <Sparkles aria-hidden />
            Generate video
          </Button>
          <Button variant="secondary">Book a demo</Button>
          <Button variant="ghost">Cancel</Button>
        </Row>
        <Row label="Pill shape (marketing)">
          <Button variant="primary" shape="pill">
            Start free
          </Button>
          <Button variant="secondary" shape="pill">
            Book a demo
          </Button>
          <Button variant="action" shape="pill" size="lg">
            Create with Autopilot <ArrowRight aria-hidden />
          </Button>
        </Row>
        <Row label="Sizes and states">
          <Button variant="primary" size="sm">
            Small
          </Button>
          <Button variant="primary">Medium</Button>
          <Button variant="primary" size="lg">
            Large
          </Button>
          <Button variant="primary" loading>
            Rendering
          </Button>
          <Button variant="secondary" disabled>
            Disabled
          </Button>
        </Row>
        <Row label="Icon buttons (each has an accessible name)">
          <IconButton label={playing ? "Pause" : "Play"} variant="primary" onClick={() => setPlaying((p) => !p)}>
            {playing ? <Pause aria-hidden /> : <Play aria-hidden />}
          </IconButton>
          <IconButton label="Download" variant="secondary">
            <Download aria-hidden />
          </IconButton>
          <IconButton label="Delete clip">
            <Trash2 aria-hidden />
          </IconButton>
          <Tooltip content="Ask the assistant to edit">
            <IconButton label="Assistant" variant="secondary" shape="pill">
              <Wand2 aria-hidden />
            </IconButton>
          </Tooltip>
        </Row>
      </Section>

      <Section id="display" title="Badges, pills and labels">
        <Row label="Badges">
          <Badge>Draft</Badge>
          <Badge tone="primary">1080p</Badge>
          <AiBadge />
          <AiBadge>Best moment</AiBadge>
          <Badge tone="success">Ready</Badge>
          <Badge tone="warning">Low light</Badge>
          <Badge tone="danger">Render failed</Badge>
          <Badge tone="outline">9:16</Badge>
        </Row>
        <Row label="Filter pills (toggle buttons)">
          {["AI picks", "Drone", "People", "Golden hour", "Steady"].map((f) => (
            <PillToggle
              key={f}
              pressed={filters.includes(f)}
              onClick={() => setFilters((xs) => (xs.includes(f) ? xs.filter((x) => x !== f) : [...xs, f]))}
            >
              {f === "AI picks" && <Sparkles aria-hidden />}
              {f}
            </PillToggle>
          ))}
        </Row>
        <Row label="Tags and prompts">
          <Pill tone="ai">
            <Sparkles aria-hidden />
            30s reel for summer bookings
          </Pill>
          <Pill tone="tint">Lakefront</Pill>
          <Pill>Kayaking</Pill>
          <Pill size="sm">Wide shot</Pill>
        </Row>
        <Row label="Misc">
          <Avatar initials="AG" label="[Your name]" />
          <Avatar initials="LL" label="Lakeside Lodge" shape="square" className="bg-primary text-primary-foreground" />
          <span className="text-sm text-ink-muted">
            Press <Kbd>Space</Kbd> to play, <Kbd>⌘</Kbd> <Kbd>Z</Kbd> to undo
          </span>
          <SampleDataNote />
        </Row>
      </Section>

      <Section id="cards" title="Cards and surfaces">
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>Surface card</CardTitle>
              <Badge>Default</Badge>
            </CardHeader>
            <CardBody className="text-sm text-ink-muted">Bordered surface for lists and panels.</CardBody>
          </Card>
          <Card tone="raised">
            <CardHeader>
              <CardTitle>Raised card</CardTitle>
              <AiBadge />
            </CardHeader>
            <CardBody className="text-sm text-ink-muted">Brand card shadow in Workspace; flat in Studio.</CardBody>
          </Card>
          <Card tone="muted">
            <CardHeader>
              <CardTitle>Muted card</CardTitle>
            </CardHeader>
            <CardBody className="flex flex-col gap-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
              <span className="sr-only">Loading placeholder</span>
            </CardBody>
          </Card>
        </div>
      </Section>

      <Section id="forms" title="Forms" note="Every control has a visible label (or a screen-reader label where the design hides it). Errors are announced with the field.">
        <div className="grid gap-6 md:grid-cols-2">
          <Field label="Video title" hint="Shown on review links.">
            <Input placeholder="Summer at the lodge" />
          </Field>
          <Field label="Business email" error="Enter an email address, like name@business.co.nz">
            <Input type="email" defaultValue="lakeside@" />
          </Field>
          <Field label="Content objective">
            <Select
              defaultValue="bookings"
              options={[
                { value: "bookings", label: "Drive summer bookings" },
                { value: "awareness", label: "Brand awareness" },
                { value: "event", label: "Promote an event" },
                { value: "seasonal", label: "Seasonal offer", disabled: true },
              ]}
            />
          </Field>
          <Field label="Disabled field">
            <Input disabled defaultValue="Read only" />
          </Field>
          <Field label="Describe the video" className="md:col-span-2">
            <Textarea defaultValue="A 30 second reel showing a calm morning on the lake, breakfast on the deck and an evening by the fire." />
          </Field>
        </div>
        <div className="grid gap-6 md:grid-cols-3">
          <div className="flex flex-col gap-4">
            <Switch label="Burn in captions" hint="Recommended for social feeds" defaultChecked />
            <Switch label="Add logo end card" />
            <Switch label="Watermark" disabled />
          </div>
          <div className="flex flex-col gap-4">
            <Checkbox label="9:16 Reels and TikTok" defaultChecked />
            <Checkbox label="1:1 Feed" />
            <Checkbox label="16:9 YouTube" />
          </div>
          <RadioGroup
            legend="Length"
            defaultValue="30"
            options={[
              { value: "15", label: "15 seconds" },
              { value: "30", label: "30 seconds", hint: "Best for Reels" },
              { value: "60", label: "60 seconds" },
            ]}
          />
        </div>
      </Section>

      <Section id="nav" title="Tabs and segmented controls">
        <Tabs defaultValue="moments">
          <TabsList aria-label="Clip analysis">
            <TabsTrigger value="moments">Moments</TabsTrigger>
            <TabsTrigger value="scenes">Scenes</TabsTrigger>
            <TabsTrigger value="tags">Tags</TabsTrigger>
          </TabsList>
          <TabsContent value="moments" className="text-sm text-ink-muted">
            Detected moments appear here. Arrow keys move between tabs.
          </TabsContent>
          <TabsContent value="scenes" className="text-sm text-ink-muted">
            Scene strip.
          </TabsContent>
          <TabsContent value="tags" className="text-sm text-ink-muted">
            AI tags.
          </TabsContent>
        </Tabs>
        <Row label="Segmented control">
          <SegmentedControl
            label="Aspect ratio"
            value={aspect}
            onValueChange={(v) => setAspect(v as AspectRatio)}
            options={[
              { value: "9:16", label: <><Smartphone aria-hidden />9:16</> },
              { value: "1:1", label: <><Square aria-hidden />1:1</> },
              { value: "16:9", label: <><Monitor aria-hidden />16:9</> },
            ]}
          />
        </Row>
      </Section>

      <Section id="feedback" title="Progress and feedback">
        <div className="grid items-center gap-8 md:grid-cols-[1fr_auto]">
          <div className="flex flex-col gap-4">
            <ProgressBar label="Upload progress" value={64} />
            <ProgressBar label="Analysing footage" value={38} tone="ai" />
            <ProgressBar label="Render complete" value={100} tone="success" size="sm" />
            <ProgressBar label="Preparing" />
          </div>
          <div className="flex gap-6">
            <ProgressRing label="Storyboard progress" value={72} size={112}>
              <span className="flex flex-col">
                <span className="font-display text-2xl font-semibold">72%</span>
                <span className="font-mono text-[10px] text-ink-muted uppercase">Stage 4/6</span>
              </span>
            </ProgressRing>
            <ProgressRing label="Videos left" value={70} tone="primary" size={112} />
          </div>
        </div>
        <Row label="Toast and modal">
          <Button variant="secondary" onClick={() => toast({ title: "Render complete", description: "Summer reel · 9:16 is ready to download.", tone: "success" })}>
            Success toast
          </Button>
          <Button variant="secondary" onClick={() => toast({ title: "Storyboards ready", description: "3 options to review.", tone: "ai" })}>
            AI toast
          </Button>
          <Button variant="secondary" onClick={() => toast({ title: "Render failed", description: "Our fault. Re-render is free.", tone: "danger" })}>
            Error toast
          </Button>
          <Modal
            trigger={<Button variant="primary">Open modal</Button>}
            title="Render 2 formats?"
            description="Uses 2 video credits. You have 14 left."
            footer={
              <>
                <ModalClose asChild>
                  <Button variant="ghost">Cancel</Button>
                </ModalClose>
                <ModalClose asChild>
                  <Button variant="action">Render · 2 credits</Button>
                </ModalClose>
              </>
            }
          >
            <p className="text-sm text-ink-muted">Design preview: nothing is rendered or charged.</p>
          </Modal>
        </Row>
      </Section>

      <Section
        id="media"
        title="Media"
        note="Placeholder imagery (illustrated cinematic stills) until real photography and footage arrive. Every asset comes from src/content/media.ts, so real files replace these without screen changes."
      >
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <MediaThumb asset={getMedia("lake-kayak")} score={94} />
          <MediaThumb asset={getMedia("coast-sail")} score={88} selected />
          <MediaThumb asset={getMedia("forest-ride")} processing={{ stage: "uploading", progress: 42 }} />
          <MediaThumb asset={getMedia("geo-valley")} processing={{ stage: "analysing" }} />
        </div>
        <div className="grid gap-4 md:grid-cols-[2fr_1fr]">
          <div className="aspect-video rounded-lg bg-surface-muted p-3">
            <VideoFrame asset={getMedia("alpine-sunrise")} ratio="16:9" />
          </div>
          <div className="aspect-video rounded-lg bg-surface-muted p-3 md:aspect-auto md:h-full">
            <VideoFrame asset={getMedia("lake-kayak")} ratio={aspect} safeZones />
          </div>
        </div>
        <Row label="All placeholder scenes">
          <div className="grid w-full grid-cols-3 gap-3 md:grid-cols-9">
            {SCENE_VARIANTS.map((v) => (
              <div key={v} className="flex flex-col gap-1.5">
                <div className="relative aspect-[4/5] overflow-hidden rounded-md">
                  <Scene variant={v} label={`Placeholder scene: ${v}`} />
                </div>
                <span className="font-mono text-[10px] text-ink-muted">{v}</span>
              </div>
            ))}
          </div>
        </Row>
        <Row label="Media library (registry)">
          <div className="grid w-full grid-cols-3 gap-3 md:grid-cols-6 lg:grid-cols-9">
            {assets.map((a) => (
              <MediaThumb key={a.id} asset={a} ratio="1:1" showTag={false} />
            ))}
          </div>
        </Row>
      </Section>

      <Section id="shells" title="Shells" note="The app sidebar follows the theme. Marketing header and footer are always Crossroads Blue on the live site; see the homepage.">
        <div className="flex flex-wrap gap-6">
          <div className="h-[840px] w-62 overflow-hidden rounded-lg border border-line">
            <AppNav />
          </div>
          <div className="flex flex-col gap-4">
            <Logo />
            <Logo size="sm" />
          </div>
        </div>
      </Section>
    </div>
  );
}
