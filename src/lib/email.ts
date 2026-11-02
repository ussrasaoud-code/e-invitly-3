import "server-only";

/**
 * Envoi d'e-mails transactionnels via l'API Resend.
 * Sans RESEND_API_KEY, rien n'est envoyé et la fonction renvoie
 * { sent: false } : l'interface l'indique honnêtement.
 */
export type EmailResult = { sent: boolean; error?: string };

const escape = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Logo en en-tête des e-mails (image hébergée sur le site, fond blanc). */
const logoUrl = () => `${(process.env.NEXT_PUBLIC_SITE_URL || "https://e-invitly.com").replace(/\/$/, "")}/brand/logo-email.png`;

export function isEmailConfigured() {
  return Boolean((process.env.RESEND_API_KEY && process.env.EMAIL_FROM) || process.env.EMAIL_OUTBOX_FILE);
}

type EmailMsg = { to: string; subject: string; heading: string; paragraphs: string[]; replyTo?: string; lang?: string; action?: { label: string; url: string }; after?: string[] };

/** Gabarit HTML des e-mails : logo, titre, texte, bouton. */
export function renderEmail(msg: EmailMsg, lang = "fr", dir = "ltr"): string {
  return `<!doctype html><html lang="${lang}" dir="${dir}"><body dir="${dir}" style="margin:0;background:#FAF8F4;font-family:Georgia,serif;color:#323330">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:40px 16px">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid #DDD2C3">
<tr><td style="padding:32px 40px 4px;text-align:center"><img src="${logoUrl()}" width="200" height="66" alt="E-Invitly" style="display:inline-block;width:200px;height:auto;border:0"></td></tr>
<tr><td style="padding:8px 40px 0;text-align:center;font-size:22px">${escape(msg.heading)}</td></tr>
<tr><td style="padding:16px 40px 36px;font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;text-align:${dir === "rtl" ? "right" : "left"}">
${msg.paragraphs.map((p) => `<p style="margin:0 0 14px">${escape(p)}</p>`).join("")}
${msg.action ? `<p style="margin:24px 0;text-align:center"><a href="${escape(msg.action.url)}" style="display:inline-block;background:#586C60;color:#ffffff;text-decoration:none;padding:13px 28px;font-size:14px;letter-spacing:1px">${escape(msg.action.label)}</a></p>` : ""}
${(msg.after ?? []).map((p) => `<p style="margin:0 0 14px">${escape(p)}</p>`).join("")}
</td></tr></table></td></tr></table></body></html>`;
}

export async function sendEmail(msg: EmailMsg): Promise<EmailResult> {
  const lang = msg.lang ?? "fr";
  const dir = lang === "ar" ? "rtl" : "ltr";
  if (!isEmailConfigured()) return { sent: false, error: "Service e-mail non configuré" };
  // Développement et tests : les e-mails sont écrits dans un fichier au lieu d'être envoyés
  if (process.env.EMAIL_OUTBOX_FILE && !process.env.RESEND_API_KEY) {
    const { appendFileSync } = await import("node:fs");
    const urls = [msg.action?.url, ...(msg.paragraphs.join(" ").match(/https?:\/\/\S+/g) ?? [])].filter(Boolean);
    appendFileSync(process.env.EMAIL_OUTBOX_FILE, `${new Date().toISOString()} ${msg.to} ${urls[0] ?? "-"} ${JSON.stringify(msg.subject)}\n`);
    return { sent: true };
  }
  const html = renderEmail(msg, lang, dir);
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM,
        to: [msg.to],
        subject: msg.subject,
        html,
        text: [msg.heading, ...msg.paragraphs, ...(msg.action ? [`${msg.action.label} : ${msg.action.url}`] : []), ...(msg.after ?? [])].join("\n\n"),
        reply_to: msg.replyTo,
      }),
    });
    if (!res.ok) return { sent: false, error: `Resend ${res.status}: ${await res.text()}` };
    return { sent: true };
  } catch (e) {
    return { sent: false, error: e instanceof Error ? e.message : String(e) };
  }
}
