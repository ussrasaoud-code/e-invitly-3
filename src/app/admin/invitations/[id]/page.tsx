import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader, SoonPanel } from "@/components/admin/PageHeader";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { requireStaff } from "@/lib/auth";
import { env } from "@/lib/env";
import { invitationContentSchema, type RendererKey } from "@/lib/invitation/schema";
import { INVITATION_STATUS, MANUAL_INVITATION_STATUSES, type InvitationStatus } from "@/lib/status";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime, formatShortDate } from "@/lib/time";
import { deleteInvitation, duplicateInvitation, saveInvitationDraft, saveInvitationNotes, setInvitationArchived, updateInvitationStatus, updateSlug } from "../actions";
import { InvitationEditor } from "@/components/admin/InvitationEditor";
import { SlugField } from "./SlugField";

export const metadata = { title: "Invitation" };

const TABS = [
  { value: "contenu", label: "Informations et design" },
  { value: "rsvp", label: "RSVP" },
  { value: "publication", label: "Publication" },
  { value: "notes", label: "Notes internes" },
] as const;

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ onglet?: string; nouvelle?: string }> };

export default async function InvitationPage({ params, searchParams }: Props) {
  await requireStaff();
  const { id } = await params;
  const { onglet = "contenu", nouvelle } = await searchParams;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const supabase = (await createClient())!;

  const { data: inv } = await supabase
    .from("invitations")
    .select("*, templates(name, slug), template_versions(version), client_requests!invitations_request_id_fkey(reference, id)")
    .eq("id", id)
    .maybeSingle();
  if (!inv) notFound();

  const [{ data: stats }, { data: access }, { data: rsvpForm }, { data: versions }] = await Promise.all([
    supabase.from("rsvp_stats").select("*").eq("invitation_id", id).maybeSingle(),
    supabase.from("invitation_access").select("email, role, user_id, created_at").eq("invitation_id", id),
    supabase.from("rsvp_forms").select("*").eq("invitation_id", id).maybeSingle(),
    supabase.from("invitation_versions").select("version, published_at, note").eq("invitation_id", id).order("version", { ascending: false }),
  ]);

  const parsed = invitationContentSchema.safeParse(inv.draft_content);
  const status = inv.status as InvitationStatus;
  const tpl = inv.templates as unknown as { name: string; slug: string } | null;
  const tplVersion = inv.template_versions as unknown as { version: number } | null;
  const req = inv.client_requests as unknown as { reference: string; id: string } | null;
  const host = env.siteUrl.replace(/^https?:\/\//, "");
  const tab = TABS.some((t) => t.value === onglet) ? onglet : "contenu";

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
        <div className="grid gap-6 lg:grid-cols-2">
          <section className="card p-5">
            <h2 className="font-serif text-2xl">Réponses</h2>
            <dl className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
              {[
                ["Formulaires reçus", stats?.responses ?? 0],
                ["Personnes confirmées", stats?.confirmed_people ?? 0],
                ["Accompagnants", stats?.companions ?? 0],
                ["Refus", stats?.declined_responses ?? 0],
              ].map(([k, v]) => (
                <div key={k as string}>
                  <dt className="text-xs text-stone">{k}</dt>
                  <dd className="font-serif text-3xl tabular-nums">{v}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-4 text-xs text-stone">Personnes confirmées = réponses « oui » + leurs accompagnants.</p>
          </section>
          <section className="card p-5">
            <h2 className="font-serif text-2xl">Configuration</h2>
            {rsvpForm ? (
              <dl className="mt-4 grid grid-cols-[10rem_1fr] gap-y-2 text-sm">
                <dt className="text-stone">Formulaire</dt><dd>{rsvpForm.is_open ? "Ouvert" : "Fermé"}</dd>
                <dt className="text-stone">Date limite</dt><dd>{formatShortDate(rsvpForm.deadline)}</dd>
                <dt className="text-stone">Mode</dt><dd>{rsvpForm.mode === "code" ? "Invitations nominatives (code)" : "Réponse libre"}</dd>
                <dt className="text-stone">Accompagnants max.</dt><dd>{rsvpForm.max_companions}</dd>
              </dl>
            ) : (
              <p className="mt-3 text-sm text-stone">Aucun formulaire configuré.</p>
            )}
          </section>
          <div className="lg:col-span-2">
            <SoonPanel phase="phase 5">
              Enregistrement réel des réponses depuis l&apos;invitation publiée, choix des champs (menus, allergies, questions
              personnalisées), liste détaillée, corrections tracées et exports CSV / Excel. Le stockage et les statistiques
              ci-dessus sont déjà en place côté base de données.
            </SoonPanel>
          </div>
        </div>
      ) : null}

      {tab === "publication" ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <section className="card p-5">
            <h2 className="font-serif text-2xl">Adresse de l&apos;invitation</h2>
            <p className="mt-2 text-sm text-stone">Proposée automatiquement à partir des prénoms. Vous pouvez la personnaliser avant la publication.</p>
            <form action={updateSlug} className="mt-4">
              <input type="hidden" name="id" value={inv.id} />
              <SlugField invitationId={inv.id} initial={inv.slug} host={host} disabled={Boolean(inv.published_version_id)} />
            </form>
          </section>
          <section className="card p-5">
            <h2 className="font-serif text-2xl">Statut</h2>
            {status === "published" ? (
              <p className="mt-3 text-sm">Publiée le {formatDateTime(inv.published_at)}.</p>
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
            <h3 className="mt-6 text-sm font-medium">Accès du couple</h3>
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
            <h3 className="mt-6 text-sm font-medium">Historique des publications</h3>
            {versions?.length ? (
              <ul className="mt-2 space-y-1 text-sm">
                {versions.map((v) => (
                  <li key={v.version}>Version {v.version} — {formatDateTime(v.published_at)}{v.note ? ` · ${v.note}` : ""}</li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-stone">Jamais publiée.</p>
            )}
          </section>
          <div className="lg:col-span-2">
            <SoonPanel phase="phase 4">
              Boutons Prévisualiser (lien privé temporaire), Publier, Copier le lien et Dépublier ; page publique
              {` ${host}/${inv.slug}`} ; redirection automatique si l&apos;adresse change après publication ; option noindex et code
              d&apos;accès. La base de données et ses règles de sécurité pour ces fonctions sont déjà en place et testées.
            </SoonPanel>
          </div>
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
