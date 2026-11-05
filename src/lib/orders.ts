import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { usedGroups } from "./invitation/audience";
import { newAlt } from "./invitation/bilingual";
import { buildInvitationFromRequest, type RequestFormData } from "./invitation/from-request";
import { LANGUAGES, type InvitationContent, type Language, type TemplateDefinition } from "./invitation/schema";
import { contentFor, getVariant } from "./invitation/variants";
import { newGroupToken } from "./publication";
import { DEFAULT_RSVP_FIELDS, cleanQuestions, rsvpChoicesSchema } from "./rsvp";
import { zonedToUtc } from "./time";

/**
 * Logique commune à la conversion d'une demande (équipe) et aux commandes
 * payées en ligne (le client remplit ensuite ses informations dans son espace).
 */

export type RequestLike = {
  language: string;
  partner_one: string | null;
  partner_two: string | null;
  event_date: string | null;
  form_data: unknown;
};

/** Contenu de l'invitation à partir des réponses du client et de la version du modèle. */
export function composeInvitation(def: TemplateDefinition, req: RequestLike) {
  const fd = (req.form_data ?? {}) as Partial<RequestFormData> & { secondLanguage?: string };
  const lang = req.language as Language;
  const formData = { ...fd, partnerOne: req.partner_one ?? "", partnerTwo: req.partner_two ?? "", eventDate: req.event_date ?? "", language: lang };
  // Version du modèle dans la langue choisie par le client (sinon la version principale, à traduire)
  const built = buildInvitationFromRequest(contentFor(def, lang), formData as RequestFormData);
  const notes = built.notesToReview;
  let content: InvitationContent = built.content;
  // Invitation bilingue : deuxième version (textes du modèle traduit s'il existe, sinon à traduire)
  const second = fd.secondLanguage;
  if (second && second !== content.language && (LANGUAGES as readonly string[]).includes(second)) {
    const lang2 = second as Language;
    const variant = getVariant(def, lang2);
    content = { ...content, alt: newAlt(content, lang2, variant ? { main: contentFor(def, lang), variant } : null) };
    notes.push(`Invitation bilingue : vérifier la version ${lang2.toUpperCase()} (« Textes à traduire » dans l'éditeur).`);
  }
  const eventAt = content.eventAt ? zonedToUtc(content.eventAt, content.timezone)?.toISOString() ?? null : null;
  return { content, notes, eventAt };
}

/** Réglages du formulaire de réponse : choix des mariés, sinon réglages par défaut. */
export function rsvpSettings(formData: unknown, content: InvitationContent) {
  const deadline = content.rsvp.deadline ? zonedToUtc(`${content.rsvp.deadline}T23:59`, content.timezone)?.toISOString() ?? null : null;
  const chosen = rsvpChoicesSchema.safeParse((formData as { details?: { rsvp?: unknown } } | null)?.details?.rsvp);
  if (chosen.success) {
    const cleaned = cleanQuestions(chosen.data.questions);
    return {
      deadline,
      fields: { ...DEFAULT_RSVP_FIELDS, ...chosen.data.fields },
      max_companions: chosen.data.maxCompanions,
      custom_questions: (cleaned.ok ? cleaned.questions : []) as unknown[],
    };
  }
  return {
    deadline,
    fields: { lastName: true, companions: true, companionNames: true, events: content.events.length > 1, dietary: false, childMenus: false, comment: true } as Record<string, boolean>,
    max_companions: 1,
    custom_questions: [] as unknown[],
  };
}

/** Un lien privé par groupe d'invités utilisé (les codes déjà attribués sont conservés). */
export function privateLinksFor(content: InvitationContent, existing: Record<string, string> = {}): Record<string, string> | null {
  const groups = usedGroups(content);
  if (!groups.length) return null;
  return Object.fromEntries(groups.map((g) => [g.id, existing[g.id] ?? newGroupToken()]));
}

export type OrderState = {
  /** Commande passée en ligne (paiement avant le formulaire détaillé) */
  selfService: boolean;
  /** Formulaire détaillé envoyé par le client (date ISO) */
  detailsAt: string | null;
  requestId: string | null;
  reference: string | null;
};

/** État de la commande en ligne liée à une invitation (lecture serveur, clé secrète). */
export async function orderStateFor(db: SupabaseClient, invitationId: string): Promise<OrderState> {
  const { data } = await db.from("client_requests").select("id, reference, form_data").eq("invitation_id", invitationId).maybeSingle();
  const fd = (data?.form_data ?? {}) as { selfService?: boolean; detailsAt?: string };
  return { selfService: !!fd.selfService, detailsAt: fd.detailsAt ?? null, requestId: data?.id ?? null, reference: data?.reference ?? null };
}
