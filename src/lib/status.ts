/** Libellés et couleurs des statuts affichés dans l'administration. */

export const REQUEST_STATUSES = ["new", "in_progress", "missing_info", "accepted", "rejected", "converted"] as const;
export type RequestStatus = (typeof REQUEST_STATUSES)[number];
export const REQUEST_STATUS: Record<RequestStatus, { label: string; tone: Tone }> = {
  new: { label: "Nouvelle", tone: "accent" },
  in_progress: { label: "En cours", tone: "info" },
  missing_info: { label: "Informations manquantes", tone: "warning" },
  accepted: { label: "Acceptée", tone: "success" },
  rejected: { label: "Refusée", tone: "danger" },
  converted: { label: "Convertie en invitation", tone: "muted" },
};

export const INVITATION_STATUSES = ["draft", "customizing", "pending_review", "ready", "published", "unpublished", "archived"] as const;
export type InvitationStatus = (typeof INVITATION_STATUSES)[number];
export const INVITATION_STATUS: Record<InvitationStatus, { label: string; tone: Tone }> = {
  draft: { label: "Brouillon", tone: "muted" },
  customizing: { label: "En personnalisation", tone: "info" },
  pending_review: { label: "En attente de validation", tone: "warning" },
  ready: { label: "Prête à publier", tone: "accent" },
  published: { label: "Publiée", tone: "success" },
  unpublished: { label: "Dépubliée", tone: "muted" },
  archived: { label: "Archivée", tone: "muted" },
};
/** Statuts que l'on peut choisir à la main (la publication passe par le bouton dédié). */
export const MANUAL_INVITATION_STATUSES: InvitationStatus[] = ["draft", "customizing", "pending_review", "ready"];

export const TEMPLATE_STATUS = {
  draft: { label: "Hors catalogue", tone: "muted" },
  published: { label: "Dans le catalogue", tone: "success" },
  archived: { label: "Archivé", tone: "muted" },
} as const satisfies Record<string, { label: string; tone: Tone }>;

export type Tone = "accent" | "info" | "warning" | "success" | "danger" | "muted";
export const TONE_CLASSES: Record<Tone, string> = {
  accent: "text-forest bg-sage-soft",
  info: "text-[#3d5a73] bg-[#e7eef4]",
  warning: "text-warning bg-[#f6eddf]",
  success: "text-success bg-[#e5eee4]",
  danger: "text-danger bg-danger-soft",
  muted: "text-stone bg-paper",
};
