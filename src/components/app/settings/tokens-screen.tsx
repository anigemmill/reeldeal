"use client";

import { AlertTriangle, Check, Copy, KeyRound, Plus, ShieldAlert, Trash2 } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/choice";
import { Modal, ModalClose } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { agoFmt, dateFmt, previewOnly, ROLE_LABEL, SampleBadge, useInitialDialog } from "./preview";
import { SettingsFrame, SettingsSection, type SettingsItem } from "./settings-shell";

/*
  Settings → Access tokens (DESIGN, implemented after review: D6). Personal access tokens
  for MCP clients such as Claude: 256-bit, shown once, stored hashed, bound to one
  workspace, scoped, expiring, revocable (src/server/auth/tokens.ts). A token can never do
  more than its owner's role. Public remote MCP stays off until OAuth is complete.
*/
type Scope = "mcp:read" | "mcp:write" | "mcp:render";
export type TokenRow = { id: string; name: string; prefix: string; scopes: string[]; createdAt: string; expiresAt: string | null; lastUsedAt: string | null; createdBy: string; revokedAt?: string };
export type TokensData = { workspace: string; myRole: "owner" | "admin" | "editor" | "viewer"; tokens: TokenRow[]; newToken: string };

const SCOPES: { id: Scope; label: string; hint: string }[] = [
  { id: "mcp:read", label: "Read", hint: "See footage, brands, projects, storyboards, exports and usage." },
  { id: "mcp:write", label: "Create and edit", hint: "Upload footage, edit brands and projects, write briefs and storyboards. Needs the Editor role." },
  { id: "mcp:render", label: "Render videos", hint: "Start renders, which spend credits. Each render still needs a confirmed quote." },
];
const SCOPE_SHORT: Record<string, string> = { "mcp:read": "Read", "mcp:write": "Create and edit", "mcp:render": "Render" };
const EXPIRY = [
  { value: "7", label: "7 days" },
  { value: "30", label: "30 days" },
  { value: "90", label: "90 days (recommended)" },
  { value: "365", label: "1 year" },
];
const NOW = Date.parse("2026-11-17T08:00:00Z");

export function TokensScreen({ data, settingsItems }: { data: TokensData; settingsItems?: SettingsItem[] }) {
  const [dialog, setDialog] = useInitialDialog();
  const [revoking, setRevoking] = useState<TokenRow | null>(null);
  const active = data.tokens.filter((t) => !t.revokedAt && (!t.expiresAt || Date.parse(t.expiresAt) > NOW));
  const inactive = data.tokens.filter((t) => !active.includes(t));
  const close = (o: boolean) => !o && setDialog(null);

  return (
    <SettingsFrame
      current="tokens"
      items={settingsItems}
      title="Access tokens"
      intro={`Let tools like Claude work in ${data.workspace} on your behalf. A token can do only what its permissions allow, and never more than your role (${ROLE_LABEL[data.myRole]}).`}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <SampleBadge />
          <Button variant="primary" onClick={() => setDialog("create")}>
            <Plus aria-hidden /> Create token
          </Button>
        </div>
      }
    >
      <div role="note" className="flex gap-3.5 rounded-lg border border-warning/50 bg-warning/10 p-4 text-sm leading-relaxed">
        <ShieldAlert className="mt-0.5 size-5 shrink-0 text-warning" aria-hidden />
        <div className="flex flex-col gap-1.5">
          <p className="font-semibold">Treat a token like your password.</p>
          <p>Anyone with it can act in this workspace as you, within its permissions. Never paste it into chats, emails or shared documents. Revoke it straight away if it might have been exposed.</p>
          <p className="text-ink-muted">For now tokens work with the Reeldeal connector running on your own computer. Connecting from hosted apps arrives with secure sign-in (OAuth) later.</p>
        </div>
      </div>

      <SettingsSection id="active" title="Your tokens" description="Only you can see your tokens. We show the first characters so you can tell them apart; the full token is shown once, when it's created.">
        {active.length === 0 ? (
          <div className="flex flex-col items-start gap-3 rounded-lg border border-dashed border-line-strong p-6">
            <KeyRound className="size-6 text-ink-muted" aria-hidden />
            <p className="text-sm text-ink-muted">No active tokens. Create one to connect Claude or another MCP client.</p>
          </div>
        ) : (
          <ul className="flex flex-col divide-y divide-line rounded-lg border border-line bg-surface">
            {active.map((t) => {
              const days = t.expiresAt ? Math.ceil((Date.parse(t.expiresAt) - NOW) / 86400000) : null;
              return (
                <li key={t.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
                  <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                    <span className="flex flex-wrap items-center gap-2 font-medium">
                      {t.name}
                      <code className="rounded bg-surface-muted px-1.5 py-0.5 font-mono text-xs text-ink-muted">{t.prefix}…</code>
                    </span>
                    <span className="flex flex-wrap gap-1.5">
                      {t.scopes.map((s) => (
                        <Badge key={s} size="sm" tone={s === "mcp:render" ? "warning" : "outline"}>
                          {SCOPE_SHORT[s] ?? s}
                        </Badge>
                      ))}
                    </span>
                    <span className="text-xs text-ink-muted">
                      Created {dateFmt(t.createdAt)} · Last used {agoFmt(t.lastUsedAt)} ·{" "}
                      <span className={cn(days !== null && days <= 7 && "font-semibold text-warning")}>{t.expiresAt ? (days !== null && days <= 7 ? `Expires in ${days} days` : `Expires ${dateFmt(t.expiresAt)}`) : "No expiry"}</span>
                    </span>
                  </div>
                  <Button variant="secondary" size="sm" onClick={() => setRevoking(t)}>
                    <Trash2 aria-hidden /> Revoke
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </SettingsSection>

      {inactive.length ? (
        <SettingsSection id="inactive" title="Revoked and expired" description="Kept for your records. They no longer work.">
          <ul className="flex flex-col divide-y divide-line rounded-lg border border-line bg-surface text-sm text-ink-muted">
            {inactive.map((t) => (
              <li key={t.id} className="flex flex-wrap items-center gap-2 p-4">
                <span className="font-medium text-ink line-through decoration-ink-muted">{t.name}</span>
                <code className="font-mono text-xs">{t.prefix}…</code>
                <span className="ml-auto">{t.revokedAt ? `Revoked ${dateFmt(t.revokedAt)}` : `Expired ${dateFmt(t.expiresAt)}`}</span>
              </li>
            ))}
          </ul>
        </SettingsSection>
      ) : null}

      <SettingsSection id="advice" title="Good practice">
        <ul className="flex flex-col gap-2 text-sm leading-relaxed text-ink-muted">
          {[
            "Make one token per tool or computer, named so you'll recognise it.",
            "Give each token only the permissions it needs. Leave Render off unless the tool should spend credits.",
            "Choose an expiry. Tokens without one are the easiest to forget.",
            "Removing someone from the workspace revokes their tokens for it automatically.",
          ].map((s) => (
            <li key={s} className="flex gap-2.5">
              <Check className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
              {s}
            </li>
          ))}
        </ul>
      </SettingsSection>

      <CreateDialog open={dialog === "create"} onOpenChange={close} onCreated={() => setDialog("created")} data={data} />
      <CreatedDialog open={dialog === "created"} onOpenChange={close} token={data.newToken} />
      <Modal
        open={revoking !== null}
        onOpenChange={(o) => !o && setRevoking(null)}
        size="sm"
        title={`Revoke “${revoking?.name ?? ""}”?`}
        description="Anything using this token stops working immediately. This can't be undone; create a new token if you need one again."
        footer={
          <>
            <ModalClose asChild>
              <Button variant="ghost">Cancel</Button>
            </ModalClose>
            <Button variant="primary" onClick={() => (setRevoking(null), previewOnly("Token not revoked"))}>
              Revoke token
            </Button>
          </>
        }
      />
    </SettingsFrame>
  );
}

function CreateDialog({ open, onOpenChange, onCreated, data }: { open: boolean; onOpenChange: (o: boolean) => void; onCreated: () => void; data: TokensData }) {
  const [scopes, setScopes] = useState<Scope[]>(["mcp:read"]);
  const [expiry, setExpiry] = useState("90");
  const viewer = data.myRole === "viewer";
  const toggle = (s: Scope, on: boolean) => setScopes((cur) => (on ? [...new Set([...cur, s])] : cur.filter((x) => x !== s)));
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Create an access token"
      description={`For ${data.workspace} only. You'll see the token once.`}
      footer={
        <>
          <ModalClose asChild>
            <Button variant="ghost">Cancel</Button>
          </ModalClose>
          <Button variant="primary" disabled={scopes.length === 0} onClick={onCreated}>
            Create token
          </Button>
        </>
      }
    >
      <form className="flex flex-col gap-5" onSubmit={(e) => e.preventDefault()}>
        <Field label="Name" hint="Where you'll use it, e.g. “Claude Desktop on my laptop”.">
          <Input maxLength={80} placeholder="Claude Desktop" autoComplete="off" />
        </Field>
        <fieldset className="flex flex-col gap-3">
          <legend className="mb-1 text-sm font-medium">Permissions</legend>
          {SCOPES.map((s) => (
            <Checkbox key={s.id} label={s.label} hint={s.hint} checked={scopes.includes(s.id)} onCheckedChange={(v) => toggle(s.id, v === true)} disabled={s.id === "mcp:read" || viewer} />
          ))}
          {viewer ? <p className="text-xs text-ink-muted">As a Viewer you can create read-only tokens.</p> : null}
        </fieldset>
        <Field label="Expires after">
          <Select value={expiry} onValueChange={setExpiry} options={EXPIRY} />
        </Field>
        {scopes.includes("mcp:render") ? (
          <p className="flex gap-2.5 rounded-md border border-warning/50 bg-warning/10 px-3.5 py-2.5 text-sm">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
            This token will be able to start renders that spend your workspace&apos;s credits.
          </p>
        ) : null}
      </form>
    </Modal>
  );
}

function CreatedDialog({ open, onOpenChange, token }: { open: boolean; onOpenChange: (o: boolean) => void; token: string }) {
  const [stored, setStored] = useState(false);
  const [copied, setCopied] = useState(false);
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Copy your new token"
      description="This is the only time it's shown. Store it in your MCP client or a password manager now."
      footer={
        <Button variant="primary" disabled={!stored} onClick={() => onOpenChange(false)}>
          Done
        </Button>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-2 rounded-md border border-line bg-surface-muted p-2 pl-3.5">
          <code className="min-w-0 flex-1 font-mono text-sm break-all" aria-label="New access token">
            {token}
          </code>
          <Button size="sm" variant="secondary" onClick={() => setCopied(true)}>
            {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
            {copied ? "Copied" : "Copy"}
          </Button>
        </div>
        <p className="flex gap-2.5 text-sm text-ink-muted">
          <ShieldAlert className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
          We only keep a fingerprint of it, so we can&apos;t show it again. Lost it? Revoke it and create another.
        </p>
        <Checkbox label="I've stored this token somewhere safe" checked={stored} onCheckedChange={(v) => setStored(v === true)} />
      </div>
    </Modal>
  );
}
