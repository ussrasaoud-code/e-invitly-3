/** Message affiché tant que Supabase n'est pas configuré (aucune donnée inventée). */
export function SetupNotice({ what = "les modèles" }: { what?: string }) {
  return (
    <div role="status" className="card mx-auto max-w-xl p-6 text-center text-sm leading-relaxed text-stone">
      <p className="eyebrow mb-2">Configuration requise</p>
      La base de données n&apos;est pas encore connectée : {what} s&apos;afficheront ici dès que les variables
      Supabase seront renseignées (voir le guide de déploiement).
    </div>
  );
}
