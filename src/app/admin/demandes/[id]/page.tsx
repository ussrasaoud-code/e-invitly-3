import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/admin/PageHeader";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { requireStaff } from "@/lib/auth";
import { REQUEST_STATUS, REQUEST_STATUSES, type RequestStatus } from "@/lib/status";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime, formatShortDate } from "@/lib/time";
import { CEREMONY_LABELS, type RequestData } from "@/lib/validation/request";
import { convertRequestToInvitation, saveRequestNotes, setRequestArchived, updateRequestStatus } from "../actions";

export const metadata = { title: "Demande" };

const LANG: Record<string, string> = { fr: "Français", en: "Anglais", ar: "Arabe" };

function Block({ title, rows }: { title: string; rows: Array<[string, string | null | undefined]> }) {
  const filled = rows.filter(([, v]) => v && String(v).trim());
  return (
    <section className="card p-5">
      <h2 className="font-serif text-xl">{title}</h2>
      {filled.length ? (
        <dl className="mt-3 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[11rem_1fr]">
          {filled.map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="text-stone">{k}</dt>
              <dd className="whitespace-pre-line break-words">{v}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="mt-2 text-sm text-stone">Non renseigné.</p>
      )}
    </section>
  );
}

export default async function RequestDetail({ params }: { params: Promise<{ id: string }> }) {
  await requireStaff();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const supabase = (await createClient())!;
  const { data: r } = await supabase.from("client_requests").select("*, templates(name, slug)").eq("id", id).maybeSingle();
  if (!r) notFound();

  const f = (r.form_data ?? {}) as Partial<RequestData>;
  const tpl = r.templates as unknown as { name: string; slug: string } | null;
  const status = r.status as RequestStatus;
  const subject = encodeURIComponent(`Votre invitation E-Invitly — ${r.reference}`);
  const askBody = encodeURIComponent(
    `Bonjour ${r.contact_first_name},\n\nMerci pour votre demande ${r.reference}. Pour préparer votre invitation, pourriez-vous nous préciser :\n\n- \n\nBelle journée,\nL'équipe E-Invitly`,
  );

  return (
    <>
      <PageHeader
        eyebrow={<Link href="/admin/demandes" className="hover:text-forest">← Demandes</Link>}
        title={`${r.partner_one ?? "?"} & ${r.partner_two ?? "?"}`}
        description={
          <>
            Demande <strong className="font-medium text-charcoal">{r.reference}</strong> reçue le {formatDateTime(r.submitted_at)} ·
            modèle {tpl?.name ?? "supprimé"}
            {r.archived_at ? " · archivée" : ""}
          </>
        }
        actions={<StatusBadge {...REQUEST_STATUS[status]} />}
      />

      <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
        <div className="space-y-5">
          <Block
            title="Coordonnées"
            rows={[
              ["Contact", `${r.contact_first_name} ${r.contact_last_name}`],
              ["E-mail", r.email],
              ["Téléphone", r.phone],
              ["Pays", r.country],
              ["Langue de l'invitation", LANG[r.language] ?? r.language],
            ]}
          />
          <Block
            title="Le couple"
            rows={[
              ["Prénoms", `${r.partner_one} & ${r.partner_two}`],
              ["Date", formatShortDate(r.event_date)],
              ["Texte d'introduction", f.introText],
            ]}
          />
          <section className="card p-5">
            <h2 className="font-serif text-xl">Cérémonies</h2>
            {f.ceremonies?.length ? (
              <ul className="mt-3 space-y-4 text-sm">
                {f.ceremonies.map((c, i) => (
                  <li key={i} className="border-l-2 border-sage pl-4">
                    <p className="font-medium">
                      {c.label || CEREMONY_LABELS[c.type]}{" "}
                      {!c.showOnInvitation ? <span className="text-xs font-normal text-warning">(ne pas afficher sur l&apos;invitation)</span> : null}
                    </p>
                    <p className="text-stone">{[c.venueName, c.address].filter(Boolean).join(" — ") || "Lieu non précisé"}</p>
                    <p className="text-stone">
                      {c.arrivalTime ? `Arrivée ${c.arrivalTime}` : ""}
                      {c.arrivalTime && c.startTime ? " · " : ""}
                      {c.startTime ? `Début ${c.startTime}` : ""}
                    </p>
                    {c.notes ? <p className="mt-1 whitespace-pre-line">{c.notes}</p> : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-stone">Aucune cérémonie indiquée.</p>
            )}
          </section>
          <Block
            title="Réception"
            rows={[
              ["Lieu", f.reception?.venueName],
              ["Adresse", f.reception?.address],
              ["Arrivée des invités", f.reception?.arrivalTime],
              ["Cocktail", f.reception?.cocktailTime],
              ["Dîner", f.reception?.dinnerTime],
              ["Autres horaires", f.reception?.otherTimes],
              ["Lien carte", f.reception?.mapsUrl],
              ["Stationnement", f.reception?.parking],
              ["Navettes / transports", f.reception?.shuttles],
              ["Hébergements", f.reception?.lodging],
            ]}
          />
          <Block
            title="Autres informations"
            rows={[
              ["Dress code", f.details?.dressCode],
              ["Date limite RSVP", f.details?.rsvpDeadline ? formatShortDate(f.details.rsvpDeadline) : ""],
              ["Programme", f.details?.program],
              ["Témoins", f.details?.witnesses],
              ["Téléphones", f.details?.phoneNumbers],
              ["Texte personnalisé", f.details?.customText],
              ["Préférences", f.details?.preferences],
              ["Photos", f.details?.photos],
              ["Musique", f.details?.music],
              ["Commentaires", f.details?.comments],
            ]}
          />
          <p className="text-xs text-stone">Consentement donné le {formatDateTime(r.consent_at)}.</p>
        </div>

        <aside className="space-y-5">
          <section className="card p-5">
            <h2 className="font-serif text-xl">Invitation</h2>
            {r.invitation_id ? (
              <Link href={`/admin/invitations/${r.invitation_id}`} className="btn btn-primary mt-4 w-full">
                Ouvrir l&apos;invitation
              </Link>
            ) : (
              <form action={convertRequestToInvitation} className="mt-3">
                <input type="hidden" name="id" value={r.id} />
                <p className="text-sm text-stone">
                  Crée un brouillon à partir de toutes ces réponses et du modèle {tpl?.name}. Rien n&apos;est publié.
                </p>
                <SubmitButton className="btn btn-primary mt-4 w-full" pendingLabel="Création…">
                  Transformer en invitation
                </SubmitButton>
              </form>
            )}
          </section>

          <section className="card p-5">
            <h2 className="font-serif text-xl">Statut</h2>
            <form action={updateRequestStatus} className="mt-3 flex gap-2">
              <input type="hidden" name="id" value={r.id} />
              <label htmlFor="status" className="sr-only">Statut</label>
              <select id="status" name="status" defaultValue={status} className="field min-h-10 text-sm">
                {REQUEST_STATUSES.map((s) => (
                  <option key={s} value={s}>{REQUEST_STATUS[s].label}</option>
                ))}
              </select>
              <SubmitButton className="btn btn-secondary btn-sm">OK</SubmitButton>
            </form>
          </section>

          <section className="card p-5">
            <h2 className="font-serif text-xl">Contacter le client</h2>
            <div className="mt-3 grid gap-2">
              <a href={`mailto:${r.email}?subject=${subject}`} className="btn btn-secondary btn-sm">Écrire un e-mail</a>
              <a href={`mailto:${r.email}?subject=${subject}&body=${askBody}`} className="btn btn-secondary btn-sm">Demander des informations</a>
              {r.phone ? <a href={`tel:${r.phone.replace(/\s/g, "")}`} className="btn btn-ghost btn-sm">Appeler {r.phone}</a> : null}
              {status !== "missing_info" ? (
                <form action={updateRequestStatus}>
                  <input type="hidden" name="id" value={r.id} />
                  <input type="hidden" name="status" value="missing_info" />
                  <SubmitButton className="btn btn-ghost btn-sm w-full">Marquer « informations manquantes »</SubmitButton>
                </form>
              ) : null}
            </div>
            <p className="mt-2 text-xs text-stone">Les e-mails s&apos;ouvrent dans votre messagerie habituelle.</p>
          </section>

          <section className="card p-5">
            <h2 className="font-serif text-xl">Notes internes</h2>
            <form action={saveRequestNotes} className="mt-3">
              <input type="hidden" name="id" value={r.id} />
              <label htmlFor="notes" className="sr-only">Notes internes</label>
              <textarea id="notes" name="notes" defaultValue={r.internal_notes} rows={6} className="field text-sm" placeholder="Visible uniquement dans l'administration." />
              <SubmitButton className="btn btn-secondary btn-sm mt-2">Enregistrer les notes</SubmitButton>
            </form>
          </section>

          <form action={setRequestArchived}>
            <input type="hidden" name="id" value={r.id} />
            <input type="hidden" name="archive" value={r.archived_at ? "0" : "1"} />
            <SubmitButton className="btn btn-ghost btn-sm w-full">{r.archived_at ? "Restaurer la demande" : "Archiver la demande"}</SubmitButton>
          </form>
        </aside>
      </div>
    </>
  );
}
