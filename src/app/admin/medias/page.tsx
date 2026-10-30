import { PageHeader, SoonPanel } from "@/components/admin/PageHeader";
import { requireStaff } from "@/lib/auth";

export const metadata = { title: "Médias" };

export default async function MediaPage() {
  await requireStaff();
  return (
    <>
      <PageHeader title="Médias et illustrations" />
      <SoonPanel phase="phase 3b (prochaine livraison)">
        Import multiple de vos fleurs, feuillages, textures, enveloppes, cachets, vidéos et musiques ; collections, recherche,
        aperçu, réutilisation dans les modèles, suppression avec vérification des dépendances. Le stockage (bucket « media »
        public et « uploads » privé, formats et tailles limités) et la table des médias sont déjà créés. En attendant, les
        champs d&apos;image des modèles et invitations acceptent un lien https.
      </SoonPanel>
    </>
  );
}
