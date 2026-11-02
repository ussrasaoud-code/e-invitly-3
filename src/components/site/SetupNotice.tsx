/** Message affiché tant que Supabase n'est pas configuré (aucune donnée inventée). */
export function SetupNotice({ t }: { t: { title: string; text: string } }) {
  return (
    <div role="status" className="card mx-auto max-w-xl p-6 text-center text-sm leading-relaxed text-stone">
      <p className="eyebrow mb-2">{t.title}</p>
      {t.text}
    </div>
  );
}
