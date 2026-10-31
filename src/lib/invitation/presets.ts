import type { InvitationContentInput, InvitationSection, RendererKey } from "./schema";

/**
 * Définitions de départ des deux premiers modèles.
 * Elles servent à générer supabase/seed.sql ; ensuite, la version en base
 * fait foi et se modifie depuis l'administration.
 *
 * Les prénoms, dates et lieux ci-dessous sont des CONTENUS DE DÉMONSTRATION,
 * affichés avec un bandeau « Démo » sur /demo/[modele].
 */

const sections = (titles: Partial<Record<InvitationSection["type"], string>> = {}): InvitationSection[] =>
  (["hero", "program", "countdown", "dresscode", "venues", "rsvp", "contacts", "closing"] as const).map(
    (type) => ({ id: `s-${type}`, type, visible: true, title: titles[type] ?? "", body: "", height: 60, animation: "inherit", layers: [] }),
  );

const sharedDemo = {
  schemaVersion: 1,
  language: "fr",
  couple: { partnerOne: "Camille", partnerTwo: "Elias", photoUrl: "" },
  eventAt: "2027-06-12T15:30",
  timezone: "Europe/Paris",
  mainVenue: { name: "Domaine des Oliviers", city: "Aix-en-Provence" },
  events: [
    {
      id: "e-ceremonie",
      type: "secular",
      title: "Cérémonie laïque",
      venueName: "Domaine des Oliviers — jardin",
      address: "Chemin des Oliviers, 13100 Aix-en-Provence",
      mapsUrl: "",
      arrivalTime: "15:00",
      startTime: "15:30",
      description: "Sous les oliviers centenaires.",
    },
    {
      id: "e-cocktail",
      type: "cocktail",
      title: "Cocktail",
      venueName: "Domaine des Oliviers — terrasse",
      address: "Chemin des Oliviers, 13100 Aix-en-Provence",
      mapsUrl: "",
      arrivalTime: "",
      startTime: "17:00",
      description: "Rafraîchissements et musique live.",
    },
    {
      id: "e-diner",
      type: "dinner",
      title: "Dîner",
      venueName: "Domaine des Oliviers — orangerie",
      address: "Chemin des Oliviers, 13100 Aix-en-Provence",
      mapsUrl: "",
      arrivalTime: "",
      startTime: "20:00",
      description: "",
    },
    {
      id: "e-soiree",
      type: "party",
      title: "Soirée dansante",
      venueName: "",
      address: "",
      mapsUrl: "",
      arrivalTime: "",
      startTime: "23:00",
      description: "Jusqu'au bout de la nuit.",
    },
  ],
  practical: {
    parking: "Parking gratuit sur place, fléché depuis l'entrée du domaine.",
    shuttles: "Une navette relie le centre d'Aix au domaine à 14h30 et ramène les invités à 1h puis 3h.",
    transport: "Gare TGV d'Aix-en-Provence à 20 minutes en voiture.",
    lodging: "Quelques chambres sont réservées à l'Hôtel des Arts sous le nom « Camille & Elias ».",
  },
  contacts: [
    { name: "Léa", role: "Témoin de Camille", phone: "+33 6 00 00 00 01" },
    { name: "Yanis", role: "Témoin d'Elias", phone: "+33 6 00 00 00 02" },
  ],
  rsvp: { deadline: "2027-04-30", intro: "Merci de nous répondre avant le 30 avril 2027." },
  envelope: { mode: "animation", videoUrl: "", posterUrl: "", sealText: "C&E", autoStart: false },
  music: { enabled: false, url: "" },
} satisfies Partial<InvitationContentInput>;

export const PRESETS: Record<RendererKey, InvitationContentInput> = {
  "the-garden": {
    ...sharedDemo,
    kicker: "Ensemble, avec leurs familles",
    intro: "ont la joie de vous convier à la célébration de leur mariage.",
    dressCode: {
      text: "Tenue de jardin chic : lin, soie et couleurs douces. Pensez à des chaussures adaptées à l'herbe.",
      palette: ["#A6B5A2", "#DDD2C3", "#F4F0E9", "#586C60"],
    },
    closing: { title: "Merci", text: "Nous avons hâte de partager ce jour avec vous." },
    sections: sections({ program: "Le programme", countdown: "Plus que", rsvp: "Serez-vous des nôtres ?" }),
    theme: {
      colors: {
        background: "#FAF8F4",
        surface: "#F4F0E9",
        ink: "#323330",
        muted: "#6B6F68",
        accent: "#586C60",
        accentSoft: "#A6B5A2",
      },
      fonts: { display: "aboreto", script: "dancing", body: "jost" },
      ornament: "garden",
      animation: "soft",
    },
  },
  province: {
    ...sharedDemo,
    kicker: "Une journée en Provence",
    intro: "seraient heureux de vous compter parmi eux pour célébrer leur union.",
    dressCode: {
      text: "Élégance estivale : tons terre, ocre et crème. Chapeaux bienvenus.",
      palette: ["#C99A6E", "#9A6B4F", "#EDE3D3", "#6E7B5B"],
    },
    closing: { title: "À très bientôt", text: "Avec toute notre affection." },
    sections: sections({ program: "Déroulé de la journée", countdown: "Le grand jour approche", rsvp: "Votre réponse" }),
    theme: {
      colors: {
        background: "#F6F0E6",
        surface: "#EDE3D3",
        ink: "#3B2F2A",
        muted: "#7A6A5E",
        accent: "#9A6B4F",
        accentSoft: "#DDD2C3",
      },
      fonts: { display: "cormorant", script: "dancing", body: "jost" },
      ornament: "province",
      animation: "soft",
    },
  },
};

export const TEMPLATE_SEEDS: Array<{
  slug: string;
  name: string;
  renderer: RendererKey;
  shortDescription: string;
  description: string;
  category: string;
  styles: string[];
  features: string[];
  coverImage: string;
  sortOrder: number;
}> = [
  {
    slug: "the-garden",
    name: "The Garden",
    renderer: "the-garden",
    shortDescription: "Feuillages délicats, vert sauge et typographie gravée.",
    description:
      "Un modèle botanique tout en légèreté : feuillages aquarellés, palette ivoire et sauge, titres en capitales gravées et accents manuscrits. Idéal pour un mariage en extérieur, un jardin ou une orangerie.",
    category: "mariage",
    styles: ["floral", "minimaliste", "romantique"],
    features: ["Enveloppe animée", "Programme", "Compte à rebours", "Dress code", "Lieux et accès", "RSVP intégré"],
    coverImage: "/templates/the-garden.svg",
    sortOrder: 10,
  },
  {
    slug: "province",
    name: "Province",
    renderer: "province",
    shortDescription: "Arche ocre, papier crème et douceur du Sud.",
    description:
      "Un modèle chaleureux inspiré des bastides provençales : arche en terre cuite, papier crème, serif classique. Pensé pour les mariages de domaine, de mas ou de bord de mer.",
    category: "mariage",
    styles: ["vintage", "classique", "romantique"],
    features: ["Enveloppe animée", "Programme", "Compte à rebours", "Dress code", "Lieux et accès", "RSVP intégré"],
    coverImage: "/templates/province.svg",
    sortOrder: 20,
  },
];
