/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { notFound } from "next/navigation";
import { CopyButton } from "@/components/admin/CopyButton";
import { PageHeader } from "@/components/admin/PageHeader";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { requireStaff } from "@/lib/auth";
import { DEFAULT_COLLECTIONS, KIND_LABELS, formatBytes, type MediaItem } from "@/lib/media";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { formatShortDate } from "@/lib/time";
import { deleteMedia, mediaUsage, updateMedia } from "../actions";

export const metadata = { title: "Fichier" };

export default async function MediaDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ enregistre?: string }> }) {
  await requireStaff();
  const { id } = await params;
  const { enregistre } = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const supabase = (await createClient())!;
  const [{ data: row }, { data: cols }] = await Promise.all([
    supabase.from("media_assets").select("*, profiles!uploaded_by(full_name, email)").eq("id", id).maybeSingle(),
    supabase.from("media_assets").select("collection"),
  ]);
  if (!row) notFound();
  const url = createAdminClient()?.storage.from("media").getPublicUrl(row.path).data.publicUrl ?? "";
  const m = { ...(row as Omit<MediaItem, "url">), url };
  const usage = url ? await mediaUsage(url).catch(() => null) : null;
  const collections = [...new Set([...DEFAULT_COLLECTIONS, ...(cols ?? []).map((c) => c.collection)])];
  const uploader = (row as { profiles?: { full_name?: string | null; email?: string | null } | null }).profiles;

  async function save(form: FormData) {
    "use server";
    await updateMedia(form);
    const { redirect } = await import("next/navigation");
    redirect(`/admin/medias/${id}?enregistre=1`);
  }

  return (
    <>
      <PageHeader
        eyebrow={<Link href={`/admin/medias?collection=${encodeURIComponent(m.collection)}`} className="hover:underline">← {m.collection}</Link>}
        title={m.name}
        description={`${KIND_LABELS[m.kind]} · ${m.width && m.height ? `${m.width}×${m.height} px · ` : ""}${formatBytes(m.size_bytes)} · ajouté le ${formatShortDate(m.created_at)}${uploader ? ` par ${uploader.full_name || uploader.email}` : ""}`}
        actions={<CopyButton text={url} label="Copier l'adresse du fichier" />}
      />
      {enregistre ? <p role="status" className="mb-4 rounded-sm bg-sage-soft px-4 py-2 text-sm">Modifications enregistrées.</p> : null}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <div className="card checker flex min-h-80 items-center justify-center overflow-hidden p-4">
          {m.kind === "image" || m.kind === "svg" ? (
            <img src={url} alt={m.name} className="max-h-[70vh] w-auto max-w-full object-contain" />
          ) : m.kind === "video" ? (
            <video src={url} controls playsInline className="max-h-[70vh] max-w-full" />
          ) : (
            <audio src={url} controls className="w-full max-w-md" />
          )}
        </div>
        <div className="space-y-6">
          <form action={save} className="card space-y-4 p-5">
            <input type="hidden" name="id" value={m.id} />
            <h2 className="font-serif text-2xl">Informations</h2>
            <label className="block">
              <span className="field-label">Nom</span>
              <input name="name" defaultValue={m.name} required maxLength={120} className="field" />
            </label>
            <label className="block">
              <span className="field-label">Collection</span>
              <input name="collection" defaultValue={m.collection} required maxLength={60} list="media-collections" className="field" />
              <datalist id="media-collections">{collections.map((c) => <option key={c} value={c} />)}</datalist>
            </label>
            <label className="block">
              <span className="field-label">Mots-clés (séparés par des virgules)</span>
              <input name="tags" defaultValue={(m.tags ?? []).join(", ")} maxLength={300} placeholder="pivoine, rose poudré, bouquet" className="field" />
            </label>
            <label className="block">
              <span className="field-label">Droits d&apos;utilisation</span>
              <textarea name="license_note" defaultValue={m.license_note ?? ""} maxLength={300} rows={2} className="field" />
            </label>
            <SubmitButton pendingLabel="Enregistrement…">Enregistrer</SubmitButton>
          </form>

          <section className="card p-5">
            <h2 className="font-serif text-2xl">Utilisation</h2>
            {usage === null ? (
              <p className="mt-2 text-sm text-danger">Vérification impossible pour le moment.</p>
            ) : usage.length ? (
              <ul className="mt-3 space-y-1 text-sm">
                {usage.map((u) => (
                  <li key={`${u.kind}-${u.id}`}>
                    <Link href={u.kind === "invitation" ? `/admin/invitations/${u.id}` : `/admin/modeles/${u.id}`} className="text-forest underline-offset-2 hover:underline">
                      {u.kind === "invitation" ? "Invitation" : "Modèle"} · {u.title}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-stone">Ce fichier n&apos;est utilisé dans aucune invitation ni aucun modèle.</p>
            )}
            <p className="mt-4 break-all rounded-sm bg-paper px-3 py-2 font-mono text-[0.7rem] text-stone">{url}</p>
          </section>

          <form action={deleteMedia} className="card border-danger/30 p-5">
            <input type="hidden" name="id" value={m.id} />
            <h2 className="font-serif text-xl">Supprimer</h2>
            {usage && usage.length ? (
              <p className="mt-2 text-sm text-stone">Suppression impossible tant que le fichier est utilisé : retirez-le d&apos;abord des éléments listés ci-dessus.</p>
            ) : usage === null ? null : (
              <>
                <p className="mt-2 text-sm text-stone">Le fichier sera définitivement effacé du stockage.</p>
                <SubmitButton className="btn btn-danger btn-sm mt-3" confirm="Supprimer définitivement ce fichier ?" pendingLabel="Suppression…">
                  Supprimer le fichier
                </SubmitButton>
              </>
            )}
          </form>
        </div>
      </div>
    </>
  );
}
