"use server";

import { logActivity } from "@/lib/audit";
import { sendEmail } from "@/lib/email";
import { fmt, isSiteLang } from "@/lib/i18n/config";
import { dictFor } from "@/lib/i18n/server";
import { env } from "@/lib/env";
import { hashedClientIp } from "@/lib/net";
import { getSettings } from "@/lib/settings";
import { createAdminClient } from "@/lib/supabase/admin";
import { flattenErrors, orderSchema, requestSchema, type OrderInput, type RequestInput } from "@/lib/validation/request";
import { LANG_META } from "@/lib/i18n/config";
import { templateDefinitionSchema } from "@/lib/invitation/schema";
import { ensureAccount } from "@/lib/login-link";
import { composeInvitation, rsvpSettings } from "@/lib/orders";
import { amountFromPriceLabel, formatMoney } from "@/lib/payment-amount";
import { newPaymentToken } from "@/lib/payments";
import { slugFromNames } from "@/lib/slug";
import { suggestSlug } from "@/lib/slug-db";
import { recordTermsVersion } from "@/lib/terms";

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
        `Langue de l'invitation : ${data.language.toUpperCase()}${data.secondLanguage && data.secondLanguage !== data.language ? ` + ${data.secondLanguage.toUpperCase()} (bilingue)` : ""} · site consulté en ${uiLang.toUpperCase()}.`,
        `Couple : ${data.partnerOne} & ${data.partnerTwo}, le ${data.eventDate}.`,
        `À traiter dans l'administration : ${env.siteUrl}/admin/demandes/${row.id}`,
      ],
    });
    if (!notice.sent) console.warn("[request] e-mail admin non envoyé :", notice.error);
  }

  return { ok: true, reference: row.reference, emailSent: confirmation.sent };
}

export type OrderResult = { ok: true; token: string } | { ok: false; message: string; fieldErrors?: Record<string, string> };

/**
 * Commande en ligne (paiement avant le formulaire détaillé) :
 * 1. anti-abus  2. validation  3. demande + invitation (brouillon) + accès client
 * 4. lien de paiement au prix du modèle (fixé ici, côté serveur)  5. e-mails.
 * Rien n'est publié : l'équipe prépare l'aperçu après le formulaire détaillé.
 */
export async function startOrder(input: OrderInput, uiLang: string = "fr"): Promise<OrderResult> {
  const l = isSiteLang(uiLang) ? uiLang : "fr";
  const t = dictFor(l);
  const err = t.request.errors;
  const db = createAdminClient();
  if (!db) return { ok: false, message: err.notConfigured };

  const ipHash = await hashedClientIp();
  const { data: allowed, error: rlError } = await db.rpc("check_rate_limit", { p_bucket: `order:${ipHash}`, p_limit: 5, p_window_seconds: 3600 });
  if (rlError) console.error("[order] rate limit", rlError.message);
  if (allowed === false) return { ok: false, message: err.rate };

  const parsed = orderSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: err.invalid, fieldErrors: flattenErrors(parsed.error) };
  const data = parsed.data;
  if (data.website) return { ok: false, message: err.server }; // robot : rien n'est créé

  const { data: template } = await db
    .from("templates")
    .select("id, name, status, price_label, template_versions!templates_current_version_fk(id, definition)")
    .eq("slug", data.templateSlug)
    .maybeSingle();
  if (!template || template.status !== "published") return { ok: false, message: err.unavailable };
  const version = template.template_versions as unknown as { id: string; definition: unknown } | null;
  const def = templateDefinitionSchema.safeParse(version?.definition);
  const amount = amountFromPriceLabel(template.price_label);
  if (!version || !def.success || !amount) return { ok: false, message: t.order.unavailable };

  const now = new Date().toISOString();
  // Preuves conservées : date et heure des deux cases cochées, et version exacte des CGV acceptée
  const termsHash = await recordTermsVersion(db, (await getSettings()).policies.termsOfSale);
  const formData = {
    secondLanguage: data.secondLanguage,
    eventType: data.eventType,
    selfService: true,
    orderedAt: now,
    termsAcceptedAt: now,
    immediateStartAt: now,
    termsVersion: termsHash,
  };
  const { data: req, error: reqErr } = await db
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
      event_date: data.eventDate || null,
      form_data: formData,
      consent_at: new Date().toISOString(),
      ip_hash: ipHash,
    })
    .select("id, reference, language, partner_one, partner_two, event_date, form_data")
    .single();
  if (reqErr || !req) {
    console.error("[order] demande", reqErr?.message);
    return { ok: false, message: err.server };
  }

  const { content, eventAt } = composeInvitation(def.data, req);
  let invitationId: string | null = null;
  for (let attempt = 0; attempt < 3 && !invitationId; attempt++) {
    const slug = await suggestSlug(db, slugFromNames(data.partnerOne, data.partnerTwo));
    const { data: inv, error: insErr } = await db
      .from("invitations")
      .insert({
        request_id: req.id,
        template_id: template.id,
        template_version_id: version.id,
        renderer: def.data.renderer,
        slug,
        title: `${data.partnerOne} & ${data.partnerTwo}`,
        partner_one: data.partnerOne,
        partner_two: data.partnerTwo,
        client_email: data.email,
        status: "draft",
        event_at: eventAt,
        timezone: content.timezone,
        language: data.language,
        draft_content: content,
        internal_notes: `Commande en ligne ${req.reference} : en attente du paiement, puis du formulaire détaillé du client.`,
      })
      .select("id")
      .single();
    if (inv) invitationId = inv.id;
    else if (insErr?.code !== "23505") {
      console.error("[order] invitation", insErr?.message);
      return { ok: false, message: err.server };
    }
  }
  if (!invitationId) return { ok: false, message: err.server };

  const token = newPaymentToken();
  const [payRes, rsvpRes, accessRes, upRes] = await Promise.all([
    db.from("payments").insert({
      invitation_id: invitationId,
      token,
      amount_cents: amount,
      currency: "EUR",
      description: `${template.name} — ${data.partnerOne} & ${data.partnerTwo}`,
    }),
    db.from("rsvp_forms").insert({ invitation_id: invitationId, ...rsvpSettings(null, content) }),
    db.from("invitation_access").insert({ invitation_id: invitationId, email: data.email, role: "owner" }),
    db.from("client_requests").update({ status: "converted", invitation_id: invitationId }).eq("id", req.id),
  ]);
  if (payRes.error) {
    console.error("[order] paiement", payRes.error.message);
    return { ok: false, message: err.server };
  }
  for (const r of [rsvpRes, accessRes, upRes]) if (r.error) console.error("[order]", r.error.message);
  // Compte de l'espace client (connexion par lien e-mail, sans mot de passe)
  if (!(await ensureAccount(data.email))) console.warn("[order] compte client non créé");

  const couple = `${data.partnerOne} & ${data.partnerTwo}`;
  await logActivity({ action: "order.created", resourceType: "invitation", resourceId: invitationId, summary: `Commande en ligne ${req.reference} — ${couple} (${template.name}), paiement en attente` });

  const settings = await getSettings();
  const price = formatMoney(amount, "EUR", LANG_META[l].intl);
  // Pas d'e-mail au client ici : il est envoyé directement sur la page de paiement, et reçoit
  // la confirmation juste après avoir payé. S'il abandonne, l'équipe peut lui renvoyer le lien
  // depuis l'admin (Publication → Paiement → « Envoyer le lien »).

  const adminTo = process.env.ADMIN_NOTIFICATION_EMAIL || settings.brand.contactEmail;
  if (adminTo && settings.notifications.notifyOnNewRequest) {
    const notice = await sendEmail({
      to: adminTo,
      subject: `Nouvelle commande ${req.reference} (paiement en attente)`,
      heading: "Nouvelle commande en ligne",
      paragraphs: [
        `${data.firstName} ${data.lastName} (${data.email}) — modèle ${template.name}, ${price}.`,
        `Couple : ${couple}${data.eventDate ? `, le ${data.eventDate}` : ""}. Langue : ${data.language.toUpperCase()}${data.secondLanguage && data.secondLanguage !== data.language ? ` + ${data.secondLanguage.toUpperCase()} (bilingue)` : ""}.`,
        `Le client est envoyé sur la page de paiement. S'il ne paie pas, vous pouvez lui renvoyer le lien depuis l'admin : ${env.siteUrl}/admin/invitations/${invitationId}?onglet=publication`,
      ],
    });
    if (!notice.sent) console.warn("[order] e-mail admin non envoyé :", notice.error);
  }
  return { ok: true, token };
}
