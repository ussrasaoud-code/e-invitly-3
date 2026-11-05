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
  /** Numéro WhatsApp Business au format international (+33…). */
  whatsapp: string;
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
  /** Délai indicatif de création, en texte libre (ex. « 7 à 14 jours ») — affiché sur les fiches s'il est renseigné */
  creationDelay?: string;
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

export type LanguageSettings = {
  /** Langues ouvertes sur le site vitrine (le français l'est toujours) */
  enabled: string[];
};

/** Protection des aperçus envoyés aux couples et des démos du catalogue */
export type ProtectionSettings = {
  /** Durée de validité d'un lien d'aperçu, en heures */
  previewHours: number;
  previewWatermark: boolean;
  demoWatermark: boolean;
  /** Texte du filigrane (vide = « APERÇU · E-INVITLY ») */
  watermarkText: string;
  /** Clic droit, sélection, glisser, impression et raccourcis d'enregistrement désactivés */
  deterrents: boolean;
};

/** Outils de mesure (chargés seulement après le consentement du visiteur). Vides = aucun outil, aucun bandeau. */
export type AnalyticsSettings = {
  /** Identifiant de mesure Google Analytics 4, ex. G-ABC123XYZ */
  gaId: string;
  /** Identifiant du pixel Meta (Facebook / Instagram), ex. 123456789012345 */
  metaPixelId: string;
};

export type SettingsMap = {
  languages: LanguageSettings;
  brand: BrandSettings;
  policies: PolicySettings;
  home: HomeSettings;
  notifications: NotificationSettings;
  protection: ProtectionSettings;
  analytics: AnalyticsSettings;
};

export const DEFAULT_SETTINGS: { [K in keyof SettingsMap]: { value: SettingsMap[K]; isPublic: boolean } } = {
  languages: { isPublic: true, value: { enabled: ["fr"] } },
  brand: {
    isPublic: true,
    value: {
      name: "E-Invitly",
      tagline: "Invitations digitales élégantes",
      contactEmail: "",
      contactPhone: "",
      whatsapp: "",
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
      creationDelay: "",
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
          question: "Quand dois-je payer ?",
          answer: "À la commande, en ligne et en toute sécurité. Vous nous transmettez ensuite vos informations depuis votre espace, recevez l'aperçu sous 24 h et demandez autant de retouches que nécessaire.",
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
          answer: "La durée de mise en ligne vous est précisée lors de la validation de votre aperçu.",
        },
      ],
    },
  },
  notifications: {
    isPublic: false,
    value: { notifyOnNewRequest: true, notifyOnNewRsvp: false },
  },
  protection: {
    isPublic: true,
    value: { previewHours: 48, previewWatermark: true, demoWatermark: false, watermarkText: "", deterrents: true },
  },
  analytics: {
    isPublic: true,
    value: { gaId: "", metaPixelId: "" },
  },
};
