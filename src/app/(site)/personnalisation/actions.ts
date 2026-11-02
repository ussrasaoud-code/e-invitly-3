"use server";

import { logActivity } from "@/lib/audit";
import { sendEmail } from "@/lib/email";
import { fmt, isSiteLang } from "@/lib/i18n/config";
import { dictFor } from "@/lib/i18n/server";
import { env } from "@/lib/env";
import { hashedClientIp } from "@/lib/net";
import { getSettings } from "@/lib/settings";
import { createAdminClient } from "@/lib/supabase/admin";
import { flattenErrors, requestSchema, type RequestInput } from "@/lib/validation/request";

export type SubmitResult =
  | { ok: true; reference: string; emailSent: boolean }
  | { ok: false; message: string; fieldErrors?: Record<string, string> };

/**
 * Enregistre une demande de personnalisation.
 * 1. anti-abus (champ piège + 5 envois / heure / IP)  2. validation complète
 * 3. insertion en base (référence attribuée par la base)  4. e-mails  5. journal
 * Aucune invitation n'est créée ni publiée ici.
 */
export async function submitRequest(input: RequestInput, uiLang: string = "fr"): Promise<SubmitResult> {
  const t = dictFor(isSiteLang(uiLang) ? uiLang : "fr");
  const err = t.request.errors;
  const db = createAdminClient();
  if (!db) {
    return { ok: false, message: err.notConfigured };
  }

  const ipHash = await hashedClientIp();
  const { data: allowed, error: rlError } = await db.rpc("check_rate_limit", {
    p_bucket: `request:${ipHash}`,
    p_limit: 5,
    p_window_seconds: 3600,
  });
  if (rlError) console.error("[request] rate limit", rlError.message);
  if (allowed === false) {
    return { ok: false, message: err.rate };
  }

  const parsed = requestSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: err.invalid, fieldErrors: flattenErrors(parsed.error) };
  }
  const data = parsed.data;
  if (data.website) {
    // Robot : on répond comme si tout allait bien, sans rien enregistrer.
    return { ok: true, reference: "EI-0000", emailSent: false };
  }

  const { data: template } = await db
    .from("templates")
    .select("id, name, status")
    .eq("slug", data.templateSlug)
    .maybeSingle();
  if (!template || template.status !== "published") {
    return { ok: false, message: err.unavailable };
  }

  const { website: _hp, consent: _c, templateSlug: _s, ...formData } = data;
  void _hp; void _c; void _s;

  const { data: row, error } = await db
    .from("client_requests")
    .insert({
      template_id: template.id,
      contact_first_name: data.firstName,
      contact_last_name: data.lastName,
      email: data.email,
      phone: data.phone || null,
      country: data.country,
      language: data.language,
      partner_one: data.partnerOne,
      partner_two: data.partnerTwo,
      event_date: data.eventDate,
      form_data: formData,
      consent_at: new Date().toISOString(),
      ip_hash: ipHash,
    })
    .select("id, reference")
    .single();

  if (error || !row) {
    console.error("[request] insert", error?.message);
    return { ok: false, message: err.server };
  }

  await logActivity({
    action: "request.created",
    resourceType: "client_request",
    resourceId: row.id,
    summary: `Nouvelle demande ${row.reference} — ${data.partnerOne} & ${data.partnerTwo} (${template.name})`,
  });

  const settings = await getSettings();
  // E-mail de confirmation dans la langue du site où la demande a été faite
  const m = t.email;
  const confirmation = await sendEmail({
    to: data.email,
    subject: fmt(m.subject, { ref: row.reference }),
    heading: m.heading,
    paragraphs: [
      fmt(m.hello, { name: data.firstName }),
      fmt(m.received, { template: template.name, couple: `${data.partnerOne} & ${data.partnerTwo}` }),
      fmt(m.reference, { ref: row.reference }),
      m.noPublish,
      fmt(m.signature, { brand: settings.brand.name }),
    ],
    replyTo: settings.brand.contactEmail || undefined,
    lang: isSiteLang(uiLang) ? uiLang : "fr",
  });
  if (!confirmation.sent) console.warn("[request] e-mail client non envoyé :", confirmation.error);

  const adminTo = process.env.ADMIN_NOTIFICATION_EMAIL || settings.brand.contactEmail;
  if (adminTo && settings.notifications.notifyOnNewRequest) {
    const notice = await sendEmail({
      to: adminTo,
      subject: `Nouvelle demande ${row.reference}`,
      heading: "Nouvelle demande reçue",
      paragraphs: [
        `${data.firstName} ${data.lastName} (${data.email}) — modèle ${template.name}.`,
        `Langue de l'invitation : ${data.language.toUpperCase()} · site consulté en ${uiLang.toUpperCase()}.`,
        `Couple : ${data.partnerOne} & ${data.partnerTwo}, le ${data.eventDate}.`,
        `À traiter dans l'administration : ${env.siteUrl}/admin/demandes/${row.id}`,
      ],
    });
    if (!notice.sent) console.warn("[request] e-mail admin non envoyé :", notice.error);
  }

  return { ok: true, reference: row.reference, emailSent: confirmation.sent };
}
