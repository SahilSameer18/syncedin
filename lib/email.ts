/**
 * Server-only email send helper.
 *
 * Uses Resend when RESEND_API_KEY is set. If not configured, falls back to a
 * console.log so the app still runs in local dev without an API key.
 *
 * From-address: NOTIFICATION_FROM_EMAIL (default: "SyncedIn <notify@syncedin.org>")
 * The domain must be verified in Resend before sends succeed in production.
 */

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL =
  process.env.NOTIFICATION_FROM_EMAIL || "SyncedIn <notify@syncedin.org>";

export type SendEmailParams = {
  to: string;
  subject: string;
  text: string;
  html?: string;
  replyTo?: string;
};

export type SendEmailResult =
  | { ok: true; id: string | null; skipped?: boolean }
  | { ok: false; error: string };

export async function sendEmail(
  params: SendEmailParams
): Promise<SendEmailResult> {
  const { to, subject, text, html, replyTo } = params;
  if (!to || !subject || (!text && !html)) {
    return { ok: false, error: "missing_fields" };
  }

  if (!RESEND_API_KEY) {
    console.log(
      "[email] no RESEND_API_KEY — skipping send.",
      JSON.stringify({ to, subject, replyTo }, null, 0)
    );
    return { ok: true, id: null, skipped: true };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${RESEND_API_KEY}`
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [to],
        subject,
        text,
        html: html || undefined,
        reply_to: replyTo || undefined
      })
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      console.error("[email] resend send failed", res.status, detail);
      return { ok: false, error: `resend_${res.status}` };
    }
    const j = (await res.json().catch(() => null)) as { id?: string } | null;
    return { ok: true, id: j?.id ?? null };
  } catch (e) {
    console.error("[email] resend send threw", e);
    return { ok: false, error: "network_error" };
  }
}

/**
 * Minimal HTML email wrapper. Inline styles only (most email clients strip
 * <style> blocks). Keep it utilitarian — most reads happen in iMessage-style
 * preview cards.
 */
export function renderEmailHtml(opts: {
  preheader?: string;
  heading: string;
  body: string;
  ctaText?: string;
  ctaUrl?: string;
  footerNote?: string;
}): string {
  const { preheader, heading, body, ctaText, ctaUrl, footerNote } = opts;
  const escaped = (s: string) =>
    s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

  return `<!doctype html>
<html><body style="margin:0;padding:0;background:#0b0f17;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#e7eaf0;">
${preheader ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escaped(preheader)}</div>` : ""}
<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#0b0f17;padding:32px 16px;">
  <tr><td align="center">
    <table role="presentation" cellpadding="0" cellspacing="0" width="560" style="max-width:560px;background:#121826;border:1px solid #1f2937;border-radius:12px;padding:32px;">
      <tr><td>
        <div style="font-family:'IBM Plex Mono',ui-monospace,monospace;font-size:12px;letter-spacing:0.18em;color:#f59e0b;text-transform:uppercase;margin-bottom:16px;">SyncedIn</div>
        <h1 style="margin:0 0 16px 0;font-size:22px;font-weight:700;color:#fff;line-height:1.3;">${escaped(heading)}</h1>
        <div style="font-size:15px;line-height:1.6;color:#d1d5db;">${body}</div>
        ${
          ctaText && ctaUrl
            ? `<div style="margin:24px 0 8px 0;"><a href="${escaped(ctaUrl)}" style="display:inline-block;background:#f59e0b;color:#0b0f17;text-decoration:none;font-weight:700;padding:12px 18px;border-radius:8px;font-size:14px;">${escaped(ctaText)}</a></div>`
            : ""
        }
        ${
          footerNote
            ? `<div style="margin-top:24px;padding-top:16px;border-top:1px solid #1f2937;font-size:12px;color:#6b7280;line-height:1.5;">${footerNote}</div>`
            : ""
        }
      </td></tr>
    </table>
    <div style="margin-top:16px;font-size:11px;color:#6b7280;">
      <a href="https://syncedin.org/settings/notifications" style="color:#6b7280;">notification settings</a> · <a href="https://syncedin.org" style="color:#6b7280;">syncedin.org</a>
    </div>
  </td></tr>
</table>
</body></html>`;
}
