import type { EmailContent } from "./templates";

/*
  Resend sender for the app's own emails (docs/email-resend.md). OFF unless RESEND_API_KEY and
  EMAIL_FROM are both set: then nothing is sent, and the team screen shows "copy link" instead.
    - Idempotency-Key: the same key never sends twice, even if the action is retried (a double
      click, a network retry). Resend keeps keys for 24 hours.
    - Nothing about the message is logged: no address, no link, no body. Logs get the outcome only.
    - A failure never throws into the caller's flow; it returns { sent: false, reason }.
*/
export type EmailConfig = { apiKey?: string; from?: string; replyTo?: string; endpoint?: string };
export type SendResult = { sent: true; id: string } | { sent: false; reason: "not_configured" | "rejected" | "rate_limited" | "unavailable" };

export const emailConfigured = (c: EmailConfig) => Boolean(c.apiKey && c.from);

export async function sendEmail(
  c: EmailConfig,
  msg: EmailContent & { to: string; idempotencyKey: string; tags?: Record<string, string> },
  deps: { fetch?: typeof fetch; log?: { warn: (m: string, d?: Record<string, unknown>) => void } } = {},
): Promise<SendResult> {
  if (!emailConfigured(c)) return { sent: false, reason: "not_configured" };
  const doFetch = deps.fetch ?? fetch;
  try {
    const res = await doFetch(c.endpoint ?? "https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${c.apiKey}`, "content-type": "application/json", "idempotency-key": msg.idempotencyKey },
      body: JSON.stringify({
        from: c.from,
        to: [msg.to],
        subject: msg.subject,
        html: msg.html,
        text: msg.text,
        ...(c.replyTo ? { reply_to: c.replyTo } : {}),
        // Tag values: letters, digits, underscores and dashes only (Resend's rule). Never personal data.
        tags: Object.entries(msg.tags ?? {}).map(([name, value]) => ({ name, value: value.replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 256) })),
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (res.ok) {
      const body = (await res.json().catch(() => ({}))) as { id?: string };
      return { sent: true, id: body.id ?? "" };
    }
    const reason = res.status === 429 ? "rate_limited" : res.status >= 500 ? "unavailable" : "rejected";
    deps.log?.warn("email not sent", { status: res.status, reason, kind: msg.tags?.kind });
    return { sent: false, reason };
  } catch (e) {
    deps.log?.warn("email not sent", { reason: "unavailable", error: (e as Error).name, kind: msg.tags?.kind });
    return { sent: false, reason: "unavailable" };
  }
}
