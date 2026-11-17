"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { joinInvitedWorkspace } from "@/app/(app)/_actions/invitations";
import { Button } from "@/components/ui/button";
import { FormMessage } from "./auth-card";

export type PendingInvitation = { id: string; org_name: string; role: string; invited_by_name: string };
const ROLE: Record<string, string> = { admin: "Administrator", editor: "Editor", viewer: "Viewer" };

/* Onboarding: invitations waiting for this confirmed address (works on any device, no link needed). */
export function PendingInvitations({ invitations }: { invitations: PendingInvitation[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, start] = useTransition();
  const join = (id: string) =>
    start(async () => {
      setBusy(id);
      setError(null);
      const r = await joinInvitedWorkspace(id);
      setBusy(null);
      if (!r.ok) return setError(r.error.message);
      router.push("/dashboard?joined=1");
    });
  return (
    <section aria-labelledby="invited-heading" className="flex flex-col gap-3 rounded-lg border border-line bg-surface-muted p-4">
      <h2 id="invited-heading" className="font-display text-base font-semibold">
        You&apos;ve been invited
      </h2>
      {error ? <FormMessage tone="error">{error}</FormMessage> : null}
      <ul className="flex flex-col gap-2.5">
        {invitations.map((i) => (
          <li key={i.id} className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-sm">
              <strong className="font-semibold">{i.org_name}</strong>
              <span className="block text-ink-muted">
                {ROLE[i.role] ?? i.role} · invited by {i.invited_by_name}
              </span>
            </span>
            <Button type="button" variant="primary" size="md" loading={busy === i.id} disabled={busy !== null} onClick={() => join(i.id)}>
              Join
            </Button>
          </li>
        ))}
      </ul>
      <p className="text-sm text-ink-muted">Or set up a workspace of your own below.</p>
    </section>
  );
}
