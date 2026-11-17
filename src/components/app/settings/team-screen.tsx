"use client";

import { Check, Copy, Crown, Mail, MoreHorizontal, RotateCw, Trash2, TriangleAlert, UserPlus, Users, X } from "lucide-react";
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
export type TeamData = {
  workspace: string;
  myRole: Role;
  seats: number | null;
  members: TeamMember[];
  invites: TeamInvite[];
  /** False until Resend is set up: invitations are shared by copying the link (U5). */
  emailDelivery?: boolean;
};
const ROLE_ARTICLE: Record<Role, string> = { owner: "the", admin: "an", editor: "an", viewer: "a" };

const initialsOf = (n: string) => n.split(/\s+/).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("");
const RANK: Record<Role, number> = { viewer: 1, editor: 2, admin: 3, owner: 4 };
/** Which roles `me` may give to someone currently at `target` (never owner: that's a transfer). */
const assignable = (me: Role, target: Role): Exclude<Role, "owner">[] =>
  me === "owner" ? (target === "owner" ? [] : ["admin", "editor", "viewer"]) : me === "admin" && RANK[target] < RANK.admin ? ["editor", "viewer"] : [];

export function TeamScreen({ data, settingsItems }: { data: TeamData; settingsItems?: SettingsItem[] }) {
  const [dialog, setDialog] = useInitialDialog();
  const [removing, setRemoving] = useState<TeamMember | null>(null);
  // U3: a role change is confirmed first (and spelled out when it removes permissions).
  const [roles] = useState<Record<string, Role>>({}); // wired pages update this after a confirmed change
  const [changing, setChanging] = useState<{ member: TeamMember; to: Role } | null>(null);
  const roleOf = (m: TeamMember) => roles[m.id] ?? m.role;
  // Review pages: ?dialog=role shows the confirmation for demoting the first administrator.
  const reviewChange = dialog === "role" ? (() => { const m = data.members.find((x) => x.role === "admin" && !x.you); return m ? { member: m, to: "viewer" as Role } : null; })() : null;
  const pendingChange = changing ?? reviewChange;
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

      {data.members.length === 1 && data.invites.length === 0 && canInvite ? (
        <div className="flex flex-col items-start gap-3 rounded-lg border border-dashed border-line-strong p-6 sm:flex-row sm:items-center sm:gap-5">
          <span aria-hidden className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-surface-muted text-ink-muted">
            <Users className="size-5" />
          </span>
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <p className="font-semibold">Invite your team</p>
            <p className="text-sm text-ink-muted">
              It&apos;s just you so far. Your plan includes {data.seats === null ? "unlimited seats" : `${data.seats} seat${data.seats === 1 ? "" : "s"}`}
              {data.seats === 1 ? ": upgrade to add people." : ", including yours."}
            </p>
          </div>
          {data.seats !== 1 ? (
            <Button variant="secondary" onClick={() => setDialog("invite")}>
              <UserPlus aria-hidden /> Invite people
            </Button>
          ) : null}
        </div>
      ) : null}

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
                    <Select
                      aria-label={`Role for ${m.name}`}
                      value={roleOf(m)}
                      options={[...new Set([m.role, ...options])].map((r) => ({ value: r, label: ROLE_LABEL[r] }))}
                      onValueChange={(v) => v !== roleOf(m) && setChanging({ member: m, to: v as Role })}
                    />
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

      <SettingsSection id="invites" title="Pending invitations" description={
          data.emailDelivery
            ? "Invitations are emailed and expire after 7 days. The person accepts by signing in or creating an account with that address."
            : "Invitations expire after 7 days. Email isn't set up yet, so you copy each link when you invite and send it yourself. The person accepts by signing in or creating an account with that address."
        }>
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
                  <Button size="sm" variant="ghost" onClick={() => previewOnly(data.emailDelivery ? "No email was sent" : "No new link was made")}>
                    <RotateCw aria-hidden /> {data.emailDelivery ? "Resend" : "New link"}
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

      <InviteDialog
        open={dialog === "invite" || dialog === "invite-results"}
        onOpenChange={close}
        data={data}
        reviewResults={dialog === "invite-results" ? `rangi@lakesidelodge.example, ${data.members[1]?.email ?? "member@example.com"}, not-an-email` : undefined}
      />
      <TransferDialog open={dialog === "transfer"} onOpenChange={close} data={data} />
      <Modal
        open={pendingChange !== null}
        onOpenChange={(o) => !o && (setChanging(null), dialog === "role" && setDialog(null))}
        size="sm"
        title={pendingChange ? `Make ${pendingChange.member.name} ${ROLE_ARTICLE[pendingChange.to]} ${ROLE_LABEL[pendingChange.to].toLowerCase()}?` : ""}
        description={
          pendingChange
            ? RANK[pendingChange.to] < RANK[roleOf(pendingChange.member)]
              ? `${pendingChange.member.name} will lose access to some things. As ${ROLE_ARTICLE[pendingChange.to]} ${ROLE_LABEL[pendingChange.to].toLowerCase()} they can: ${ROLE_SUMMARY[pendingChange.to].charAt(0).toLowerCase()}${ROLE_SUMMARY[pendingChange.to].slice(1)} The change applies at once, including to their access tokens.`
              : `As ${ROLE_ARTICLE[pendingChange.to]} ${ROLE_LABEL[pendingChange.to].toLowerCase()} they can also: ${ROLE_SUMMARY[pendingChange.to].charAt(0).toLowerCase()}${ROLE_SUMMARY[pendingChange.to].slice(1)}`
            : undefined
        }
        footer={
          <>
            <ModalClose asChild>
              <Button variant="ghost">Cancel</Button>
            </ModalClose>
            <Button
              variant="primary"
              onClick={() => {
                if (!pendingChange) return;
                setChanging(null);
                if (dialog === "role") setDialog(null);
                previewOnly(`Role not changed (${pendingChange.member.name} stays ${ROLE_LABEL[roleOf(pendingChange.member)].toLowerCase()})`);
              }}
            >
              Change role
            </Button>
          </>
        }
      />
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

/** One line per address after inviting: created (with its link) or the reason it wasn't (U4). */
export type InviteResult = { email: string; link?: string; error?: string };
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
  Design preview only: the same checks the server makes (format, duplicates, already a member,
  already invited, seats), so the result list can be reviewed. The real page shows the results
  from inviteMembers (src/server/services/team.ts) instead. No link is made here.
*/
export function previewInviteResults(raw: string, data: TeamData): InviteResult[] {
  const emails = [...new Set(raw.split(/[\s,;]+/).map((e) => e.trim().toLowerCase()).filter(Boolean))];
  let left = data.seats === null ? Infinity : data.seats - data.members.length - data.invites.length;
  return emails.map((email) => {
    if (!EMAIL_RE.test(email)) return { email, error: "This isn't a valid email address." };
    if (data.members.some((m) => m.email.toLowerCase() === email)) return { email, error: "Already in this workspace." };
    if (data.invites.some((i) => i.email.toLowerCase() === email)) return { email, error: "Already invited. Use New link on their invitation." };
    if (left <= 0) return { email, error: "No seats left on your plan." };
    left -= 1;
    return { email };
  });
}

function InviteDialog({ open, onOpenChange, data, reviewResults }: { open: boolean; onOpenChange: (o: boolean) => void; data: TeamData; reviewResults?: string }) {
  const [role, setRole] = useState<string>("editor");
  const [emails, setEmails] = useState("");
  const [submitted, setResults] = useState<InviteResult[] | null>(null);
  const results = submitted ?? (reviewResults ? previewInviteResults(reviewResults, data) : null);
  const [copied, setCopied] = useState<string | null>(null);
  const left = data.seats === null ? null : data.seats - data.members.length - data.invites.length;
  const roles = (data.myRole === "owner" ? ["admin", "editor", "viewer"] : ["editor", "viewer"]) as Exclude<Role, "owner">[];
  const change = (o: boolean) => {
    if (!o) {
      setResults(null);
      setEmails("");
      setCopied(null);
    }
    onOpenChange(o);
  };
  const created = results?.filter((r) => !r.error).length ?? 0;
  const copy = async (r: InviteResult) => {
    if (!r.link) return previewOnly("Nothing was copied (no invitation was created)");
    try {
      await navigator.clipboard.writeText(r.link);
      setCopied(r.email);
    } catch {
      setCopied(null);
    }
  };
  if (results)
    return (
      <Modal
        open={open}
        onOpenChange={change}
        title={created ? `${created} invitation${created === 1 ? "" : "s"} ready` : "No invitations created"}
        description={
          data.emailDelivery
            ? "Each person gets an email with their link."
            : "Email isn't set up yet. Copy each link and send it to that person yourself: it works once, for that address only, and expires in 7 days."
        }
        footer={
          <Button variant="primary" onClick={() => change(false)}>
            Done
          </Button>
        }
      >
        <ul aria-label="Invitation results" className="flex flex-col divide-y divide-line rounded-lg border border-line">
          {results.map((r) => (
            <li key={r.email} className="flex flex-wrap items-center gap-3 p-3">
              <span aria-hidden className={cn("inline-flex size-7 shrink-0 items-center justify-center rounded-full", r.error ? "bg-danger/10 text-danger" : "bg-success/10 text-success")}>
                {r.error ? <TriangleAlert className="size-4" /> : <Check className="size-4" />}
              </span>
              <span className="flex min-w-0 flex-1 basis-48 flex-col">
                <span className="font-medium break-all">{r.email}</span>
                <span className="text-sm text-ink-muted">{r.error ?? `Invited as ${ROLE_LABEL[role as Role].toLowerCase()}`}</span>
              </span>
              {!r.error && !data.emailDelivery ? (
                <Button size="sm" variant="secondary" onClick={() => copy(r)} aria-label={copied === r.email ? `Copied link for ${r.email}` : `Copy link for ${r.email}`}>
                  {copied === r.email ? <Check aria-hidden /> : <Copy aria-hidden />} {copied === r.email ? "Copied" : "Copy link"}
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
        <p role="status" className="sr-only">
          {created} of {results.length} invitations created.
        </p>
      </Modal>
    );
  return (
    <Modal
      open={open}
      onOpenChange={change}
      title="Invite people"
      description={`${data.emailDelivery ? "They'll get an email with a link to join" : "You'll get a link for each person to join"} ${data.workspace}. ${left === null ? "" : `${left} seat${left === 1 ? "" : "s"} left on your plan.`}`}
      footer={
        <>
          <ModalClose asChild>
            <Button variant="ghost">Cancel</Button>
          </ModalClose>
          <Button variant="primary" disabled={!emails.trim()} onClick={() => setResults(previewInviteResults(emails, data))}>
            {data.emailDelivery ? "Send invitations" : "Create invitations"}
          </Button>
        </>
      }
    >
      <form className="flex flex-col gap-5" onSubmit={(e) => (e.preventDefault(), emails.trim() && setResults(previewInviteResults(emails, data)))}>
        <Field label="Email addresses" hint="Separate several addresses with commas.">
          <Textarea name="emails" rows={3} placeholder="name@business.com, another@business.com" value={emails} onChange={(e) => setEmails(e.target.value)} />
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
