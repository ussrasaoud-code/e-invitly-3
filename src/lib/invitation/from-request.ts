import { invitationContentSchema, type InvitationContent, type InvitationEvent } from "./schema";
import { CEREMONY_LABELS, type RequestData } from "@/lib/validation/request";

/**
 * Construit le brouillon d'une invitation à partir :
 *  - de la version figée du modèle (thème, sections, textes par défaut)
 *  - des réponses du client (prénoms, date, lieux, horaires…)
 *
 * Les contenus de démonstration du modèle (prénoms, lieux, contacts,
 * infos pratiques) sont systématiquement remplacés ou vidés : rien de
 * fictif ne peut se retrouver dans l'invitation d'un client.
 *
 * Fonction pure, testée dans from-request.test.ts.
 */
export type RequestFormData = Omit<RequestData, "consent" | "website" | "templateSlug">;

const slugId = (prefix: string, i: number) => `${prefix}-${i + 1}`;

export function buildInvitationFromRequest(
  templateSample: InvitationContent,
  form: Partial<RequestFormData> & Pick<RequestFormData, "partnerOne" | "partnerTwo">,
): { content: InvitationContent; notesToReview: string[] } {
  const notes: string[] = [];
  const ceremonies = form.ceremonies ?? [];
  const reception = form.reception;
  const details = form.details;

  const events: InvitationEvent[] = [];
  ceremonies.forEach((c, i) => {
    if (!c.showOnInvitation) {
      notes.push(`Cérémonie non affichée à la demande du client : ${c.label || CEREMONY_LABELS[c.type]}${c.startTime ? ` (${c.startTime})` : ""}.`);
      return;
    }
    events.push({
      id: slugId("ceremonie", i),
      type: c.type === "other" ? "other" : c.type,
      title: c.label || CEREMONY_LABELS[c.type],
      venueName: c.venueName ?? "",
      address: c.address ?? "",
      mapsUrl: "",
      arrivalTime: c.arrivalTime ?? "",
      startTime: c.startTime ?? "",
      description: c.notes ?? "",
    });
  });

  if (reception && (reception.venueName || reception.address || reception.cocktailTime || reception.dinnerTime)) {
    const base = {
      venueName: reception.venueName ?? "",
      address: reception.address ?? "",
      mapsUrl: reception.mapsUrl ?? "",
      description: "",
    };
    if (reception.cocktailTime || (!reception.dinnerTime && reception.arrivalTime)) {
      events.push({ ...base, id: "cocktail", type: "cocktail", title: "Cocktail", arrivalTime: reception.arrivalTime ?? "", startTime: reception.cocktailTime || reception.arrivalTime || "" });
    }
    if (reception.dinnerTime) {
      events.push({ ...base, id: "diner", type: "dinner", title: "Dîner", arrivalTime: reception.cocktailTime ? "" : reception.arrivalTime ?? "", startTime: reception.dinnerTime });
    }
    if (reception.otherTimes) notes.push(`Autres horaires à intégrer : ${reception.otherTimes}`);
  }

  events.sort((a, b) => (a.startTime || "99:99").localeCompare(b.startTime || "99:99"));

  const firstTime = events.find((e) => e.startTime)?.startTime ?? "";
  const firstVenue = events.find((e) => e.venueName) ?? null;
  const date = form.eventDate ?? "";

  if (!firstTime && date) notes.push("Heure de début non précisée : le compte à rebours vise 15h00 par défaut, à corriger.");
  if (details?.program) notes.push(`Programme décrit par le client : ${details.program}`);
  if (details?.witnesses) notes.push(`Témoins à ajouter dans Contacts : ${details.witnesses}`);
  if (details?.phoneNumbers) notes.push(`Numéros à afficher : ${details.phoneNumbers}`);
  if (details?.customText) notes.push(`Texte personnalisé : ${details.customText}`);
  if (details?.preferences) notes.push(`Préférences : ${details.preferences}`);
  if (details?.photos) notes.push(`Photos : ${details.photos}`);
  if (details?.music) notes.push(`Musique souhaitée : ${details.music}`);
  if (details?.comments) notes.push(`Commentaire du client : ${details.comments}`);

  const initials = `${form.partnerOne.trim().charAt(0)}&${form.partnerTwo.trim().charAt(0)}`.toUpperCase();

  const content = invitationContentSchema.parse({
    ...templateSample,
    language: form.language ?? templateSample.language,
    couple: { partnerOne: form.partnerOne, partnerTwo: form.partnerTwo, photoUrl: "" },
    intro: form.introText?.trim() ? form.introText.trim() : templateSample.intro,
    eventAt: date ? `${date}T${firstTime || "15:00"}` : "",
    timezone: templateSample.timezone || "Europe/Paris",
    mainVenue: { name: firstVenue?.venueName ?? "", city: "" },
    events,
    dressCode: { text: details?.dressCode ?? "", palette: details?.dressCode ? templateSample.dressCode.palette : [] },
    practical: {
      parking: reception?.parking ?? "",
      shuttles: reception?.shuttles ?? "",
      transport: "",
      lodging: reception?.lodging ?? "",
    },
    contacts: [],
    rsvp: { deadline: details?.rsvpDeadline ?? "", intro: "" },
    envelope: { ...templateSample.envelope, sealText: initials, videoUrl: templateSample.envelope.videoUrl },
    music: { enabled: false, url: "" },
  });

  return { content, notesToReview: notes };
}
