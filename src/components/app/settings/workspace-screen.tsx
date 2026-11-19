"use client";

import { Copy, Crown, ExternalLink, MapPin, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox, Switch } from "@/components/ui/choice";
import { Modal, ModalClose } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Avatar } from "@/components/ui/misc";
import { Select } from "@/components/ui/select";
import type { ActionResult } from "@/server/app/result";
import { perform } from "./live";
import { dateFmt, previewOnly, ROLE_LABEL, SampleBadge, useInitialDialog } from "./preview";
import { SettingsFrame, SettingsSection, type SettingsItem } from "./settings-shell";

/*
  Settings → Workspace (DESIGN, wired in Stage 5). Business details feed the first
  brand profile and AI briefs; preferences are workspace-wide defaults. Admins can
  edit; only the owner sees transfer and delete.
*/
export type WorkspaceData = {
  myRole: "owner" | "admin" | "editor" | "viewer";
  org: { name: string; legalName: string; industry: string; website: string; location: string; phone: string; slug: string; id: string; createdAt: string; region: string; aiConsent: boolean; defaultFormats: string[] };
  owner: { name: string; email: string };
  planName: string;
  brands: { used: number; limit: number | null };
  brand: { name: string; version: number; colours: string[]; voice: string; updatedAt: string };
  industries: readonly string[];
};
export type WorkspaceDetails = { name: string; legal_name: string; industry: string; website: string; location: string; phone: string; default_formats?: string[] };
/** Server actions (src/app/(app)/_actions/settings.ts). Absent on the design review page. */
export type WorkspaceActions = {
  save: (input: Partial<WorkspaceDetails>) => Promise<ActionResult<unknown>>;
  setConsent: (enabled: boolean) => Promise<ActionResult<unknown>>;
  leave: () => Promise<ActionResult<unknown>>;
  /** Live links (the review page links to the other review screens). */
  billingHref: string;
  transferHref: string;
};

const FORMATS = [
  { id: "9:16", label: "9:16 vertical", hint: "Reels, TikTok, Shorts, Stories" },
  { id: "1:1", label: "1:1 square", hint: "Feed posts" },
  { id: "4:5", label: "4:5 portrait", hint: "Instagram and Facebook feed" },
  { id: "16:9", label: "16:9 landscape", hint: "YouTube, website, TV" },
];

export function WorkspaceScreen({ data, settingsItems, actions }: { data: WorkspaceData; settingsItems?: SettingsItem[]; actions?: WorkspaceActions }) {
  const [dialog, setDialog] = useInitialDialog();
  const router = useRouter();
  const [consent, setConsent] = useState(data.org.aiConsent);
  const [industry, setIndustry] = useState(data.org.industry);
  const [formats, setFormats] = useState<string[]>(data.org.defaultFormats);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const canEdit = data.myRole === "owner" || data.myRole === "admin";
  const o = data.org;
  const saveDetails = async (form: HTMLFormElement) => {
    if (!actions) return previewOnly();
    const f = new FormData(form);
    const v = (k: string) => String(f.get(k) ?? "");
    setBusy(true);
    await perform(actions.save({ name: v("name"), legal_name: v("legal_name"), industry, website: v("website"), location: v("location"), phone: v("phone") }), "Business details saved");
    setBusy(false);
  };

  return (
    <SettingsFrame current="workspace" items={settingsItems} title="Workspace" intro="Details about your business and how this workspace works for everyone in it." actions={actions ? undefined : <SampleBadge />}>
      <SettingsSection id="business" title="Business information" description="Used in your brand profile and to give AI briefs the right context. Only administrators can change it.">
        <form className="flex flex-col gap-4 rounded-lg border border-line bg-surface p-5" onSubmit={(e) => (e.preventDefault(), void saveDetails(e.currentTarget))}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Business name" hint="Also the workspace name.">
              <Input name="name" defaultValue={o.name} disabled={!canEdit} autoComplete="organization" required minLength={2} maxLength={120} />
            </Field>
            <Field label="Legal name (optional)" hint="For invoices.">
              <Input name="legal_name" defaultValue={o.legalName} disabled={!canEdit} maxLength={200} />
            </Field>
            <Field label="Industry">
              <Select value={industry} onValueChange={setIndustry} disabled={!canEdit} options={data.industries.map((i) => ({ value: i, label: i }))} />
            </Field>
            <Field label="Website">
              <Input name="website" defaultValue={o.website} inputMode="url" disabled={!canEdit} maxLength={300} />
            </Field>
            <Field label="Location (optional)">
              <Input name="location" defaultValue={o.location} disabled={!canEdit} maxLength={120} />
            </Field>
            <Field label="Phone (optional)">
              <Input name="phone" defaultValue={o.phone} type="tel" disabled={!canEdit} maxLength={40} />
            </Field>
          </div>
          {canEdit ? (
            <div>
              <Button type="submit" variant="primary" disabled={busy}>
                Save changes
              </Button>
            </div>
          ) : (
            <p className="text-sm text-ink-muted">Ask an administrator to change these details.</p>
          )}
        </form>
      </SettingsSection>

      <SettingsSection id="details" title="Workspace details">
        <dl className="grid gap-x-6 gap-y-3 rounded-lg border border-line bg-surface p-5 text-sm sm:grid-cols-[170px_minmax(0,1fr)]">
          <dt className="text-ink-muted">Plan</dt>
          <dd className="flex flex-wrap items-center gap-2">
            {data.planName}
            <Link href={actions?.billingHref ?? "/design-system/screens/billing"} className="text-link underline underline-offset-4">
              Usage and billing
            </Link>
          </dd>
          <dt className="text-ink-muted">Workspace ID</dt>
          <dd className="flex min-w-0 items-center gap-2">
            <code className="truncate font-mono text-xs">{o.id}</code>
            <button
              type="button"
              aria-label="Copy workspace ID"
              onClick={async () => {
                if (!actions) return previewOnly("Copied nothing");
                try {
                  await navigator.clipboard.writeText(o.id);
                  void perform(Promise.resolve({ ok: true as const, data: null }), "Workspace ID copied");
                } catch {
                  /* clipboard blocked: the ID is visible to copy by hand */
                }
              }}
              className="inline-flex size-8 shrink-0 items-center justify-center rounded-md text-ink-muted hover:bg-surface-muted"
            >
              <Copy className="size-4" aria-hidden />
            </button>
          </dd>
          <dt className="text-ink-muted">Created</dt>
          <dd>{dateFmt(o.createdAt, { day: "numeric", month: "long", year: "numeric" })}</dd>
          <dt className="text-ink-muted">Data stored in</dt>
          <dd className="flex items-center gap-1.5">
            <MapPin className="size-4 text-ink-muted" aria-hidden /> {o.region}
          </dd>
        </dl>
      </SettingsSection>

      <SettingsSection id="brand" title="Brand profile" description={`Your default brand for new videos. ${data.brands.used} of ${data.brands.limit ?? "unlimited"} brand profiles used on your plan.`}>
        <div className="flex flex-col gap-4 rounded-lg border border-line bg-surface p-5 sm:flex-row sm:items-center">
          <div className="flex shrink-0 overflow-hidden rounded-md border border-line" aria-label={`Brand colours: ${data.brand.colours.join(", ")}`} role="img">
            {data.brand.colours.map((c) => (
              <span key={c} className="h-14 w-8" style={{ background: c }} />
            ))}
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="flex flex-wrap items-center gap-2 font-semibold">
              {data.brand.name} <Badge size="sm" tone="outline">Default</Badge> <Badge size="sm">v{data.brand.version}</Badge>
            </span>
            <span className="text-sm text-ink-muted">“{data.brand.voice}”</span>
            <span className="text-xs text-ink-muted">Updated {dateFmt(data.brand.updatedAt)}</span>
          </div>
          {/* U8: editors and above edit brands; viewers can only look. */}
          <Button asChild variant="secondary">
            <Link href="/brands">
              {data.myRole === "viewer" ? "View brand" : "Edit brand"} <ExternalLink aria-hidden />
            </Link>
          </Button>
        </div>
      </SettingsSection>

      <SettingsSection id="preferences" title="Workspace preferences" description="Defaults for everyone in this workspace. People can still change them on each video.">
        <div className="flex flex-col gap-5 rounded-lg border border-line bg-surface p-5">
          <fieldset className="flex flex-col gap-3">
            <legend className="mb-1 text-sm font-medium">Default video formats</legend>
            <div className="grid gap-3 sm:grid-cols-2">
              {FORMATS.map((f) => (
                <Checkbox
                  key={f.id}
                  label={f.label}
                  hint={f.hint}
                  checked={formats.includes(f.id)}
                  onCheckedChange={(v) => setFormats((cur) => (v === true ? [...new Set([...cur, f.id])] : cur.filter((x) => x !== f.id)))}
                  disabled={!canEdit}
                />
              ))}
            </div>
            {canEdit ? (
              <div>
                <Button
                  variant="secondary"
                  disabled={busy || formats.length === 0}
                  onClick={async () => {
                    if (!actions) return previewOnly();
                    setBusy(true);
                    await perform(actions.save({ default_formats: formats }), "Default formats saved");
                    setBusy(false);
                  }}
                >
                  Save formats
                </Button>
                {formats.length === 0 ? <p className="mt-2 text-xs text-ink-muted">Choose at least one format.</p> : null}
              </div>
            ) : null}
          </fieldset>
          <div className="border-t border-line pt-5">
            <Switch
              label="Let AI look at keyframes from your footage"
              hint="Stills from each clip (never whole videos) are sent to our AI provider to describe scenes and find best moments. Off: analysis still measures quality, length and shot changes."
              checked={consent}
              onCheckedChange={async (v) => {
                if (!actions) return setConsent(v), previewOnly("Setting not changed");
                setConsent(v);
                const r = await perform(actions.setConsent(v), v ? "AI can now look at keyframes" : "AI keyframe analysis turned off");
                if (!r) setConsent(!v);
              }}
              disabled={!canEdit}
            />
          </div>
        </div>
      </SettingsSection>

      <SettingsSection id="ownership" title="Ownership" description="The owner manages billing and is the only person who can delete the workspace.">
        <div className="flex flex-wrap items-center gap-4 rounded-lg border border-line bg-surface p-5">
          <Avatar initials={data.owner.name.split(" ").map((w) => w[0]).join("").slice(0, 2)} label={data.owner.name} className="bg-primary text-primary-foreground" />
          <div className="flex min-w-0 flex-1 basis-56 flex-col">
            <span className="flex items-center gap-2 font-medium">
              {data.owner.name} <Crown className="size-4 text-primary" aria-label="Owner" />
            </span>
            <span className="truncate text-sm text-ink-muted">{data.owner.email}</span>
          </div>
          {data.myRole === "owner" ? (
            <Button asChild variant="secondary">
              <Link href={actions?.transferHref ?? "/design-system/screens/team?dialog=transfer"}>Transfer ownership</Link>
            </Button>
          ) : (
            <span className="text-sm text-ink-muted">Your role: {ROLE_LABEL[data.myRole]}</span>
          )}
        </div>
      </SettingsSection>

      <SettingsSection id="danger" title="Leave or delete" description="These can’t be undone.">
        <div className="flex flex-col divide-y divide-line rounded-lg border border-danger/40 bg-surface">
          {data.myRole !== "owner" ? (
            <div className="flex flex-wrap items-center gap-4 p-5">
              <div className="flex min-w-0 flex-1 basis-56 flex-col">
                <span className="font-medium">Leave this workspace</span>
                <span className="text-sm text-ink-muted">You&apos;ll lose access until someone invites you again.</span>
              </div>
              <Button
                variant="secondary"
                disabled={busy}
                onClick={async () => {
                  if (!actions) return previewOnly("You haven't left");
                  if (!window.confirm(`Leave ${o.name}? You'll lose access until someone invites you again.`)) return;
                  setBusy(true);
                  const r = await perform(actions.leave(), `You left ${o.name}`);
                  setBusy(false);
                  if (r) {
                  router.push("/dashboard");
                  router.refresh();
                }
                }}
              >
                Leave workspace
              </Button>
            </div>
          ) : null}
          <div className="flex flex-wrap items-center gap-4 p-5">
            <div className="flex min-w-0 flex-1 basis-56 flex-col">
              <span className="font-medium">Delete workspace</span>
              <span className="text-sm text-ink-muted">Everyone loses access at once. Footage, brands, projects and exports are deleted after a recovery period of [30 days, TO CONFIRM], during which you can cancel. Invoices and records we must keep by law are kept. Owner only.</span>
              {actions ? <span className="mt-1 text-sm font-medium">Not available yet: deletion waits for the data-retention decisions. Contact support to close a workspace.</span> : null}
            </div>
            <Button variant="secondary" className="border-danger/50 text-danger hover:bg-danger/10" disabled={data.myRole !== "owner" || Boolean(actions)} onClick={() => setDialog("delete")}>
              <Trash2 aria-hidden /> Delete workspace
            </Button>
          </div>
        </div>
      </SettingsSection>

      <Modal
        open={dialog === "delete"}
        onOpenChange={(v) => !v && (setDialog(null), setTyped(""))}
        title={`Delete ${o.name}?`}
        description="Everyone loses access straight away. Content is deleted after [30 days, TO CONFIRM]; until then you can cancel by signing in. Download anything you want to keep first."
        footer={
          <>
            <ModalClose asChild>
              <Button variant="ghost">Cancel</Button>
            </ModalClose>
            <Button variant="primary" className="bg-danger text-danger-foreground hover:bg-danger/90" disabled={typed.trim() !== o.name} onClick={() => (setDialog(null), previewOnly("Nothing was deleted"))}>
              Delete workspace
            </Button>
          </>
        }
      >
        <form className="flex flex-col gap-4" onSubmit={(e) => e.preventDefault()}>
          <Field label={<>Type <strong className="font-semibold">{o.name}</strong> to confirm</>}>
            <Input value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" />
          </Field>
          <Field label="Your password">
            <Input type="password" autoComplete="current-password" />
          </Field>
        </form>
      </Modal>
    </SettingsFrame>
  );
}
