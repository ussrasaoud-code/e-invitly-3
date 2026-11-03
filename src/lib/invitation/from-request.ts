import { invitationContentSchema, type InvitationContent, type InvitationEvent, type Language } from "./schema";
import { MAGHREB_TITLES } from "./maghreb-labels";
import { CEREMONY_LABELS, type MaghrebData, type MomentAudience, type RequestData } from "@/lib/validation/request";

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
  if (form.culture === "maghrebin" && form.maghreb) return buildMaghreb(templateSample, form, form.maghreb);
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
      date: "",
      audience: "all",
    });
  });

  if (reception && (reception.venueName || reception.address || reception.cocktailTime || reception.dinnerTime)) {
    const base = {
      venueName: reception.venueName ?? "",
      address: reception.address ?? "",
      mapsUrl: reception.mapsUrl ?? "",
      description: "",
      date: "",
      audience: "all" as const,
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

/* ── Mariage maghrébin : plusieurs jours, moments réservés aux invités du henné ── */
function buildMaghreb(
  templateSample: InvitationContent,
  form: Partial<RequestFormData> & Pick<RequestFormData, "partnerOne" | "partnerTwo">,
  m: MaghrebData,
): { content: InvitationContent; notesToReview: string[] } {
  const notes: string[] = [];
  const lang = (form.language ?? templateSample.language) as Language;
  const T = MAGHREB_TITLES[lang] ?? MAGHREB_TITLES.fr;
  const separate = m.separateGuests !== "no";
  const hennaAudience = separate ? ("henna" as const) : ("all" as const);
  const toAudience = (a: MomentAudience) => (a === "henna" && separate ? ("henna" as const) : ("all" as const));
  const soireeDate = m.soiree.date || form.eventDate || "";
  const events: InvitationEvent[] = [];
  const push = (e: Partial<InvitationEvent> & Pick<InvitationEvent, "id" | "type" | "title">) =>
    events.push({ venueName: "", address: "", mapsUrl: "", arrivalTime: "", startTime: "", description: "", date: "", audience: "all", ...e });

  // Jour du henné : hammam (matin), henné, chants, dîner
  const h = m.henna;
  if (h.enabled) {
    const at = { venueName: h.venueName, address: h.address, mapsUrl: h.mapsUrl, date: h.date, audience: hennaAudience };
    if (h.hammamTime || h.hammamPlace) {
      if (h.hammamAudience === "hidden") notes.push(`Hammam de la mariée (privé, non affiché)${h.hammamTime ? ` à ${h.hammamTime}` : ""}${h.hammamPlace ? ` — ${h.hammamPlace}` : ""}.`);
      else push({ id: "hammam", type: "hammam", title: T.hammam, venueName: h.hammamPlace, startTime: h.hammamTime, date: h.date, audience: toAudience(h.hammamAudience) });
    }
    if (h.hennaTime || h.venueName) push({ ...at, id: "henne", type: "henna", title: T.henna, startTime: h.hennaTime });
    if (h.chantTime) push({ ...at, id: "chants-henne", type: "party", title: T.chant, startTime: h.chantTime });
    if (h.dinnerTime) push({ ...at, id: "diner-henne", type: "dinner", title: T.hennaDinner, startTime: h.dinnerTime });
    if (h.notes) notes.push(`Jour du henné — précisions du client : ${h.notes}`);
  }

  // Jour de la soirée : accueil, entrée de la mariée, goûter, dîner, pièce montée
  const s = m.soiree;
  const at = { venueName: s.venueName, address: s.address, mapsUrl: s.mapsUrl, date: soireeDate === form.eventDate ? "" : soireeDate };
  if (s.receptionTime || s.venueName) push({ ...at, id: "accueil", type: "reception", title: T.reception, startTime: s.receptionTime });
  if (s.brideTime) push({ ...at, id: "entree-mariee", type: "bride", title: T.bride, startTime: s.brideTime, description: T.brideDetail });
  if (s.teaTime) push({ ...at, id: "gouter", type: "tea", title: T.tea, startTime: s.teaTime, description: T.teaDetail });
  if (s.dinnerTime) push({ ...at, id: "diner", type: "dinner", title: T.dinner, startTime: s.dinnerTime });
  if (s.cakeTime) push({ ...at, id: "piece-montee", type: "cake", title: T.cake, startTime: s.cakeTime });
  if (s.endTime) notes.push(`Fin de la soirée prévue vers ${s.endTime}.`);
  if (s.notes) notes.push(`Soirée — précisions du client : ${s.notes}`);

  // Autres moments (Fatiha, lendemain, moments libres)
  const extra = (x: MaghrebData["fatiha"], id: string, type: InvitationEvent["type"], title: string) => {
    if (!x.enabled) return;
    if (x.audience === "hidden") return notes.push(`${title} (non affiché à la demande du client)${x.date ? ` le ${x.date}` : ""}${x.time ? ` à ${x.time}` : ""}.`);
    push({ id, type, title, venueName: x.venueName, address: x.address, mapsUrl: x.mapsUrl, startTime: x.time, date: x.date, audience: toAudience(x.audience), description: x.notes });
  };
  extra(m.fatiha, "fatiha", "fatiha", T.fatiha);
  extra(m.lendemain, "lendemain", "brunch", T.lendemain);
  m.others.forEach((o, i) => extra(o, `moment-${i + 1}`, "other", o.label));

  // Ordre chronologique (jour puis heure) ; les moments sans jour sont le jour de la soirée
  const dayOf = (e: InvitationEvent) => e.date || soireeDate;
  events.sort((a, b) => `${dayOf(a)} ${a.startTime || "99:99"}`.localeCompare(`${dayOf(b)} ${b.startTime || "99:99"}`));

  const soireeTime = [s.receptionTime, s.brideTime, s.teaTime, s.dinnerTime].find(Boolean) ?? "";
  if (soireeDate && !soireeTime) notes.push("Heure de début de la soirée non précisée : le compte à rebours vise 15h00 par défaut, à corriger.");
  if (m.separateGuests === "unknown") notes.push("Le couple ne sait pas encore si certains invités viennent seulement à la soirée : les moments du henné sont réservés au lien « henné + soirée », à confirmer avec lui.");
  if (m.separateGuests === "no") notes.push("Tous les invités sont conviés au henné et à la soirée : un seul lien suffit.");
  const d = m.decoration;
  if (d.known === "yes" && (d.colors || d.theme)) notes.push(`Décoration de la salle — couleurs : ${d.colors || "—"} · thème : ${d.theme || "—"}`);
  else if (d.known === "no") notes.push("Décoration de la salle : pas encore choisie.");
  else notes.push("Décoration de la salle : le couple la communiquera plus tard.");

  const details = form.details;
  if (details?.witnesses) notes.push(`Témoins / proches à ajouter dans Contacts : ${details.witnesses}`);
  if (details?.phoneNumbers) notes.push(`Numéros à afficher : ${details.phoneNumbers}`);
  if (details?.customText) notes.push(`Texte personnalisé : ${details.customText}`);
  if (details?.preferences) notes.push(`Préférences : ${details.preferences}`);
  if (details?.photos) notes.push(`Photos : ${details.photos}`);
  if (details?.music) notes.push(`Musique souhaitée : ${details.music}`);
  if (details?.comments) notes.push(`Commentaire du client : ${details.comments}`);

  const initials = `${form.partnerOne.trim().charAt(0)}&${form.partnerTwo.trim().charAt(0)}`.toUpperCase();
  const content = invitationContentSchema.parse({
    ...templateSample,
    language: lang,
    couple: { partnerOne: form.partnerOne, partnerTwo: form.partnerTwo, photoUrl: "" },
    intro: form.introText?.trim() ? form.introText.trim() : templateSample.intro,
    eventAt: soireeDate ? `${soireeDate}T${soireeTime || "15:00"}` : "",
    timezone: templateSample.timezone || "Europe/Paris",
    mainVenue: { name: s.venueName, city: "" },
    events,
    dressCode: { text: details?.dressCode ?? "", palette: details?.dressCode ? templateSample.dressCode.palette : [] },
    practical: { parking: s.parking, shuttles: s.shuttles, transport: "", lodging: s.lodging },
    contacts: [],
    rsvp: { deadline: details?.rsvpDeadline ?? "", intro: "" },
    envelope: { ...templateSample.envelope, sealText: initials, videoUrl: templateSample.envelope.videoUrl },
    music: { enabled: false, url: "" },
  });
  return { content, notesToReview: notes };
}
