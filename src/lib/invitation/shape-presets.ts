import type { InvitationContent, InvitationLayer } from "./schema";

type Colors = InvitationContent["theme"]["colors"];
export type ShapePreset = { id: string; label: string; patch: Partial<InvitationLayer> };

/** Formes prêtes à l'emploi, aux couleurs du thème de l'invitation. */
export function shapePresets(c: Colors): ShapePreset[] {
  return [
    { id: "cadre-fin", label: "Cadre fin", patch: { shape: "rect", width: 82, ratio: 1.25, strokeWidth: 1 } },
    { id: "double-cadre", label: "Double cadre", patch: { shape: "double", width: 84, ratio: 1.3, strokeWidth: 1 } },
    { id: "cadre-arrondi", label: "Cadre arrondi", patch: { shape: "rounded", width: 80, ratio: 1.2, radius: 14, strokeWidth: 1.5 } },
    { id: "cadre-pointille", label: "Cadre pointillé", patch: { shape: "rect", width: 80, ratio: 1.2, strokeWidth: 1.5, dash: "dotted" } },
    { id: "arche", label: "Arche", patch: { shape: "arch", width: 70, ratio: 1.45, strokeWidth: 1.5 } },
    { id: "arche-pleine", label: "Arche pleine", patch: { shape: "arch", width: 72, ratio: 1.45, strokeWidth: 0, fill: c.surface } },
    { id: "medaillon", label: "Médaillon", patch: { shape: "circle", width: 56, ratio: 1, strokeWidth: 1 } },
    { id: "ovale", label: "Ovale", patch: { shape: "circle", width: 52, ratio: 1.35, strokeWidth: 1 } },
    { id: "pastille", label: "Pastille", patch: { shape: "circle", width: 34, ratio: 1, strokeWidth: 0, fill: c.accentSoft, fillOpacity: 0.55 } },
    { id: "bandeau", label: "Bandeau", patch: { shape: "rect", width: 100, ratio: 0.16, strokeWidth: 0, fill: c.accentSoft, fillOpacity: 0.45 } },
    { id: "etiquette", label: "Étiquette", patch: { shape: "rounded", width: 60, ratio: 0.28, radius: 50, strokeWidth: 1 } },
    { id: "ligne", label: "Ligne fine", patch: { shape: "line", width: 40, ratio: 0.04, strokeWidth: 1 } },
    { id: "separateur-feuillage", label: "Séparateur feuillage", patch: { shape: "leafdivider", width: 70, ratio: 0.1, strokeWidth: 1, stroke: c.accentSoft } },
    { id: "separateur-losange", label: "Séparateur losange", patch: { shape: "diamonddivider", width: 60, ratio: 0.1, strokeWidth: 1 } },
    { id: "pointilles", label: "Ligne pointillée", patch: { shape: "line", width: 44, ratio: 0.04, strokeWidth: 2, dash: "dotted" } },
    { id: "losange", label: "Losange", patch: { shape: "diamond", width: 10, ratio: 1, strokeWidth: 0, fill: c.accent } },
    { id: "coeur", label: "Cœur", patch: { shape: "heart", width: 16, ratio: 0.92, strokeWidth: 0, fill: c.accent, fillOpacity: 0.85 } },
    { id: "cartouche-compteur", label: "Cartouche (compteur)", patch: { shape: "cartouche", width: 92, ratio: 0.36, strokeWidth: 1, fill: c.surface, stroke: c.accent } },
    { id: "cartouche-carre", label: "Cartouche haut", patch: { shape: "cartouche", width: 80, ratio: 1.1, strokeWidth: 1, fill: c.surface, stroke: c.accent } },
    { id: "etiquette-ancienne", label: "Étiquette ancienne", patch: { shape: "etiquette", width: 86, ratio: 0.42, strokeWidth: 1, fill: c.surface, stroke: c.accent } },
    { id: "etiquette-haute", label: "Étiquette haute", patch: { shape: "etiquette", width: 78, ratio: 1.25, strokeWidth: 1, fill: c.surface, stroke: c.accent } },
    { id: "plaque", label: "Plaque à angles en escalier", patch: { shape: "plaque", width: 86, ratio: 0.42, strokeWidth: 1, fill: c.surface, stroke: c.accent } },
    { id: "plaque-haute", label: "Plaque haute", patch: { shape: "plaque", width: 78, ratio: 1.25, strokeWidth: 1, fill: c.surface, stroke: c.accent } },
    { id: "festonne", label: "Cadre festonné", patch: { shape: "festonne", width: 86, ratio: 0.42, strokeWidth: 1, fill: c.surface, stroke: c.accent } },
    { id: "fond-section", label: "Fond de couleur", patch: { shape: "rect", width: 100, ratio: 1.6, strokeWidth: 0, fill: c.surface, x: 50, y: 50 } },
  ];
}
