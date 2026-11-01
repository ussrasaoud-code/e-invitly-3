import type { MediaItem, MediaKind } from "@/lib/media";

/**
 * Illustrations fournies avec E-Invitly (dossier public/decor) : disponibles
 * dans la bibliothèque sans import, utilisables partout (calques, fleur du
 * programme, fonds…). Elles ne peuvent pas être supprimées.
 */
const RAW: Array<{ file: string; name: string; collection: string; kind: MediaKind; w: number; h: number }> = [
  { file: "bibliotheque/tige-coeurs.svg", name: "Tige de cœurs", collection: "Tiges et guirlandes", kind: "svg", w: 52, h: 488 },
  { file: "bibliotheque/tige-saule.svg", name: "Tige de saule", collection: "Tiges et guirlandes", kind: "svg", w: 52, h: 488 },
  { file: "bibliotheque/tige-eucalyptus.svg", name: "Tige d'eucalyptus", collection: "Tiges et guirlandes", kind: "svg", w: 52, h: 488 },
  { file: "bibliotheque/tige-vrille.svg", name: "Tige à vrilles", collection: "Tiges et guirlandes", kind: "svg", w: 52, h: 488 },
  { file: "bibliotheque/tige-brindille.svg", name: "Brindille d'olivier", collection: "Tiges et guirlandes", kind: "svg", w: 52, h: 488 },
  { file: "bibliotheque/tige-pointilles.svg", name: "Ligne et points", collection: "Tiges et guirlandes", kind: "svg", w: 52, h: 488 },
  { file: "bibliotheque/guirlande-saule.svg", name: "Guirlande de saule", collection: "Tiges et guirlandes", kind: "svg", w: 320, h: 70 },
  { file: "bibliotheque/guirlande-coeurs.svg", name: "Guirlande de cœurs", collection: "Tiges et guirlandes", kind: "svg", w: 320, h: 70 },
  { file: "rose.svg", name: "Rose", collection: "Fleurs", kind: "svg", w: 120, h: 120 },
  { file: "papillon.svg", name: "Papillon", collection: "Colombes et oiseaux", kind: "svg", w: 120, h: 100 },
  { file: "colombe.png", name: "Colombe", collection: "Colombes et oiseaux", kind: "image", w: 0, h: 0 },
  { file: "fleurs-aquarelle.png", name: "Fleurs aquarelle", collection: "Fleurs", kind: "image", w: 0, h: 0 },
];

export const BUILTIN_COLLECTION_PREFIX = "E-Invitly · ";

export const BUILTIN_MEDIA: MediaItem[] = RAW.map((r) => ({
  id: `builtin-${r.file.replace(/[^a-z0-9]+/gi, "-")}`,
  name: r.name,
  kind: r.kind,
  url: `/decor/${r.file}`,
  mime_type: r.kind === "svg" ? "image/svg+xml" : "image/png",
  size_bytes: 0,
  width: r.w || null,
  height: r.h || null,
  collection: `${BUILTIN_COLLECTION_PREFIX}${r.collection}`,
  tags: ["fourni"],
  license_note: "Illustration fournie avec E-Invitly",
  created_at: "2026-11-01T00:00:00.000Z",
}));

export const builtinFor = (kinds: MediaKind[]) => BUILTIN_MEDIA.filter((m) => kinds.includes(m.kind));
