import type { Metadata } from "next";
import { PolicyPage } from "@/components/site/PolicyPage";
import { getSettings } from "@/lib/settings";

export const metadata: Metadata = { title: "Politique de confidentialité" };

export default async function Page() {
  const { policies, brand } = await getSettings();
  return (
    <PolicyPage
      title="Politique de confidentialité"
      body={policies.privacyPolicy}
      fallback={
        <>
          <p className="italic text-stone">
            Résumé provisoire décrivant le fonctionnement technique du site, en attendant la politique complète.
          </p>
          <h2>Données collectées</h2>
          <p>
            Formulaire de demande : vos coordonnées (nom, e-mail, téléphone facultatif, pays) et les informations de
            votre événement. Formulaire de réponse des invités : prénom, nom, présence, accompagnants et, uniquement si
            les mariés l&apos;activent, préférences alimentaires.
          </p>
          <h2>Utilisation</h2>
          <p>
            Ces données servent uniquement à préparer l&apos;invitation et à transmettre les réponses aux mariés concernés.
            Elles ne sont ni vendues ni utilisées à des fins publicitaires. Chaque couple n&apos;accède qu&apos;aux réponses
            de sa propre invitation.
          </p>
          <h2>Sécurité et hébergement</h2>
          <p>
            Les données sont stockées dans une base de données protégée par des règles d&apos;accès strictes. Les adresses
            IP ne sont pas conservées : seule une empreinte non réversible sert à limiter les abus.
          </p>
          <h2>Vos droits</h2>
          <p>
            Vous pouvez demander l&apos;accès, la rectification ou la suppression de vos données
            {brand.contactEmail ? <> en écrivant à {brand.contactEmail}</> : " en nous contactant"}.
          </p>
        </>
      }
    />
  );
}
