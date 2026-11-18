/*
  Transactional emails the APP sends through Resend (invitations). Account emails (confirm,
  reset, email change) are sent by Supabase Auth from supabase/templates/*.html, which share
  this layout and colours. Everything is inline-styled tables: Gmail, Outlook and Apple Mail
  render it the same, and it narrows to one column at phone width (max-width 520px).
  Every dynamic value is HTML-escaped. Links are passed in, never built from user input here.
*/
export type EmailContent = { subject: string; html: string; text: string };

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

/** Footer address stays bracketed until the owner supplies it (CLAUDE.md: [BRACKETS] are owner copy). */
export const EMAIL_FOOTER_ADDRESS = "[COMPANY LEGAL NAME AND POSTAL ADDRESS]";

function layout(o: { title: string; preheader: string; bodyHtml: string; button: { label: string; href: string }; afterHtml: string; siteUrl: string }) {
  const href = esc(o.button.href);
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<title>${esc(o.title)}</title>
</head>
<body style="margin:0;padding:0;background:#F5F8FF;font-family:Inter,-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1A1A1A;">
<div style="display:none;max-height:0;overflow:hidden;">${esc(o.preheader)}</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#F5F8FF;">
  <tr><td align="center" style="padding:40px 16px;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:520px;">
      <tr><td style="padding:0 4px 20px;font-family:'Space Grotesk',Inter,Arial,sans-serif;font-size:20px;font-weight:700;letter-spacing:-0.02em;color:#1A1A1A;">Reeldeal</td></tr>
      <tr><td style="background:#FFFFFF;border:1px solid #DCE6F5;border-radius:16px;padding:32px;">
        <h1 style="margin:0 0 12px;font-family:'Space Grotesk',Inter,Arial,sans-serif;font-size:26px;line-height:1.15;font-weight:600;letter-spacing:-0.02em;color:#1A1A1A;">${esc(o.title)}</h1>
        ${o.bodyHtml}
        <table role="presentation" cellspacing="0" cellpadding="0" style="margin:28px 0;"><tr><td style="border-radius:10px;background:#2038E2;">
          <a href="${href}" style="display:inline-block;padding:14px 24px;font-size:16px;font-weight:600;color:#FFFFFF;text-decoration:none;border-radius:10px;">${esc(o.button.label)}</a>
        </td></tr></table>
        <p style="margin:0 0 6px;font-size:13px;line-height:1.6;color:#4B5563;">Or paste this link into your browser:</p>
        <p style="margin:0 0 24px;font-size:13px;line-height:1.6;word-break:break-all;"><a href="${href}" style="color:#2038E2;">${href}</a></p>
        ${o.afterHtml}
      </td></tr>
      <tr><td style="padding:20px 4px 0;font-size:12px;line-height:1.6;color:#4B5563;">You received this email because someone used Reeldeal to contact you. ${EMAIL_FOOTER_ADDRESS} · <a href="${esc(o.siteUrl)}/privacy" style="color:#4B5563;">Privacy</a></td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;
}

const ROLE = { admin: "an administrator", editor: "an editor", viewer: "a viewer" } as const;
const p = (html: string) => `<p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#36415A;">${html}</p>`;
const small = (html: string) => `<p style="margin:0;font-size:13px;line-height:1.6;color:#4B5563;">${html}</p>`;
const expiry = (iso: string) =>
  new Intl.DateTimeFormat("en-NZ", { timeZone: "Pacific/Auckland", day: "numeric", month: "long", year: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" }).format(new Date(iso));

export type InvitationEmail = {
  to: string;
  workspace: string;
  inviter: string;
  role: keyof typeof ROLE;
  acceptUrl: string;
  expiresAt: string;
  siteUrl: string;
  /** A reminder for an invitation that is still open (same link is never re-sent: a reminder carries a NEW link). */
  reminder?: boolean;
};

/** "X invited you to Y." The link works once, only for this address, until expiresAt. */
export function invitationEmail(e: InvitationEmail): EmailContent {
  const subject = e.reminder ? `Reminder: join ${e.workspace} on Reeldeal` : `${e.inviter} invited you to ${e.workspace} on Reeldeal`;
  const when = expiry(e.expiresAt);
  const html = layout({
    title: e.reminder ? `You're still invited to ${e.workspace}` : `Join ${e.workspace} on Reeldeal`,
    preheader: `${e.inviter} invited you to make videos with ${e.workspace}.`,
    bodyHtml:
      p(`<strong>${esc(e.inviter)}</strong> invited you to join <strong>${esc(e.workspace)}</strong> on Reeldeal as ${ROLE[e.role]}.`) +
      p(`Sign in or create a free account with <strong>${esc(e.to)}</strong> to accept. Reeldeal turns a business's own footage into short videos.`),
    button: { label: `Join ${e.workspace}`, href: e.acceptUrl },
    afterHtml: small(
      `This invitation works once, only for ${esc(e.to)}, and expires on <strong>${esc(when)}</strong>. If you weren't expecting it, you can ignore this email: nothing happens unless you accept.`,
    ),
    siteUrl: e.siteUrl,
  });
  const text = [
    `${e.inviter} invited you to join ${e.workspace} on Reeldeal as ${ROLE[e.role]}.`,
    "",
    `Sign in or create a free account with ${e.to} to accept:`,
    e.acceptUrl,
    "",
    `This invitation works once, only for ${e.to}, and expires on ${when}.`,
    "If you weren't expecting it, you can ignore this email.",
    "",
    EMAIL_FOOTER_ADDRESS,
  ].join("\n");
  return { subject, html, text };
}
