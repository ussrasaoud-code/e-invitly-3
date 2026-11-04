/**
 * L'invitation est toujours composée sur 390 px de large (éditeur, téléphone des invités,
 * aperçus réduits). Les mesures « en % de la largeur » sont donc converties en pixels
 * (1 % = 3,9 px) plutôt qu'en unités « cqw » : Safari (et Chrome sur iPhone) applique deux
 * fois la réduction « zoom » aux unités cqw, ce qui rapetissait les textes et les espaces
 * sur téléphone. Les pixels sont réduits de la même façon par tous les navigateurs.
 */
export const DESIGN_UNIT = 3.9;
export const cq = (v: number) => `${Math.round(v * DESIGN_UNIT * 1000) / 1000}px`;
