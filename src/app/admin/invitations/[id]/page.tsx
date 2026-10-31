import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/admin/PageHeader";
import { CopyButton } from "@/components/admin/CopyButton";
import { publicUrl } from "@/lib/publication";
import { PreviewLink } from "./PreviewLink";
import { RsvpTab } from "./RsvpTab";
import { loadRsvpOverview } from "@/lib/rsvp-data";
import { getOrCreateRsvpForm } from "@/lib/rsvp-server";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { requireStaff } from "@/lib/auth";
import { env } from "@/lib/env";
import { invitationContentSchema, type RendererKey } from "@/lib/invitation/schema";
import { INVITATION_STATUS, MANUAL_INVITATION_STATUSES, type InvitationStatus } from "@/lib/status";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime, formatShortDate } from "@/lib/time";
import { deleteInvitation, duplicateInvitation, publishInvitation, restoreVersionToDraft, revokePreviewLinks, saveInvitationDraft, setAccessCode, setNoindex, unpublishInvitation, saveInvitationNotes, setInvitationArchived, updateInvitationStatus, updateSlug } from "../actions";
import { InvitationEditor } from "@/components/admin/InvitationEditor";
import { SlugField } from "./SlugField";

export const metadata = { title: "Invitation" };

const TABS = [
  { value: "contenu", label: "Informations et design" },
  { value: "rsvp", label: "RSVP" },
  { value: "publication", label: "Publication" },
  { value: "notes", label: "Notes internes" },
] as const;

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ onglet?: string; nouvelle?: string; publiee?: string; q?: string; presence?: string }> };

export default async function InvitationPage({ params, searchParams }: Props) {
  await requireStaff();
  const { id } = await params;
  const { onglet = "contenu", nouvelle, publiee, q, presence } = await searchParams;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const supabase = (await createClient())!;

  const { data: inv } = await supabase
    .from("invitations")
    .select("*, templates(name, slug), template_versions(version), client_requests!invitations_request_id_fkey(reference, id)")
    .eq("id", id)
    .maybeSingle();
  if (!inv) notFound();

  if (onglet === "rsvp") await getOrCreateRsvpForm(supabase, id);
  const [{ data: access }, { data: versions }, { data: redirects }, { count: activePreviews }, rsvpOverview] = await Promise.all([
    supabase.from("invitation_access").select("email, role, user_id, created_at").eq("invitation_id", id),
    supabase.from("invitation_versions").select("id, version, published_at, note").eq("invitation_id", id).order("version", { ascending: false }),
    supabase.from("slug_redirects").select("old_slug").eq("invitation_id", id),
    supabase.from("preview_tokens").select("token_hash", { count: "exact", head: true }).eq("invitation_id", id).gt("expires_at", new Date().toISOString()),
    onglet === "rsvp" ? loadRsvpOverview(supabase, id) : Promise.resolve(null),
  ]);

  const parsed = invitationContentSchema.safeParse(inv.draft_content);
  const status = inv.status as InvitationStatus;
  const tpl = inv.templates as unknown as { name: string; slug: string } | null;
  const tplVersion = inv.template_versions as unknown as { version: number } | null;
  const req = inv.client_requests as unknown as { reference: string; id: string } | null;
  const host = env.siteUrl.replace(/^https?:\/\//, "");
  const tab = TABS.some((t) => t.value === onglet) ? onglet : "contenu";
  const isLive = status === "published";
  const liveUrl = publicUrl(inv.slug);
  const liveVersion = versions?.find((v) => v.id === inv.published_version_id)?.version ?? null;
  const hasUnpublishedChanges =
    isLive && inv.published_at && new Date(inv.draft_updated_at).getTime() > new Date(inv.published_at).getTime() + 1000;

  return (
    <>
      <PageHeader
        eyebrow={<Link href="/admin/invitations" className="hover:text-forest">← Invitations</Link>}
        title={inv.title}
        description={
          <>
            {formatShortDate(inv.event_at)} · modèle {tpl?.name ?? "—"}
            {tplVersion ? ` (version ${tplVersion.version} figée)` : ""}
            {req ? (
              <>
                {" "}· depuis la demande <Link href={`/admin/demandes/${req.id}`} className="underline underline-offset-4">{req.reference}</Link>
              </>
            ) : null}
            <br />
            <span className="text-xs">{host}/{inv.slug}</span>
          </>
        }
        actions={
          <>
            <StatusBadge {...INVITATION_STATUS[status]} />
            {isLive ? (
              <a href={`/${inv.slug}`} target="_blank" rel="noopener" className="btn btn-secondary btn-sm">Voir en ligne ↗</a>
            ) : null}
            <Link href={`/admin/invitations/${inv.id}?onglet=publication`} className="btn btn-primary btn-sm">
              {isLive ? "Publication" : "Publier"}
            </Link>
            <form action={duplicateInvitation}>
              <input type="hidden" name="id" value={inv.id} />
              <SubmitButton className="btn btn-secondary btn-sm" pendingLabel="Duplication…">Dupliquer</SubmitButton>
            </form>
            <form action={setInvitationArchived}>
              <input type="hidden" name="id" value={inv.id} />
              <input type="hidden" name="archive" value={status === "archived" ? "0" : "1"} />
              <SubmitButton className="btn btn-ghost btn-sm">{status === "archived" ? "Restaurer" : "Archiver"}</SubmitButton>
            </form>
          </>
        }
      />

      {nouvelle ? (
        <p role="status" className="mb-6 border border-sage bg-sage-soft px-4 py-3 text-sm text-forest-deep">
          Invitation créée à partir de la demande. Les points à reprendre (témoins, programme détaillé…) sont listés dans l&apos;onglet Notes internes.
        </p>
      ) : null}

      <nav aria-label="Onglets" className="mb-6 flex gap-1 overflow-x-auto border-b border-line">
        {TABS.map((t) => (
          <Link
            key={t.value}
            href={`/admin/invitations/${inv.id}?onglet=${t.value}`}
            aria-current={tab === t.value ? "page" : undefined}
            className={`whitespace-nowrap border-b-2 px-4 py-2.5 text-sm ${tab === t.value ? "border-forest text-forest" : "border-transparent text-stone hover:text-charcoal"}`}
          >
            {t.label}
          </Link>
        ))}
      </nav>

      {tab === "contenu" ? (
        parsed.success ? (
          <InvitationEditor save={saveInvitationDraft.bind(null, inv.id)} initial={parsed.data} renderer={inv.renderer as RendererKey} initialSavedAt={inv.draft_updated_at} />
        ) : (
          <div role="alert" className="card p-6 text-sm">
            Le contenu de cette invitation ne respecte pas le format attendu et ne peut pas être édité.
            <pre className="mt-3 overflow-x-auto text-xs text-stone">{JSON.stringify(parsed.error.issues.slice(0, 5), null, 2)}</pre>
          </div>
        )
      ) : null}

      {tab === "rsvp" ? (
        rsvpOverview ? (
          <RsvpTab invitationId={inv.id} overview={rsvpOverview} timezone={inv.timezone} q={q ?? ""} presence={presence ?? ""} isLive={isLive} />
        ) : null
      ) : null}

      {tab === "publication" ? (
        <div className="grid gap-6 lg:grid-cols-2">
          {publiee ? (
            <p role="status" className="border border-sage bg-sage-soft px-4 py-3 text-sm text-forest-deep lg:col-span-2">
              Version {publiee} publiée. Elle est visible à l&apos;adresse ci-dessous : copiez le lien et envoyez-le au couple.
            </p>
          ) : null}

          <section className="card p-5 lg:col-span-2">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="font-serif text-2xl">Publication</h2>
                <p className="mt-1 text-sm text-stone">
                  {isLive
                    ? `En ligne depuis le ${formatDateTime(inv.published_at)} · version ${liveVersion ?? "—"}`
                    : status === "unpublished"
                      ? "Dépubliée : l'adresse n'affiche plus l'invitation. Rien n'est perdu."
                      : "Pas encore publiée : seuls vous et les personnes ayant un lien d'aperçu peuvent la voir."}
                </p>
              </div>
              <StatusBadge {...INVITATION_STATUS[status]} />
            </div>

            <div className="mt-5 rounded-sm border border-line bg-paper p-4">
              <p className="text-xs uppercase tracking-wider text-stone">Lien de l&apos;invitation</p>
              <p className={`mt-1 break-all text-lg ${isLive ? "text-forest-deep" : "text-stone"}`}>{liveUrl}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {isLive ? (
                  <>
                    <CopyButton text={liveUrl} className="btn btn-primary btn-sm" />
                    <a href={`/${inv.slug}`} target="_blank" rel="noopener" className="btn btn-secondary btn-sm">Ouvrir l&apos;invitation ↗</a>
                  </>
                ) : (
                  <p className="text-sm text-stone">Le lien fonctionnera dès la publication.</p>
                )}
              </div>
            </div>

            {hasUnpublishedChanges ? (
              <p className="mt-4 text-sm text-warning">
                Des modifications du brouillon ne sont pas encore en ligne : les invités voient toujours la version {liveVersion}. Publiez pour les mettre à jour (le lien ne change pas).
              </p>
            ) : null}

            <div className="mt-5 flex flex-wrap items-end gap-3 border-t border-line pt-5">
              {status === "archived" ? (
                <p className="text-sm text-stone">Restaurez l&apos;invitation (en haut de page) pour pouvoir la publier.</p>
              ) : (
                <form action={publishInvitation} className="flex flex-wrap items-end gap-2">
                  <input type="hidden" name="id" value={inv.id} />
                  <label className="text-sm">
                    <span className="field-label !text-xs">Note de version (facultatif)</span>
                    <input name="note" maxLength={200} className="field min-h-10 w-64 text-sm" placeholder="ex. horaire du dîner corrigé" />
                  </label>
                  <SubmitButton
                    className="btn btn-primary btn-sm"
                    pendingLabel="Publication…"
                    confirm={isLive ? "Mettre à jour l'invitation en ligne avec le brouillon actuel ?" : "Publier l'invitation ? Elle sera visible par toute personne ayant le lien."}
                  >
                    {isLive ? "Publier les modifications" : status === "unpublished" ? "Republier" : "Publier"}
                  </SubmitButton>
                </form>
              )}
              {isLive ? (
                <form action={unpublishInvitation}>
                  <input type="hidden" name="id" value={inv.id} />
                  <SubmitButton className="btn btn-ghost btn-sm text-danger" confirm="Dépublier ? Le lien n'affichera plus l'invitation (vous pourrez la republier).">
                    Dépublier
                  </SubmitButton>
                </form>
              ) : null}
            </div>
            <p className="mt-3 text-xs text-stone">
              Les réponses des invités arrivent dans l&apos;onglet RSVP. Le formulaire se règle depuis ce même onglet.
            </p>
          </section>

          <section className="card p-5">
            <h2 className="font-serif text-2xl">Aperçu pour validation</h2>
            <p className="mt-1 text-sm text-stone">
              Un lien privé (7 jours) qui montre le brouillon, pour que le couple valide avant la publication. Il n&apos;est pas indexé et ne donne accès à rien d&apos;autre.
            </p>
            <div className="mt-4">
              <PreviewLink invitationId={inv.id} />
            </div>
            {activePreviews ? (
              <form action={revokePreviewLinks} className="mt-4 text-sm text-stone">
                <input type="hidden" name="id" value={inv.id} />
                {activePreviews} lien{activePreviews > 1 ? "s" : ""} d&apos;aperçu actif{activePreviews > 1 ? "s" : ""}.{" "}
                <SubmitButton className="underline underline-offset-4 hover:text-danger" confirm="Désactiver tous les liens d'aperçu de cette invitation ?">
                  Tout désactiver
                </SubmitButton>
              </form>
            ) : null}
          </section>

          <section className="card p-5">
            <h2 className="font-serif text-2xl">Adresse</h2>
            <p className="mt-1 text-sm text-stone">Proposée automatiquement à partir des prénoms. Modifiable à tout moment.</p>
            <form action={updateSlug} className="mt-4">
              <input type="hidden" name="id" value={inv.id} />
              <SlugField invitationId={inv.id} initial={inv.slug} host={host} published={Boolean(inv.published_version_id)} />
            </form>
            {redirects?.length ? (
              <p className="mt-3 text-xs text-stone">
                Anciennes adresses redirigées ici : {redirects.map((r) => r.old_slug).join(", ")}
              </p>
            ) : null}
          </section>

          <section className="card p-5">
            <h2 className="font-serif text-2xl">Confidentialité</h2>
            <form action={setNoindex} className="mt-4">
              <input type="hidden" name="id" value={inv.id} />
              <label className="flex items-start gap-2 text-sm">
                <input type="checkbox" name="noindex" defaultChecked={inv.noindex} className="mt-0.5 h-4 w-4 accent-forest" />
                <span>Masquer l&apos;invitation des moteurs de recherche (recommandé)</span>
              </label>
              <SubmitButton className="btn btn-secondary btn-sm mt-3">Enregistrer</SubmitButton>
            </form>
            <h3 className="mt-6 text-sm font-medium">Code d&apos;accès</h3>
            <p className="mt-1 text-sm text-stone">
              {inv.access_code_hash
                ? "Actif : les invités doivent saisir le code pour voir l'invitation. Le code n'est pas affiché ici (il est enregistré de façon chiffrée) : communiquez-le au couple au moment où vous le définissez."
                : "Aucun : toute personne ayant le lien voit l'invitation."}
            </p>
            <form action={setAccessCode} className="mt-3 flex flex-wrap items-end gap-2">
              <input type="hidden" name="id" value={inv.id} />
              <label className="text-sm">
                <span className="field-label !text-xs">{inv.access_code_hash ? "Nouveau code" : "Définir un code"}</span>
                <input name="code" minLength={4} maxLength={40} autoComplete="off" className="field min-h-10 w-48 text-sm" required />
              </label>
              <SubmitButton className="btn btn-secondary btn-sm">Enregistrer le code</SubmitButton>
            </form>
            {inv.access_code_hash ? (
              <form action={setAccessCode} className="mt-2">
                <input type="hidden" name="id" value={inv.id} />
                <input type="hidden" name="remove" value="1" />
                <SubmitButton className="btn btn-ghost btn-sm" confirm="Retirer le code d'accès ? Toute personne ayant le lien verra l'invitation.">Retirer le code</SubmitButton>
              </form>
            ) : null}
          </section>

          <section className="card p-5">
            <h2 className="font-serif text-2xl">Historique des publications</h2>
            {versions?.length ? (
              <ul className="mt-3 divide-y divide-line text-sm">
                {versions.map((v) => (
                  <li key={v.version} className="flex items-center justify-between gap-3 py-2">
                    <span>
                      Version {v.version}
                      {v.version === liveVersion && isLive ? <span className="ml-1 text-xs text-forest">· en ligne</span> : null}
                      <span className="block text-xs text-stone">{formatDateTime(v.published_at)}{v.note ? ` · ${v.note}` : ""}</span>
                    </span>
                    <form action={restoreVersionToDraft}>
                      <input type="hidden" name="id" value={inv.id} />
                      <input type="hidden" name="version" value={v.version} />
                      <SubmitButton className="btn btn-ghost btn-sm" confirm={`Remplacer le brouillon actuel par la version ${v.version} ? (la version en ligne ne change pas tant que vous ne publiez pas)`}>
                        Recopier dans le brouillon
                      </SubmitButton>
                    </form>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-stone">Jamais publiée.</p>
            )}
          </section>

          <section className="card p-5">
            <h2 className="font-serif text-2xl">Suivi interne</h2>
            {status === "published" ? (
              <p className="mt-3 text-sm text-stone">Statut géré par la publication.</p>
            ) : (
              <form action={updateInvitationStatus} className="mt-4 flex gap-2">
                <input type="hidden" name="id" value={inv.id} />
                <label htmlFor="inv-status" className="sr-only">Statut</label>
                <select id="inv-status" name="status" defaultValue={MANUAL_INVITATION_STATUSES.includes(status) ? status : "draft"} className="field min-h-10 text-sm">
                  {MANUAL_INVITATION_STATUSES.map((s) => (
                    <option key={s} value={s}>{INVITATION_STATUS[s].label}</option>
                  ))}
                </select>
                <SubmitButton className="btn btn-secondary btn-sm">OK</SubmitButton>
              </form>
            )}
            <h3 className="mt-6 text-sm font-medium">Accès du couple (espace mariés)</h3>
            {access?.length ? (
              <ul className="mt-2 space-y-1 text-sm">
                {access.map((a) => (
                  <li key={a.email}>
                    {a.email} <span className="text-xs text-stone">· {a.role === "owner" ? "propriétaire" : "lecture"}{a.user_id ? " · compte actif" : " · compte à créer"}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-stone">Aucun accès défini.</p>
            )}
          </section>

          <section className="card border-danger/30 p-5 lg:col-span-2">
            <h2 className="font-serif text-xl text-danger">Supprimer définitivement</h2>
            <p className="mt-1 text-sm text-stone">Supprime l&apos;invitation, ses versions et toutes ses réponses RSVP. Préférez l&apos;archivage si vous voulez conserver l&apos;historique.</p>
            <form action={deleteInvitation} className="mt-4 flex flex-wrap items-end gap-2">
              <input type="hidden" name="id" value={inv.id} />
              <label className="text-sm">
                <span className="field-label !text-xs">Pour confirmer, saisissez « {inv.slug} »</span>
                <input name="confirmation" className="field min-h-10 w-64 text-sm" autoComplete="off" required />
              </label>
              <SubmitButton className="btn btn-danger btn-sm" confirm="Supprimer définitivement cette invitation et ses réponses ?">Supprimer</SubmitButton>
            </form>
          </section>
        </div>
      ) : null}

      {tab === "notes" ? (
        <section className="card max-w-3xl p-5">
          <h2 className="font-serif text-2xl">Notes internes</h2>
          <p className="mt-1 text-sm text-stone">Visibles uniquement dans l&apos;administration. Dernière modification : {formatDateTime(inv.updated_at)}.</p>
          <form action={saveInvitationNotes} className="mt-4">
            <input type="hidden" name="id" value={inv.id} />
            <label htmlFor="inv-notes" className="sr-only">Notes internes</label>
            <textarea id="inv-notes" name="notes" defaultValue={inv.internal_notes} rows={14} className="field text-sm" />
            <SubmitButton className="btn btn-primary btn-sm mt-3" pendingLabel="Enregistrement…">Enregistrer</SubmitButton>
          </form>
        </section>
      ) : null}
    </>
  );
}
