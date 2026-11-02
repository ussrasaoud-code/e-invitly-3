import Link from "next/link";
import { PageHeader } from "@/components/admin/PageHeader";
import { labelsFor } from "@/components/invitation/i18n";
import { requireStaff } from "@/lib/auth";
import { LANG_META, SITE_LANGS, isSiteLang, localePath } from "@/lib/i18n/config";
import { DICTS } from "@/lib/i18n/dict";
import { LANGUAGE_LABELS } from "@/lib/invitation/schema";

export const metadata = { title: "Relecture des traductions" };

/** Aplatit le dictionnaire : [["home.heroTitle", "…"], …] */
function flatten(obj: unknown, prefix = ""): Array<[string, string]> {
  if (typeof obj === "string") return [[prefix, obj]];
  if (Array.isArray(obj)) return obj.flatMap((v, i) => flatten(v, `${prefix}.${i + 1}`));
  if (obj && typeof obj === "object") return Object.entries(obj).flatMap(([k, v]) => flatten(v, prefix ? `${prefix}.${k}` : k));
  return [];
}

const SECTIONS: Record<string, string> = {
  meta: "Titre et description (Google)",
  nav: "Menu",
  footer: "Pied de page",
  banner: "Bandeau de suggestion de langue",
  home: "Page d'accueil",
  cards: "Cartes des modèles",
  categories: "Catégories",
  styles: "Styles",
  catalog: "Catalogue",
  template: "Fiche d'un modèle",
  demo: "Démo plein écran",
  request: "Formulaire de demande",
  thanks: "Page « Merci »",
  email: "E-mail de confirmation",
  login: "Connexion",
  legal: "Pages légales",
  notFound: "Page introuvable",
  setup: "Configuration",
  preview: "Relecture",
  invitation: "Invitations (boutons, réponse, compte à rebours…)",
};

/**
 * Tous les textes du site, français à gauche et langue relue à droite,
 * pour une relecture rapide avant d'ouvrir une langue aux visiteurs.
 */
export default async function TranslationsPage({ searchParams }: { searchParams: Promise<{ langue?: string }> }) {
  await requireStaff();
  const { langue } = await searchParams;
  const lang = isSiteLang(langue) && langue !== "fr" ? langue : "en";
  // Textes du site + libellés fixes des invitations (boutons, réponse, compte à rebours…)
  const fr = new Map([...flatten(DICTS.fr), ...flatten(labelsFor("fr"), "invitation")]);
  const other = [...flatten(DICTS[lang]), ...flatten(labelsFor(lang), "invitation")];
  const groups = new Map<string, Array<[string, string]>>();
  for (const [k, v] of other) {
    const g = k.split(".")[0];
    groups.set(g, [...(groups.get(g) ?? []), [k, v]]);
  }
  return (
    <>
      <PageHeader
        title="Relecture des traductions"
        description="Tous les textes fixes du site vitrine. Faites relire chaque langue par un locuteur natif avant de l'ouvrir dans Paramètres → Langues. Les corrections se font dans le code (fichiers src/lib/i18n/dict/) : envoyez-les-moi."
      />
      <nav aria-label="Langue relue" className="mb-6 flex flex-wrap gap-2">
        {SITE_LANGS.filter((l) => l !== "fr").map((l) => (
          <Link
            key={l}
            href={`/admin/traductions?langue=${l}`}
            aria-current={l === lang ? "page" : undefined}
            className={`rounded-full border px-3 py-1.5 text-sm ${l === lang ? "border-forest bg-forest text-ivory" : "border-line bg-white hover:border-forest"}`}
          >
            {LANGUAGE_LABELS[l]}
          </Link>
        ))}
        <a href={localePath(lang, "/")} target="_blank" rel="noopener" className="ms-auto self-center text-sm text-forest underline underline-offset-4">
          Voir le site en {LANG_META[lang].native} ↗
        </a>
      </nav>
      <div className="space-y-8">
        {[...groups.entries()].map(([g, rows]) => (
          <section key={g} className="card overflow-hidden">
            <h2 className="border-b border-line bg-paper px-4 py-2 font-serif text-xl">{SECTIONS[g] ?? g}</h2>
            <table className="w-full table-fixed text-sm">
              <thead className="sr-only">
                <tr><th>Clé</th><th>Français</th><th>{LANG_META[lang].native}</th></tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map(([k, v]) => (
                  <tr key={k} className="align-top">
                    <td className="w-40 px-4 py-2 font-mono text-[0.68rem] text-stone">{k.split(".").slice(1).join(".")}</td>
                    <td className="px-4 py-2 text-stone" lang="fr">{fr.get(k)}</td>
                    <td className="px-4 py-2" lang={lang} dir={LANG_META[lang].dir}>{v}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ))}
      </div>
    </>
  );
}
