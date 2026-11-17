"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { acceptInvitationAction, loadInvitation, type InviteView } from "@/app/(app)/_actions/invitations";
import { Button } from "@/components/ui/button";
import type { InvitationPreview } from "@/server/services/team";
import { FormMessage } from "./auth-card";

/*
  Reads the invitation token from the URL fragment (/invite#rdl_inv_…). Browsers never send the
  fragment to the server, so the token stays out of access logs, analytics and Referer headers.
  The page removes it from the address bar at once and keeps it in this tab's sessionStorage, so
  it survives signing in or creating an account in the same tab. Accepting, or a final answer
  (expired, revoked, used), clears it.
*/
const KEY = "rd_invite";
const TOKEN = /^rdl_inv_[A-Za-z0-9_-]{43}$/;
const ROLE_LABEL: Record<string, string> = { admin: "an administrator", editor: "an editor", viewer: "a viewer" };

function readToken(): string | null {
  try {
    const fromHash = window.location.hash.slice(1);
    if (TOKEN.test(fromHash)) {
      sessionStorage.setItem(KEY, fromHash);
      window.history.replaceState(null, "", window.location.pathname + window.location.search);
      return fromHash;
    }
    const kept = sessionStorage.getItem(KEY);
    return kept && TOKEN.test(kept) ? kept : null;
  } catch {
    const fromHash = window.location.hash.slice(1);
    return TOKEN.test(fromHash) ? fromHash : null;
  }
}
const forget = () => {
  try {
    sessionStorage.removeItem(KEY);
  } catch {}
};

const linkClass = "font-medium text-link underline-offset-4 hover:underline";

export function InvitationAccept() {
  const router = useRouter();
  // One state update, from an async callback, once the fragment has been read in the browser.
  const [loaded, setLoaded] = useState<{ token: string | null; view: InviteView | null; error: string | null } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const token = loaded?.token ?? null;
  const view = loaded?.view ?? null;

  useEffect(() => {
    const load = () => {
      const t = readToken();
      (t ? loadInvitation(t) : Promise.resolve(null)).then(
        (v) => setLoaded({ token: t, view: v, error: null }),
        () => setLoaded({ token: t, view: null, error: "We couldn't load this invitation. Check your connection and try again." }),
      );
    };
    load();
    // Pasting another invitation link into this tab only changes the fragment: read it again.
    window.addEventListener("hashchange", load);
    return () => window.removeEventListener("hashchange", load);
  }, []);

  useEffect(() => {
    const s = view && "preview" in view ? view.preview?.status : null;
    if (s === "expired" || s === "revoked" || s === "used" || s === "member") forget();
  }, [view]);

  if (!loaded) return <p role="status" className="text-sm text-ink-muted">Checking your invitation…</p>;

  if (!token)
    return (
      <div className="flex flex-col gap-4">
        <FormMessage tone="error">This invitation link is incomplete. Open the full link from your invitation, or ask the person who invited you for a new one.</FormMessage>
        <p className="text-sm text-ink-muted">
          Already a member? <Link href="/dashboard" className={linkClass}>Go to your dashboard</Link>
        </p>
      </div>
    );

  if (loaded.error || !view) return <FormMessage tone="error">{loaded.error}</FormMessage>;

  if (!view.signedIn)
    return (
      <div className="flex flex-col gap-4">
        <p className="text-[15px] leading-relaxed text-ink-muted">
          Sign in or create an account with the email address the invitation was sent to. You&apos;ll come straight back here to accept it.
        </p>
        <div className="flex flex-col gap-2.5 sm:flex-row">
          <Button asChild variant="primary" size="lg">
            <Link href="/sign-in?next=/invite">Sign in</Link>
          </Button>
          <Button asChild variant="secondary" size="lg">
            <Link href="/sign-up?next=/invite">Create an account</Link>
          </Button>
        </div>
      </div>
    );

  if (!view.verified)
    return (
      <div className="flex flex-col gap-4">
        <FormMessage tone="notice">Confirm your email address first. We sent a link to {view.email ?? "your inbox"}. Then open this invitation again.</FormMessage>
        <Link href="/verify-email" className={linkClass}>Resend the confirmation email</Link>
      </div>
    );

  const p = view.preview ?? { status: "not_found" as const };
  const signedInAs = (
    <p className="text-sm text-ink-muted">
      Signed in as <strong className="font-medium text-ink">{view.email}</strong>.
    </p>
  );

  if (p.status === "not_found" || p.status === "other_account")
    return (
      <div className="flex flex-col gap-4">
        <FormMessage tone="error">
          {p.status === "other_account"
            ? "This invitation was sent to a different email address. Sign out and sign in with that address, or ask for a new invitation."
            : "We couldn't find this invitation. The link may be mistyped, or a newer invitation replaced it."}
        </FormMessage>
        {signedInAs}
      </div>
    );

  const d = p as Extract<InvitationPreview, { org_name: string }>;
  if (d.status === "member")
    return (
      <div className="flex flex-col gap-4">
        <FormMessage tone="notice">You&apos;re already a member of {d.org_name}.</FormMessage>
        <Button asChild variant="primary" size="lg">
          <Link href="/dashboard">Open {d.org_name}</Link>
        </Button>
      </div>
    );

  if (d.status !== "open") {
    const closed = d.status;
    return (
      <div className="flex flex-col gap-4">
        <FormMessage tone="error">
          {closed === "expired" ? "This invitation has expired." : closed === "revoked" ? "This invitation was withdrawn." : "This invitation has already been used."} Ask{" "}
          {d.invited_by_name} at {d.org_name} to send you a new one.
        </FormMessage>
        {signedInAs}
      </div>
    );
  }

  const accept = () =>
    start(async () => {
      setError(null);
      const r = await acceptInvitationAction(token);
      if (!r.ok) return setError(r.error.message);
      forget();
      router.push("/dashboard?joined=1");
    });

  return (
    <div className="flex flex-col gap-5">
      <p className="text-[15px] leading-relaxed">
        <strong className="font-semibold">{d.invited_by_name}</strong> invited you to join <strong className="font-semibold">{d.org_name}</strong> as{" "}
        {ROLE_LABEL[d.role] ?? d.role}.
      </p>
      {error ? <FormMessage tone="error">{error}</FormMessage> : null}
      <Button type="button" variant="primary" size="lg" loading={pending} onClick={accept}>
        Join {d.org_name}
      </Button>
      {signedInAs}
    </div>
  );
}
