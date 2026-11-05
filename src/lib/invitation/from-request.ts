import { linkNamesInContent } from "./fields";
import { groupId } from "./audience";
import { invitationContentSchema, type GuestGroup, type InvitationContent, type InvitationEvent } from "./schema";
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

/** Intitulés par défaut des moments de la réception (si les mariés n'en ont pas saisi) */
const MOMENT_TITLES = { welcome: "Accueil des invités", cocktail: "Cocktail", dinner: "Dîner", openingDance: "Ouverture de bal", cake: "Pièce montée", party: "Soirée dansante", end: "Fin de soirée", other: "Moment" } as const;
/** Type d'événement (icônes, libellés) pour chaque moment de la soirée */
const MOMENT_EVENT_TYPE = { welcome: "reception", cocktail: "cocktail", dinner: "dinner", openingDance: "party", cake: "cake", party: "party", end: "other", other: "other" } as const;
const END_LABEL: Record<string, string> = { fr: "Fin de la soirée", en: "End of the evening", ar: "نهاية السهرة", es: "Fin de la velada", it: "Fine della serata", de: "Ende des Abends", nl: "Einde van de avond" };

export function buildInvitationFromRequest(
  templateSample: InvitationContent,
  form: Partial<RequestFormData> & Pick<RequestFormData, "partnerOne" | "partnerTwo">,
): { content: InvitationContent; notesToReview: string[] } {
  const notes: string[] = [];
  const ceremonies = form.ceremonies ?? [];
  const reception = form.reception;
  const details = form.details;

  const events: InvitationEvent[] = [];
  // Cérémonies réservées à une partie des invités : un groupe (et un lien privé) par nom donné
  const guestGroups: GuestGroup[] = [];
  const groupFor = (name: string) => {
    const found = guestGroups.find((g) => g.name.toLowerCase() === name.toLowerCase());
    if (found) return found.id;
    const g = { id: groupId(name, guestGroups.map((x) => x.id)), name };
    guestGroups.push(g);
    return g.id;
  };
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
      endTime: c.endTime ?? "",
      description: c.notes ?? "",
      // Autre jour que la date principale (ex. mairie la veille)
      date: c.date && c.date !== form.eventDate ? c.date : "",
      groups: c.restricted ? [groupFor(c.guestGroup?.trim() || `Invités · ${c.label || CEREMONY_LABELS[c.type]}`)] : [],
    });
  });

  const moments = (reception?.moments ?? []).filter((m) => m.time || m.note?.trim());
  if (reception && moments.length) {
    // Déroulé construit par les mariés : un moment par ligne, dans leur ordre.
    // Le lieu n'est indiqué qu'une fois (sur le premier moment) : il ne se répète pas dans la frise.
    const day = reception.date && reception.date !== form.eventDate ? reception.date : "";
    const hasEndMoment = moments.some((m) => m.kind === "end");
    moments.forEach((m, i) => {
      events.push({
        // « Fin de soirée » : pas de réponse demandée aux invités pour ce moment
        id: m.kind === "end" ? "reception-fin" : `reception-${i + 1}`,
        type: MOMENT_EVENT_TYPE[m.kind],
        title: m.title?.trim() || (m.kind === "end" ? END_LABEL[form.language ?? "fr"] ?? END_LABEL.fr : MOMENT_TITLES[m.kind]),
        venueName: i === 0 ? reception.venueName ?? "" : "",
        address: i === 0 ? reception.address ?? "" : "",
        mapsUrl: i === 0 ? reception.mapsUrl ?? "" : "",
        arrivalTime: i === 0 ? reception.arrivalTime ?? "" : "",
        startTime: m.time ?? "",
        description: m.note?.trim() ?? "",
        date: day,
        groups: [],
      });
    });
    if (reception.endTime && !hasEndMoment) {
      events.push({ id: "reception-fin", type: "other", title: END_LABEL[form.language ?? "fr"] ?? END_LABEL.fr, venueName: "", address: "", mapsUrl: "", arrivalTime: "", startTime: reception.endTime, description: "", date: day, groups: [] });
    }
  } else if (reception && (reception.venueName || reception.address || reception.cocktailTime || reception.dinnerTime || reception.arrivalTime)) {
    const base = {
      venueName: reception.venueName ?? "",
      address: reception.address ?? "",
      mapsUrl: reception.mapsUrl ?? "",
      description: "",
      date: reception.date && reception.date !== form.eventDate ? reception.date : "",
      groups: [] as string[],
    };
    if (reception.cocktailTime || (!reception.dinnerTime && reception.arrivalTime)) {
      events.push({ ...base, id: "cocktail", type: "cocktail", title: "Cocktail", arrivalTime: reception.arrivalTime ?? "", startTime: reception.cocktailTime || reception.arrivalTime || "" });
    }
    if (reception.dinnerTime) {
      // Même lieu que le cocktail : l'adresse n'est pas répétée
      const sameVenue = events.some((e) => e.id === "cocktail");
      events.push({ ...base, ...(sameVenue ? { venueName: "", address: "", mapsUrl: "" } : {}), id: "diner", type: "dinner", title: "Dîner", arrivalTime: reception.cocktailTime ? "" : reception.arrivalTime ?? "", startTime: reception.dinnerTime });
    }
    if (reception.endTime) events.push({ ...base, venueName: "", address: "", mapsUrl: "", id: "reception-fin", type: "other", title: END_LABEL[form.language ?? "fr"] ?? END_LABEL.fr, arrivalTime: "", startTime: reception.endTime });
    if (reception.otherTimes) notes.push(`Autres horaires à intégrer : ${reception.otherTimes}`);
  }

  // Tri : par jour, puis par heure ; une heure avant 6h compte comme la fin de la nuit (02:00 après 23:00)
  const sortKey = (e: InvitationEvent) => {
    const t = e.startTime || "99:99";
    const night = t < "06:00" ? `${String(+t.slice(0, 2) + 24).padStart(2, "0")}${t.slice(2)}` : t;
    return `${e.date || form.eventDate || ""}|${night}`;
  };
  events.sort((a, b) => sortKey(a).localeCompare(sortKey(b)));

  // Lieu principal et heure du compte à rebours : pris parmi les moments ouverts à tous
  // (un lieu réservé à un groupe ne doit pas apparaître sur le lien principal)
  const open = events.filter((e) => !e.groups.length);
  const firstTime = (open.length ? open : events).find((e) => e.startTime)?.startTime ?? "";
  const firstVenue = open.find((e) => e.venueName) ?? null;
  const date = form.eventDate ?? "";

  if (!firstTime && date) notes.push("Heure de début non précisée : le compte à rebours vise 15h00 par défaut, à corriger.");
  if (details?.program) notes.push(`Programme décrit par le client : ${details.program}`);
  if (details?.witnesses) notes.push(`Témoins à ajouter dans Contacts : ${details.witnesses}`);
  if (details?.phoneNumbers) notes.push(`Numéros à afficher : ${details.phoneNumbers}`);
  if (details?.customText) notes.push(`Texte personnalisé : ${details.customText}`);
  if (details?.preferences) notes.push(`Préférences : ${details.preferences}`);
  if (details?.photoFiles?.length) notes.push(`${details.photoFiles.length} photo(s) envoyée(s) par le client : voir la fiche de la demande.`);
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
    guestGroups,
    dressCode: {
      text: details?.dressCode ?? "",
      // Couleurs choisies par les mariés, sinon celles du modèle s'ils décrivent un dress code
      palette: details?.dressColors?.length ? details.dressColors : details?.dressCode ? templateSample.dressCode.palette : [],
    },
    practical: {
      parking: reception?.parking ?? "",
      shuttles: reception?.shuttles ?? "",
      transport: "",
      lodging: reception?.lodging ?? "",
    },
    contacts: (details?.contacts ?? [])
      .filter((c) => c.name?.trim())
      .map((c) => ({ name: c.name!.trim(), role: c.role?.trim() ?? "", phone: c.phone?.trim() ?? "" })),
    rsvp: { deadline: details?.rsvpDeadline ?? "", intro: "" },
    envelope: { ...templateSample.envelope, sealText: initials, videoUrl: templateSample.envelope.videoUrl },
    music: { enabled: false, url: "" },
  });

  // Prénoms de la démo écrits dans des calques texte : remplacés par les champs automatiques,
  // qui affichent les prénoms du couple
  return { content: linkNamesInContent(content, templateSample.couple.partnerOne, templateSample.couple.partnerTwo), notesToReview: notes };
}
