"use client";

import { createContext } from "react";
import type { ElementStyle, InvitationLayer, InvitationSection } from "@/lib/invitation/schema";

export type EditorSelection = { sectionId: string; layerId: string | null; elementId?: string | null } | null;

/** Pont entre l'invitation affichée et l'éditeur visuel (absent en ligne). */
export type LayerEditor = {
  selected: EditorSelection;
  select: (sectionId: string, layerId: string | null) => void;
  change: (sectionId: string, layerId: string, patch: Partial<InvitationLayer>) => void;
  selectElement: (sectionId: string, elementId: string) => void;
  changeElement: (sectionId: string, elementId: string, patch: Partial<ElementStyle>) => void;
};

/** Présent uniquement dans l'éditeur visuel */
export const LayerEditorContext = createContext<LayerEditor | null>(null);

/** Section en cours de rendu (pour les éléments intégrés du modèle) */
export const SectionContext = createContext<Pick<InvitationSection, "id" | "elements"> | null>(null);
