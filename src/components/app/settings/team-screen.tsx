"use client";

import { Crown, Mail, MoreHorizontal, RotateCw, Trash2, UserPlus, X } from "lucide-react";
import { DropdownMenu } from "radix-ui";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RadioGroup } from "@/components/ui/choice";
import { Modal, ModalClose } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input, Textarea } from "@/components/ui/input";
import { Avatar } from "@/components/ui/misc";
import { ProgressBar } from "@/components/ui/progress";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { agoFmt, dateFmt, previewOnly, ROLE_LABEL, ROLE_SUMMARY, SampleBadge, useInitialDialog } from "./preview";
import { SettingsFrame, SettingsSection, type SettingsItem } from "./settings-shell";

/*
  Settings → Team (DESIGN, Stage 5 wires it). Rules shown here are the agreed ones
  (docs/production-plan.md 4.2): one owner; admins manage editors and viewers but not
  the owner or other admins; invitations count toward the plan's seats and expire in
  7 days; ownership transfer needs the workspace name and your password.
*/
type Role = "owner" | "admin" | "editor" | "viewer";
export type TeamMember = { id: string; name: string; email: string; role: Role; joinedAt: string; lastActive: string; you?: boolean };
export type TeamInvite = { id: string; email: string; role: Exclude<Role, "owner">; invitedBy: string; sentAt: string; expiresAt: string };
export type TeamData = { workspace: string; myRole: Role; seats: number | null; members: TeamMember[]; invites: TeamInvite[] };

const initialsOf = (n: string) => n.split(/\s+/).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("");
const RANK: Record<Role, number> = { viewer: 1, editor: 2, admin: 3, owner: 4 };
/** Which roles `me` may give to someone currently at `target` (never owner: that's a transfer). */
const assignable = (me: Role, target: Role): Exclude<Role, "owner">[] =>
  me === "owner" ? (target === "owner" ? [] : ["admin", "editor", "viewer"]) : me === "admin" && RANK[target] < RANK.admin ? ["editor", "viewer"] : [];

export function TeamScreen({ data, settingsItems }: { data: TeamData; settingsItems?: SettingsItem[] }) {
  const [dialog, setDialog] = useInitialDialog();
  const [removing, setRemoving] = useState<TeamMember | null>(null);
  const used = data.members.length + data.invites.length;
  const full = data.seats !== null && used >= data.seats;
  const canInvite = RANK[data.myRole] >= RANK.admin;
  const close = (open: boolean) => !open && setDialog(null);

  return (
    <SettingsFrame
      current="team"
      items={settingsItems}
      title="Team"
      intro={`People who can use ${data.workspace}. Each person signs in with their own account; what they can do depends on their role.`}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <SampleBadge />
          {canInvite ? (
            <Button variant="primary" onClick={() => setDialog("invite")} disabled={full}>
              <UserPlus aria-hidden /> Invite people
            </Button>
          ) : null}
        </div>
      }
    >
      <div className="flex flex-col gap-2.5 rounded-lg border border-line bg-surface p-5 sm:flex-row sm:items-center sm:gap-6">
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <p className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
            <span className="font-semibold">Seats</span>
            <span className="font-mono text-ink-muted">
              {used} of {data.seats ?? "unlimited"} used · {data.invites.length} pending
            </span>
          </p>
          <ProgressBar label="Seats used" value={data.seats ? (used / data.seats) * 100 : 0} size="sm" />
        </div>
        <p className="text-sm text-ink-muted sm:max-w-64">{full ? "All seats are taken. Remove someone or upgrade for more." : "Pending invitations hold a seat until they're accepted or revoked."}</p>
      </div>

      <SettingsSection id="members" title="Members" description="Change a role from the menu on each person. Only the owner can make or remove administrators.">
        <ul className="flex flex-col divide-y divide-line rounded-lg border border-line bg-surface">
          {data.members.map((m) => {
            const options = assignable(data.myRole, m.role);
            const editable = options.length > 0 && !m.you;
            return (
              <li key={m.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 p-4 sm:grid-cols-[minmax(0,1fr)_170px_auto]">
                <div className="flex min-w-0 items-center gap-3">
                  <Avatar initials={initialsOf(m.name)} label={m.name} className={m.role === "owner" ? "bg-primary text-primary-foreground" : undefined} />
                  <div className="flex min-w-0 flex-col">
                    <span className="flex flex-wrap items-center gap-2 font-medium">
                      <span className="truncate">{m.name}</span>
                      {m.you ? <Badge size="sm">You</Badge> : null}
                    </span>
                    <span className="truncate text-sm text-ink-muted">{m.email}</span>
                    <span className="text-xs text-ink-muted">Joined {dateFmt(m.joinedAt)} · Active {agoFmt(m.lastActive)}</span>
                  </div>
                </div>
                <div className="order-3 col-span-2 sm:order-none sm:col-span-1">
                  {m.role === "owner" ? (
                    <Badge tone="primary">
                      <Crown aria-hidden /> Owner
                    </Badge>
                  ) : editable ? (
                    <Select aria-label={`Role for ${m.name}`} defaultValue={m.role} options={[...new Set([m.role, ...options])].map((r) => ({ value: r, label: ROLE_LABEL[r] }))} onValueChange={() => previewOnly("Role not changed")} />
                  ) : (
                    <span className="text-sm">{ROLE_LABEL[m.role]}</span>
                  )}
                </div>
                <div className="order-2 flex justify-end sm:order-none">
                  {editable || (m.you && m.role !== "owner") ? (
                    <DropdownMenu.Root>
                      <DropdownMenu.Trigger aria-label={`More actions for ${m.name}`} className="inline-flex size-9 items-center justify-center rounded-md text-ink-muted hover:bg-surface-muted hover:text-ink">
                        <MoreHorizontal className="size-4" aria-hidden />
                      </DropdownMenu.Trigger>
                      <DropdownMenu.Portal>
                        <DropdownMenu.Content align="end" sideOffset={4} className="z-50 min-w-48 rounded-md border border-line bg-surface p-1 text-sm shadow-float">
                          {m.you ? (
                            <DropdownMenu.Item className="flex cursor-default items-center gap-2 rounded px-2.5 py-2 outline-none data-highlighted:bg-surface-muted" onSelect={() => previewOnly("You haven't left")}>
                              Leave workspace
                            </DropdownMenu.Item>
                          ) : (
                            <DropdownMenu.Item className="flex cursor-default items-center gap-2 rounded px-2.5 py-2 text-danger outline-none data-highlighted:bg-surface-muted" onSelect={() => setRemoving(m)}>
                              <Trash2 className="size-4" aria-hidden /> Remove from workspace
                            </DropdownMenu.Item>
                          )}
                        </DropdownMenu.Content>
                      </DropdownMenu.Portal>
                    </DropdownMenu.Root>
                  ) : (
                    <span className="hidden size-9 sm:block" />
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </SettingsSection>

      <SettingsSection id="invites" title="Pending invitations" description="Invitations are emailed and expire after 7 days. The person accepts by signing in or creating an account with that address.">
        {data.invites.length === 0 ? (
          <p className="rounded-lg border border-dashed border-line-strong p-5 text-sm text-ink-muted">No pending invitations.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-line rounded-lg border border-line bg-surface">
            {data.invites.map((i) => (
              <li key={i.id} className="flex flex-wrap items-center gap-3 p-4">
                <span aria-hidden className="inline-flex size-8 items-center justify-center rounded-full border border-dashed border-line-strong text-ink-muted">
                  <Mail className="size-4" />
                </span>
                <div className="flex min-w-0 flex-1 basis-56 flex-col">
                  <span className="font-medium break-all">{i.email}</span>
                  <span className="text-xs text-ink-muted">
                    {ROLE_LABEL[i.role]} · invited by {i.invitedBy} {agoFmt(i.sentAt)} · expires {dateFmt(i.expiresAt)}
                  </span>
                </div>
                <div className="flex w-full gap-1.5 pl-11 sm:w-auto sm:pl-0">
                  <Button size="sm" variant="ghost" onClick={() => previewOnly("No email was sent")}>
                    <RotateCw aria-hidden /> Resend
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => previewOnly("Invitation not revoked")}>
                    <X aria-hidden /> Revoke
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </SettingsSection>

      <SettingsSection id="roles" title="Roles and permissions" description="Roles apply everywhere: the web app, Autopilot, Studio and connected tools such as Claude.">
        <ul className="grid gap-3 sm:grid-cols-2">
          {(Object.keys(ROLE_LABEL) as Role[]).map((r) => (
            <li key={r} className="flex flex-col gap-1.5 rounded-lg border border-line bg-surface p-4">
              <span className="flex items-center gap-2 font-semibold">
                {r === "owner" ? <Crown className="size-4 text-primary" aria-hidden /> : null}
                {ROLE_LABEL[r]}
              </span>
              <span className="text-sm leading-relaxed text-ink-muted">{ROLE_SUMMARY[r]}</span>
            </li>
          ))}
        </ul>
      </SettingsSection>

      {data.myRole === "owner" ? (
        <SettingsSection id="ownership" title="Ownership" description="The owner is responsible for billing and can delete the workspace. Hand it over if someone else should take that on.">
          <div className="flex flex-wrap items-center gap-4 rounded-lg border border-line bg-surface p-5">
            <div className="flex min-w-0 flex-1 basis-56 flex-col">
              <span className="font-medium">You own {data.workspace}</span>
              <span className="text-sm text-ink-muted">After a transfer you become an administrator.</span>
            </div>
            <Button variant="secondary" onClick={() => setDialog("transfer")}>
              <Crown aria-hidden /> Transfer ownership
            </Button>
          </div>
        </SettingsSection>
      ) : null}

      <InviteDialog open={dialog === "invite"} onOpenChange={close} data={data} />
      <TransferDialog open={dialog === "transfer"} onOpenChange={close} data={data} />
      <Modal
        open={removing !== null}
        onOpenChange={(o) => !o && setRemoving(null)}
        size="sm"
        title={`Remove ${removing?.name ?? ""}?`}
        description="They lose access straight away, and their access tokens for this workspace stop working. Their uploads and videos stay in the workspace."
        footer={
          <>
            <ModalClose asChild>
              <Button variant="ghost">Cancel</Button>
            </ModalClose>
            <Button variant="primary" onClick={() => (setRemoving(null), previewOnly("Nobody was removed"))}>
              Remove
            </Button>
          </>
        }
      />
    </SettingsFrame>
  );
}

function InviteDialog({ open, onOpenChange, data }: { open: boolean; onOpenChange: (o: boolean) => void; data: TeamData }) {
  const [role, setRole] = useState<string>("editor");
  const left = data.seats === null ? null : data.seats - data.members.length - data.invites.length;
  const roles = (data.myRole === "owner" ? ["admin", "editor", "viewer"] : ["editor", "viewer"]) as Exclude<Role, "owner">[];
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Invite people"
      description={`They'll get an email with a link to join ${data.workspace}. ${left === null ? "" : `${left} seat${left === 1 ? "" : "s"} left on your plan.`}`}
      footer={
        <>
          <ModalClose asChild>
            <Button variant="ghost">Cancel</Button>
          </ModalClose>
          <Button variant="primary" onClick={() => (onOpenChange(false), previewOnly("No invitation was sent"))}>
            Send invitations
          </Button>
        </>
      }
    >
      <form className="flex flex-col gap-5" onSubmit={(e) => e.preventDefault()}>
        <Field label="Email addresses" hint="Separate several addresses with commas.">
          <Textarea name="emails" rows={3} placeholder="name@business.com, another@business.com" />
        </Field>
        <RadioGroup legend="Role" value={role} onValueChange={setRole} options={roles.map((r) => ({ value: r, label: ROLE_LABEL[r], hint: ROLE_SUMMARY[r] }))} />
      </form>
    </Modal>
  );
}

function TransferDialog({ open, onOpenChange, data }: { open: boolean; onOpenChange: (o: boolean) => void; data: TeamData }) {
  const candidates = data.members.filter((m) => !m.you && m.role !== "viewer");
  const [to, setTo] = useState(candidates[0]?.id ?? "");
  const [typed, setTyped] = useState("");
  const ok = typed.trim() === data.workspace && to;
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Transfer ownership"
      description="The new owner takes over billing, the plan and the right to delete the workspace. You become an administrator. This can only be undone by the new owner."
      footer={
        <>
          <ModalClose asChild>
            <Button variant="ghost">Cancel</Button>
          </ModalClose>
          <Button variant="primary" disabled={!ok} onClick={() => (onOpenChange(false), previewOnly("Ownership not transferred"))}>
            Transfer ownership
          </Button>
        </>
      }
    >
      <form className="flex flex-col gap-4" onSubmit={(e) => e.preventDefault()}>
        <Field label="New owner" hint="Administrators and editors can become the owner. They'll be emailed.">
          <Select value={to} onValueChange={setTo} options={candidates.map((m) => ({ value: m.id, label: `${m.name} (${ROLE_LABEL[m.role]})` }))} />
        </Field>
        <Field label={<>Type <strong className="font-semibold">{data.workspace}</strong> to confirm</>}>
          <Input value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" />
        </Field>
        <Field label="Your password">
          <Input type="password" autoComplete="current-password" />
        </Field>
        <p className={cn("rounded-md border border-line bg-surface-muted px-3.5 py-2.5 text-sm")}>A confirmation email goes to both of you, and the change is recorded in the workspace audit log.</p>
      </form>
    </Modal>
  );
}
