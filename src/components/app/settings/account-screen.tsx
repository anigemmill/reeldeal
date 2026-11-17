"use client";

import { CheckCircle2, KeyRound, LogOut, Mail, MonitorSmartphone, ShieldCheck } from "lucide-react";
import { useActionState } from "react";
import { changePassword, requestEmailChange, updateDisplayName } from "@/app/(app)/_actions/account";
import { signOut, signOutEverywhere, type FormState } from "@/app/(app)/(auth)/actions";
import { FormMessage } from "@/components/app/auth/auth-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Modal, ModalClose } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Avatar } from "@/components/ui/misc";
import { SettingsFrame, SettingsSection, type SettingsItem } from "./settings-shell";

/*
  Settings → Account: name, email (secure change: both addresses confirm), password
  (current password required, other sessions signed out), sessions, account details.
  `preview` renders the same screen on sample data for the design review pages:
  nothing is submitted and the page says so.
*/
export type AccountData = {
  name: string;
  initials: string;
  email: string;
  emailVerified: boolean;
  pendingEmail: string | null;
  createdAt: string | null;
  lastSignInAt: string | null;
  workspaces: { name: string; role: string }[];
};

type Act = (s: FormState, f: FormData) => Promise<FormState>;
const previewAct: Act = async () => ({ notice: "Preview only: nothing was saved." });

const fmt = (iso: string | null) => (iso ? new Intl.DateTimeFormat("en-NZ", { day: "numeric", month: "long", year: "numeric" }).format(new Date(iso)) : "Not available");
const fmtTime = (iso: string | null) => (iso ? new Intl.DateTimeFormat("en-NZ", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(iso)) : "Not available");

const EMAIL_STATUS: Record<string, { tone: "notice" | "error"; text: string }> = {
  confirmed: { tone: "notice", text: "Your email address has been changed." },
  one_confirmed: { tone: "notice", text: "One address confirmed. Open the link we sent to the other address to finish the change." },
  link_invalid: { tone: "error", text: "That confirmation link has expired or was already used. Request the change again if your email hasn't changed." },
};

function Messages({ state }: { state: FormState }) {
  if (state?.error) return <FormMessage tone="error">{state.error}</FormMessage>;
  if (state?.notice) return <FormMessage tone="notice">{state.notice}</FormMessage>;
  return null;
}

export function AccountScreen({ data, emailStatus, preview, settingsItems }: { data: AccountData; emailStatus?: string; preview?: boolean; settingsItems?: SettingsItem[] }) {
  const status = emailStatus ? EMAIL_STATUS[emailStatus] : undefined;
  return (
    <SettingsFrame
      current="account"
      items={settingsItems}
      title="Account"
      intro="Your personal sign-in details. These follow you across every workspace you belong to."
      actions={preview ? <Badge tone="outline">Sample data · preview</Badge> : undefined}
    >
      {status ? <FormMessage tone={status.tone}>{status.text}</FormMessage> : null}

      <SettingsSection id="profile" title="Profile" description="How you appear to teammates in your workspaces.">
        <NameForm data={data} action={preview ? previewAct : updateDisplayName} />
      </SettingsSection>

      <SettingsSection id="email" title="Email address" description="Used to sign in and for account emails. Changing it needs confirmation from both the current and the new address.">
        <EmailForm data={data} action={preview ? previewAct : requestEmailChange} />
      </SettingsSection>

      <SettingsSection id="password" title="Password" description="Enter your current password to choose a new one. Other browsers and devices are signed out when it changes.">
        <PasswordForm action={preview ? previewAct : changePassword} />
      </SettingsSection>

      <SettingsSection id="security" title="Sessions and security" description="Where you're signed in, and how your account is protected.">
        <SessionsCard data={data} preview={preview} />
      </SettingsSection>

      <SettingsSection id="details" title="Account details">
        <dl className="grid gap-x-6 gap-y-3 rounded-lg border border-line bg-surface p-5 text-sm sm:grid-cols-[180px_minmax(0,1fr)]">
          <dt className="text-ink-muted">Member since</dt>
          <dd>{fmt(data.createdAt)}</dd>
          <dt className="text-ink-muted">Sign-in method</dt>
          <dd>Email and password</dd>
          <dt className="text-ink-muted">Workspaces</dt>
          <dd>
            <ul className="flex flex-col gap-1.5">
              {data.workspaces.map((w) => (
                <li key={w.name} className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{w.name}</span>
                  <Badge size="sm" tone="outline" className="capitalize">{w.role}</Badge>
                </li>
              ))}
            </ul>
          </dd>
        </dl>
        <p className="text-sm text-ink-muted">To close your account or export your data, contact [SUPPORT EMAIL]. Self-service account deletion is planned.</p>
      </SettingsSection>
    </SettingsFrame>
  );
}

function NameForm({ data, action }: { data: AccountData; action: Act }) {
  const [state, act, pending] = useActionState(action, undefined);
  return (
    <form action={act} className="flex flex-col gap-4 rounded-lg border border-line bg-surface p-5" noValidate>
      <div className="flex items-center gap-3.5">
        <Avatar initials={data.initials} label={data.name} className="size-12 text-base" />
        <div className="flex min-w-0 flex-col">
          <span className="truncate font-semibold">{state?.values?.display_name ?? data.name}</span>
          <span className="truncate text-sm text-ink-muted">{data.email}</span>
        </div>
      </div>
      <Messages state={state} />
      <Field label="Name" error={state?.fieldErrors?.display_name}>
        <Input name="display_name" autoComplete="name" required maxLength={120} defaultValue={state?.values?.display_name ?? data.name} />
      </Field>
      <div>
        <Button type="submit" variant="primary" loading={pending}>
          {pending ? "Saving…" : "Save name"}
        </Button>
      </div>
    </form>
  );
}

function EmailForm({ data, action }: { data: AccountData; action: Act }) {
  const [state, act, pending] = useActionState(action, undefined);
  return (
    <div className="flex flex-col gap-4 rounded-lg border border-line bg-surface p-5">
      <div className="flex flex-wrap items-center gap-3">
        <Mail className="size-5 text-ink-muted" strokeWidth={1.8} aria-hidden />
        <span className="min-w-0 font-medium break-all">{data.email}</span>
        {data.emailVerified ? (
          <Badge tone="success" size="sm">
            <CheckCircle2 aria-hidden /> Verified
          </Badge>
        ) : (
          <Badge tone="warning" size="sm">Not verified</Badge>
        )}
      </div>
      {data.pendingEmail ? (
        <p role="status" className="rounded-md border border-line bg-surface-muted px-3.5 py-2.5 text-sm">
          Waiting for confirmation: changing to <strong className="font-semibold break-all">{data.pendingEmail}</strong>. Open the links sent to both addresses to finish.
        </p>
      ) : null}
      <form action={act} className="flex flex-col gap-4" noValidate>
        <Messages state={state} />
        <Field label="New email address" error={state?.fieldErrors?.new_email}>
          <Input name="new_email" type="email" autoComplete="email" required defaultValue={state?.values?.new_email} />
        </Field>
        <div>
          <Button type="submit" variant="secondary" loading={pending}>
            {pending ? "Sending links…" : "Change email"}
          </Button>
        </div>
      </form>
    </div>
  );
}

function PasswordForm({ action }: { action: Act }) {
  const [state, act, pending] = useActionState(action, undefined);
  const fe = state?.fieldErrors ?? {};
  return (
    <form action={act} className="flex flex-col gap-4 rounded-lg border border-line bg-surface p-5" noValidate>
      <Messages state={state} />
      <Field label="Current password" error={fe.current_password}>
        <Input name="current_password" type="password" autoComplete="current-password" required />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="New password" hint="At least 8 characters." error={fe.new_password}>
          <Input name="new_password" type="password" autoComplete="new-password" required minLength={8} />
        </Field>
        <Field label="Confirm new password" error={fe.confirm_password}>
          <Input name="confirm_password" type="password" autoComplete="new-password" required minLength={8} />
        </Field>
      </div>
      <div>
        <Button type="submit" variant="secondary" loading={pending}>
          <KeyRound aria-hidden />
          {pending ? "Changing…" : "Change password"}
        </Button>
      </div>
    </form>
  );
}

function SessionsCard({ data, preview }: { data: AccountData; preview?: boolean }) {
  return (
    <div className="flex flex-col divide-y divide-line rounded-lg border border-line bg-surface">
      <div className="flex flex-wrap items-center gap-3.5 p-5">
        <MonitorSmartphone className="size-5 text-ink-muted" strokeWidth={1.8} aria-hidden />
        <div className="flex min-w-0 flex-1 basis-56 flex-col">
          <span className="font-medium">This browser</span>
          <span className="text-sm text-ink-muted">Last signed in {fmtTime(data.lastSignInAt)}</span>
        </div>
        <form action={preview ? undefined : signOut}>
          <Button type={preview ? "button" : "submit"} variant="secondary" size="sm">
            <LogOut aria-hidden /> Sign out
          </Button>
        </form>
      </div>
      <div className="flex flex-wrap items-center gap-3.5 p-5">
        <ShieldCheck className="size-5 text-ink-muted" strokeWidth={1.8} aria-hidden />
        <div className="flex min-w-0 flex-1 basis-56 flex-col">
          <span className="font-medium">Every browser and device</span>
          <span className="text-sm text-ink-muted">Sign out everywhere if you used a shared computer or think someone else has access.</span>
        </div>
        <Modal
          title="Sign out everywhere?"
          description="You'll be signed out of Reeldeal on every browser and device, including this one. Uploads in progress elsewhere will stop."
          trigger={
            <Button type="button" variant="secondary" size="sm">
              Sign out everywhere
            </Button>
          }
          footer={
            <>
              <ModalClose asChild>
                <Button variant="ghost">Cancel</Button>
              </ModalClose>
              <form action={preview ? undefined : signOutEverywhere}>
                <Button type={preview ? "button" : "submit"} variant="primary">
                  Sign out everywhere
                </Button>
              </form>
            </>
          }
        />
      </div>
      <div className="flex flex-wrap items-center gap-3.5 p-5">
        <KeyRound className="size-5 text-ink-muted" strokeWidth={1.8} aria-hidden />
        <div className="flex min-w-0 flex-1 basis-56 flex-col">
          <span className="font-medium">Two-step verification</span>
          <span className="text-sm text-ink-muted">An authenticator-app code at sign-in, for owners and admins first.</span>
        </div>
        <Badge tone="outline">Planned</Badge>
      </div>
    </div>
  );
}
