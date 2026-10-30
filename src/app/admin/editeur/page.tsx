import Link from "next/link";
import { PageHeader, SoonPanel } from "@/components/admin/PageHeader";
import { requireStaff } from "@/lib/auth";

export const metadata = { title: "Éditeur" };

export default async function EditorPage() {
  await requireStaff();
  return (
    <>
      <PageHeader title="Éditeur d'invitations" />
      <div className="card mb-6 p-5 text-sm leading-relaxed">
        <p className="font-serif text-xl">Déjà disponible</p>
        <p className="mt-2">
          Chaque invitation s&apos;édite depuis sa fiche (<Link href="/admin/invitations" className="text-forest underline">Invitations</Link> → onglet « Informations et design ») :
          textes, prénoms, date et fuseau, programme, lieux, dress code, contacts, ordre et visibilité des sections, couleurs,
          polices, enveloppe, vidéo et musique, avec aperçu mobile en direct, sauvegarde automatique et annuler/rétablir.
        </p>
      </div>
      <SoonPanel phase="phase 6">
        Éditeur visuel en trois colonnes façon Canva : calques décoratifs (fleurs, feuillages) déplaçables et redimensionnables,
        opacité, ordre des calques, recoloration des SVG compatibles, verrouillage, copier-coller, paramètres d&apos;animation
        par élément et historique des versions avec restauration.
      </SoonPanel>
    </>
  );
}
