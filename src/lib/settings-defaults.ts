/**
 * Paramètres par défaut, modifiables ensuite dans /admin/parametres.
 * Aucune condition commerciale n'est inventée : les champs « politiques »
 * restent vides tant qu'ils ne sont pas renseignés, et les pages
 * correspondantes l'indiquent clairement.
 */

export type FaqItem = { question: string; answer: string };

export type BrandSettings = {
  name: string;
  tagline: string;
  contactEmail: string;
  contactPhone: string;
  instagram: string;
  facebook: string;
  pinterest: string;
};

export type PolicySettings = {
  /** Mentions légales (éditeur, hébergeur…) */
  legalNotice: string;
  /** Politique de confidentialité */
  privacyPolicy: string;
  /** Conditions générales de vente — vides tant qu'elles ne sont pas établies */
  termsOfSale: string;
  /** Durée de mise en ligne par défaut, en texte libre (ex. « 12 mois après l'événement ») */
  publicationDuration: string;
  /** Durée de conservation des réponses RSVP après l'événement, en mois */
  rsvpRetentionMonths: number;
};

export type HomeSettings = {
  heroTitle: string;
  heroSubtitle: string;
  faq: FaqItem[];
};

export type NotificationSettings = {
  notifyOnNewRequest: boolean;
  notifyOnNewRsvp: boolean;
};

export type SettingsMap = {
  brand: BrandSettings;
  policies: PolicySettings;
  home: HomeSettings;
  notifications: NotificationSettings;
};

export const DEFAULT_SETTINGS: { [K in keyof SettingsMap]: { value: SettingsMap[K]; isPublic: boolean } } = {
  brand: {
    isPublic: true,
    value: {
      name: "E-Invitly",
      tagline: "Invitations digitales élégantes",
      contactEmail: "",
      contactPhone: "",
      instagram: "",
      facebook: "",
      pinterest: "",
    },
  },
  policies: {
    isPublic: true,
    value: {
      legalNotice: "",
      privacyPolicy: "",
      termsOfSale: "",
      publicationDuration: "",
      rsvpRetentionMonths: 12,
    },
  },
  home: {
    isPublic: true,
    value: {
      heroTitle: "Vos plus beaux moments méritent une invitation unique.",
      heroSubtitle:
        "Des invitations digitales élégantes, interactives et personnalisées, pensées pour annoncer vos événements et partager chaque détail avec vos invités.",
      faq: [
        {
          question: "Comment fonctionne une invitation digitale ?",
          answer:
            "C'est un mini-site pensé pour le téléphone, accessible par un simple lien. Vos invités y retrouvent le programme, les lieux, le dress code, un compte à rebours et le formulaire de réponse.",
        },
        {
          question: "Puis-je modifier les informations après publication ?",
          answer:
            "Oui. Nous mettons à jour votre invitation et le lien reste identique : vos invités voient toujours la dernière version validée.",
        },
        {
          question: "Comment partager l'invitation ?",
          answer:
            "Vous recevez un lien personnalisé (par exemple e-invitly.com/vos-prenoms) à envoyer par message, e-mail ou réseaux sociaux.",
        },
        {
          question: "Les invités doivent-ils créer un compte ?",
          answer: "Non. Ils ouvrent le lien et répondent directement, sans inscription ni application à télécharger.",
        },
        {
          question: "Comment recevoir les réponses RSVP ?",
          answer:
            "Chaque réponse est enregistrée dans votre espace personnel sécurisé, accessible par un lien de connexion envoyé par e-mail. Vous pouvez y suivre les présents, les accompagnants et exporter la liste.",
        },
        {
          question: "Puis-je utiliser mon propre texte ?",
          answer: "Bien sûr : le formulaire de personnalisation vous permet de nous transmettre vos textes, que nous intégrons au modèle choisi.",
        },
        {
          question: "Combien de temps mon invitation reste-t-elle disponible ?",
          answer: "La durée de mise en ligne vous est précisée lors de la validation de votre demande.",
        },
      ],
    },
  },
  notifications: {
    isPublic: false,
    value: { notifyOnNewRequest: true, notifyOnNewRsvp: false },
  },
};
