import Link from "next/link";
import { EmptyState, PageHeader } from "@/components/admin/PageHeader";
import { MediaThumb } from "@/components/media/MediaThumb";
import { MediaUploader } from "@/components/media/MediaUploader";
import { MediaBoard } from "@/components/media/MediaBoard";
import { getCustomCollections } from "./actions";
import { BUILTIN_MEDIA, BUILTIN_COLLECTION_PREFIX } from "@/lib/builtin-media";
import { requireStaff } from "@/lib/auth";
import { DEFAULT_COLLECTIONS, KIND_LABELS, formatBytes, type MediaItem, type MediaKind } from "@/lib/media";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Médias" };

type Search = Promise<{ collection?: string; type?: string; q?: string; supprime?: string }>;
const KINDS = Object.keys(KIND_LABELS) as MediaKind[];

export default async function MediaPage({ searchParams }: { searchParams: Search }) {
  await requireStaff();
  const { collection = "", type = "", q = "", supprime } = await searchParams;
  const supabase = (await createClient())!;

  let query = supabase.from("media_assets").select("*").order("created_at", { ascending: false }).limit(400);
  if (collection) query = query.eq("collection", collection);
  if ((KINDS as string[]).includes(type)) query = query.eq("kind", type);
  const term = q.trim().replace(/[%,()]/g, " ").slice(0, 80);
  if (term) query = query.ilike("name", `%${term}%`);

  const [{ data, error }, { data: all }, custom] = await Promise.all([query, supabase.from("media_assets").select("collection, size_bytes"), getCustomCollections()]);
  const counts = new Map<string, number>();
  let totalBytes = 0;
  for (const r of all ?? []) {
    counts.set(r.collection, (counts.get(r.collection) ?? 0) + 1);
    totalBytes += Number(r.size_bytes);
  }
  const collections = [...new Set([...DEFAULT_COLLECTIONS, ...custom, ...counts.keys()])];
  const isDefault = new Set<string>(DEFAULT_COLLECTIONS);
  const storage = createAdminClient()?.storage.from("media");
  const items: MediaItem[] = (data ?? []).map((m) => ({ ...(m as Omit<MediaItem, "url">), url: storage?.getPublicUrl(m.path).data.publicUrl ?? "" }));

  const link = (patch: Record<string, string>) => {
    const p = new URLSearchParams({ collection, type, q: term, ...patch });
    for (const [k, v] of [...p.entries()]) if (!v) p.delete(k);
    const s = p.toString();
    return `/admin/medias${s ? `?${s}` : ""}`;
  };

  return (
    <>
      <PageHeader
        title="Médias et illustrations"
        description={`Vos fleurs, feuillages, textures, enveloppes, vidéos et musiques, réutilisables dans les modèles et les invitations. ${all?.length ?? 0} fichier(s) · ${formatBytes(totalBytes)}.`}
      />
      {supprime ? <p role="status" className="mb-4 rounded-sm bg-sage-soft px-4 py-2 text-sm">Le fichier a été supprimé.</p> : null}
      {storage ? <MediaUploader collections={collections} /> : <p role="alert" className="card p-4 text-danger">Stockage non configuré : ajoutez SUPABASE_SERVICE_ROLE_KEY dans les variables d&apos;environnement.</p>}

      <MediaBoard
        key={`${collection}|${type}|${term}|${items.map((m) => `${m.id}:${m.collection}`).join(",")}`}
        activeCollection={collection}
        all={{ count: all?.length ?? 0, href: link({ collection: "" }), active: !collection }}
        collections={collections.map((c) => ({ name: c, count: counts.get(c) ?? 0, href: link({ collection: c }), active: collection === c, custom: !isDefault.has(c) }))}
        items={items}
        toolbar={
          <>
            <div className="mb-4 flex flex-wrap items-center gap-2">
              {[{ v: "", l: "Tous" }, ...KINDS.map((k) => ({ v: k, l: KIND_LABELS[k] }))].map((t) => (
                <Link key={t.v} href={link({ type: t.v })} className={`rounded-full border px-3 py-1.5 text-xs ${type === t.v ? "border-forest bg-forest text-ivory" : "border-line bg-white hover:border-forest"}`}>
                  {t.l}
                </Link>
              ))}
              <form className="ml-auto" role="search">
                {collection ? <input type="hidden" name="collection" value={collection} /> : null}
                {type ? <input type="hidden" name="type" value={type} /> : null}
                <label htmlFor="q" className="sr-only">Rechercher un fichier</label>
                <input id="q" name="q" defaultValue={term} placeholder="Nom du fichier…" className="field min-h-9 w-56 py-1 text-sm" />
              </form>
            </div>
            {error ? <p role="alert" className="text-danger">Erreur de chargement : {error.message}</p> : null}
          </>
        }
        empty={
          <EmptyState title={all?.length ? "Aucun fichier ne correspond" : "La bibliothèque est vide"}>
            {all?.length ? "Modifiez les filtres ou la recherche, ou glissez des visuels dans cette collection." : "Importez vos premières illustrations avec le cadre ci-dessus."}
          </EmptyState>
        }
      />
      <section className="mt-12" aria-labelledby="builtin-title">
        <h2 id="builtin-title" className="font-serif text-2xl">Illustrations fournies avec E-Invitly</h2>
        <p className="mt-1 max-w-2xl text-sm text-stone">
          Tiges minimalistes, guirlandes, rose, papillon… Elles apparaissent dans le bouton « Bibliothèque » de l&apos;éditeur et se recolorent avec l&apos;option « Teinte ».
        </p>
        <ul className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-5 xl:grid-cols-8">
          {BUILTIN_MEDIA.map((m) => (
            <li key={m.id} className="overflow-hidden rounded-sm border border-line bg-white">
              <div className="checker aspect-square">
                <MediaThumb item={m} />
              </div>
              <div className="border-t border-line px-2 py-1.5">
                <p className="truncate text-xs">{m.name}</p>
                <p className="truncate text-[0.65rem] text-stone">{m.collection.replace(BUILTIN_COLLECTION_PREFIX, "")}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
