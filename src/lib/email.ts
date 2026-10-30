import "server-only";

/**
 * Envoi d'e-mails transactionnels via l'API Resend.
 * Sans RESEND_API_KEY, rien n'est envoyé et la fonction renvoie
 * { sent: false } : l'interface l'indique honnêtement.
 */
export type EmailResult = { sent: boolean; error?: string };

const escape = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function isEmailConfigured() {
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
}

export async function sendEmail(msg: { to: string; subject: string; heading: string; paragraphs: string[]; replyTo?: string }): Promise<EmailResult> {
  if (!isEmailConfigured()) return { sent: false, error: "Service e-mail non configuré" };
  const html = `<!doctype html><html lang="fr"><body style="margin:0;background:#FAF8F4;font-family:Georgia,serif;color:#323330">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:40px 16px">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid #DDD2C3">
<tr><td style="padding:36px 40px 8px;text-align:center;letter-spacing:4px;font-size:13px;color:#586C60">E-INVITLY</td></tr>
<tr><td style="padding:8px 40px 0;text-align:center;font-size:22px">${escape(msg.heading)}</td></tr>
<tr><td style="padding:16px 40px 36px;font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6">
${msg.paragraphs.map((p) => `<p style="margin:0 0 14px">${escape(p)}</p>`).join("")}
</td></tr></table></td></tr></table></body></html>`;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM,
        to: [msg.to],
        subject: msg.subject,
        html,
        text: [msg.heading, ...msg.paragraphs].join("\n\n"),
        reply_to: msg.replyTo,
      }),
    });
    if (!res.ok) return { sent: false, error: `Resend ${res.status}: ${await res.text()}` };
    return { sent: true };
  } catch (e) {
    return { sent: false, error: e instanceof Error ? e.message : String(e) };
  }
}
