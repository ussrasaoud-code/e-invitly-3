import Link from "next/link";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { CUSTOM_QUESTION_TYPES, RSVP_FIELD_KEYS, RSVP_FIELD_LABELS } from "@/lib/rsvp";
import type { RsvpOverview } from "@/lib/rsvp-data";
import { formatDateTime } from "@/lib/time";
import { addGuests, deleteGuest, deleteResponse, saveRsvpConfig, updateResponse } from "../rsvp-actions";

function Stat({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return (
    <div className="card p-4">
      <p className="font-serif text-3xl lining-nums tabular-nums leading-none">{value}</p>
      <p className="mt-2 text-xs leading-snug text-stone">{label}</p>
      {hint ? <p className="mt-1 text-[0.7rem] text-stone/80">{hint}</p> : null}
    </div>
  );
}

const dateInput = (iso: string | null, tz: string) => {
  if (!iso) return "";
  const p = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso));
  return p;
};

export function RsvpTab({
  invitationId,
  overview: o,
  timezone,
  q,
  presence,
  isLive,
}: {
  invitationId: string;
  overview: RsvpOverview;
  timezone: string;
  q: string;
  presence: string;
  isLive: boolean;
}) {
  const form = o.form;
  const term = q.trim().toLowerCase();
  const list = o.responses.filter(
    (r) =>
      (presence === "oui" ? r.attending : presence === "non" ? !r.attending : true) &&
      (!term || `${r.first_name} ${r.last_name} ${r.companions.join(" ")}`.toLowerCase().includes(term)),
  );
  const respondedGuests = new Set(o.responses.map((r) => r.guest_id).filter(Boolean));
  const questionLabel = new Map((form?.questions ?? []).map((x) => [x.id, x.label]));
  const filterHref = (p: string) => {
    const s = new URLSearchParams({ onglet: "rsvp" });
    if (p) s.set("presence", p);
    if (term) s.set("q", q);
    return `/admin/invitations/${invitationId}?${s}`;
  };
  const slots = [...(form?.questions ?? []), ...Array.from({ length: 5 }, () => null)].slice(0, 5);

  return (
    <div className="space-y-8">
      {!isLive ? (
        <p className="border border-line bg-paper px-4 py-3 text-sm text-stone">
          L&apos;invitation n&apos;est pas publiée : les invités ne peuvent pas encore répondre. Les réglages ci-dessous seront appliqués dès la publication.
        </p>
      ) : form && !form.is_open ? (
        <p className="border border-warning/40 bg-[#f6eddf] px-4 py-3 text-sm text-warning">Les réponses sont fermées : le formulaire affiche un message aux invités.</p>
      ) : null}

      <section aria-label="Statistiques">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          <Stat label="Personnes confirmées" value={o.stats.people} hint="réponses « oui » + accompagnants" />
          <Stat label="Formulaires reçus" value={o.stats.responses} />
          <Stat label="Réponses « oui »" value={o.stats.attending} />
          <Stat label="Accompagnants" value={o.stats.companions} />
          <Stat label="Refus" value={o.stats.declined} />
          {form?.fields.childMenus ? <Stat label="Menus enfant" value={o.stats.childMenus} hint={`menus adulte : ${o.stats.people - o.stats.childMenus}`} /> : <Stat label="Régimes signalés" value={o.stats.withDietary} />}
        </div>
        {o.events.length > 1 ? (
          <div className="card mt-3 p-4">
            <p className="text-xs uppercase tracking-wider text-stone">Personnes par moment</p>
            <ul className="mt-2 flex flex-wrap gap-x-8 gap-y-2 text-sm">
              {o.events.map((e) => (
                <li key={e.id}>
                  {e.title} : <strong className="font-medium lining-nums tabular-nums">{o.byEvent[e.id] ?? 0}</strong>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>

      <section className="card p-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h2 className="font-serif text-2xl">Réponses</h2>
          <form action={`/api/exports/${invitationId}`} method="get" className="flex flex-wrap items-center gap-3 text-sm">
            <select name="format" defaultValue="xlsx" className="field min-h-9 w-auto py-1 text-sm" aria-label="Format">
              <option value="xlsx">Excel (.xlsx)</option>
              <option value="csv">CSV</option>
            </select>
            <label className="flex items-center gap-1.5">
              <input type="checkbox" name="regimes" value="1" className="h-4 w-4 accent-forest" />
              Inclure régimes / allergies
            </label>
            <button type="submit" className="btn btn-secondary btn-sm">Télécharger</button>
          </form>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          {[
            ["", "Toutes"],
            ["oui", "Présents"],
            ["non", "Absents"],
          ].map(([v, l]) => (
            <Link key={v} href={filterHref(v)} className={`rounded-full border px-3 py-1.5 text-xs ${presence === v ? "border-forest bg-forest text-ivory" : "border-line bg-white hover:border-forest"}`}>
              {l}
            </Link>
          ))}
          <form method="get" className="ml-auto flex gap-2" role="search">
            <input type="hidden" name="onglet" value="rsvp" />
            {presence ? <input type="hidden" name="presence" value={presence} /> : null}
            <label htmlFor="rsvp-q" className="sr-only">Rechercher un invité</label>
            <input id="rsvp-q" name="q" defaultValue={q} placeholder="Rechercher un invité…" className="field min-h-9 w-56 py-1 text-sm" />
          </form>
        </div>

        {list.length ? (
          <ul className="mt-4 divide-y divide-line">
            {list.map((r) => (
              <li key={r.id} className="py-3">
                <details className="group">
                  <summary className="flex cursor-pointer list-none flex-wrap items-start justify-between gap-3 [&::-webkit-details-marker]:hidden">
                    <div className="min-w-0">
                      <p className="font-medium">
                        {r.first_name} {r.last_name}
                        <span className={`ml-2 badge border-transparent ${r.attending ? "bg-[#e5eee4] text-success" : "bg-danger-soft text-danger"}`}>
                          {r.attending ? `Présent·e · ${1 + r.companions_count} pers.` : "Absent·e"}
                        </span>
                        {o.editedIds.has(r.id) ? <span className="ml-2 text-xs text-stone">· corrigée</span> : null}
                      </p>
                      <p className="mt-0.5 text-sm text-stone">
                        {[
                          r.companions.length ? `Avec ${r.companions.join(", ")}` : null,
                          r.attending && o.events.length > 1 && r.events.length
                            ? o.events.filter((e) => r.events.includes(e.id)).map((e) => e.title).join(", ")
                            : null,
                          r.child_menus ? `${r.child_menus} menu(s) enfant` : null,
                          r.dietary ? `Régime : ${r.dietary}` : null,
                          ...Object.entries(r.answers).map(([k, v]) => `${questionLabel.get(k) ?? k} : ${v}`),
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                      {r.comment ? <p className="mt-1 text-sm italic">« {r.comment} »</p> : null}
                    </div>
                    <span className="shrink-0 text-xs text-stone">
                      {formatDateTime(r.submitted_at)} <span className="ml-1 text-forest group-open:hidden">Modifier ›</span>
                    </span>
                  </summary>
                  <form action={updateResponse} className="mt-4 grid gap-3 rounded-sm border border-line bg-paper p-4 text-sm sm:grid-cols-3">
                    <input type="hidden" name="id" value={invitationId} />
                    <input type="hidden" name="responseId" value={r.id} />
                    <label>
                      <span className="field-label !text-xs">Prénom</span>
                      <input name="first_name" defaultValue={r.first_name} required className="field min-h-9 py-1 text-sm" />
                    </label>
                    <label>
                      <span className="field-label !text-xs">Nom</span>
                      <input name="last_name" defaultValue={r.last_name} className="field min-h-9 py-1 text-sm" />
                    </label>
                    <label>
                      <span className="field-label !text-xs">Présence</span>
                      <select name="attending" defaultValue={r.attending ? "yes" : "no"} className="field min-h-9 py-1 text-sm">
                        <option value="yes">Présent·e</option>
                        <option value="no">Absent·e</option>
                      </select>
                    </label>
                    <label>
                      <span className="field-label !text-xs">Accompagnants</span>
                      <input name="companions_count" type="number" min={0} max={20} defaultValue={r.companions_count} className="field min-h-9 py-1 text-sm" />
                    </label>
                    <label className="sm:col-span-2">
                      <span className="field-label !text-xs">Prénoms des accompagnants (séparés par des virgules)</span>
                      <input name="companions" defaultValue={r.companions.join(", ")} className="field min-h-9 py-1 text-sm" />
                    </label>
                    {o.events.length > 1 ? (
                      <fieldset className="sm:col-span-3">
                        <legend className="field-label !text-xs">Moments</legend>
                        <div className="flex flex-wrap gap-4">
                          {o.events.map((e) => (
                            <label key={e.id} className="flex items-center gap-1.5">
                              <input type="checkbox" name="events" value={e.id} defaultChecked={r.events.includes(e.id)} className="h-4 w-4 accent-forest" />
                              {e.title}
                            </label>
                          ))}
                        </div>
                      </fieldset>
                    ) : (
                      r.events.map((e) => <input key={e} type="hidden" name="events" value={e} />)
                    )}
                    <label>
                      <span className="field-label !text-xs">Menus enfant</span>
                      <input name="child_menus" type="number" min={0} max={21} defaultValue={r.child_menus} className="field min-h-9 py-1 text-sm" />
                    </label>
                    <label className="sm:col-span-2">
                      <span className="field-label !text-xs">Régime / allergies</span>
                      <input name="dietary" defaultValue={r.dietary ?? ""} className="field min-h-9 py-1 text-sm" />
                    </label>
                    <label className="sm:col-span-3">
                      <span className="field-label !text-xs">Message</span>
                      <textarea name="comment" defaultValue={r.comment ?? ""} rows={2} className="field text-sm" />
                    </label>
                    <div className="flex flex-wrap items-center gap-2 sm:col-span-3">
                      <SubmitButton className="btn btn-primary btn-sm" pendingLabel="Enregistrement…">Enregistrer la correction</SubmitButton>
                      <span className="text-xs text-stone">La version précédente est conservée dans l&apos;historique.</span>
                    </div>
                  </form>
                  <form action={deleteResponse} className="mt-2">
                    <input type="hidden" name="id" value={invitationId} />
                    <input type="hidden" name="responseId" value={r.id} />
                    <SubmitButton className="btn btn-ghost btn-sm text-danger" confirm={`Supprimer la réponse de ${r.first_name} ${r.last_name} ?`}>Supprimer cette réponse</SubmitButton>
                  </form>
                </details>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-6 text-sm text-stone">{o.responses.length ? "Aucune réponse ne correspond." : "Aucune réponse pour le moment."}</p>
        )}
      </section>

      <section className="card p-5">
        <h2 className="font-serif text-2xl">Réglages du formulaire</h2>
        <form action={saveRsvpConfig} className="mt-4 space-y-6">
          <input type="hidden" name="id" value={invitationId} />
          <div className="grid gap-4 md:grid-cols-4">
            <label className="flex items-center gap-2 text-sm md:col-span-4">
              <input type="checkbox" name="is_open" defaultChecked={form?.is_open ?? true} className="h-4 w-4 accent-forest" />
              Réponses ouvertes
            </label>
            <label>
              <span className="field-label !text-xs">Date limite (incluse)</span>
              <input type="date" name="deadline" defaultValue={dateInput(form?.deadline ?? null, timezone)} className="field min-h-10 text-sm" />
            </label>
            <label>
              <span className="field-label !text-xs">Accompagnants maximum</span>
              <input type="number" name="max_companions" min={0} max={20} defaultValue={form?.max_companions ?? 1} className="field min-h-10 text-sm" />
            </label>
            <label className="md:col-span-2">
              <span className="field-label !text-xs">Qui peut répondre ?</span>
              <select name="mode" defaultValue={form?.mode ?? "open"} className="field min-h-10 text-sm">
                <option value="open">Toute personne ayant le lien</option>
                <option value="code">Seulement les invités nominatifs, avec leur code personnel</option>
              </select>
            </label>
          </div>
          <fieldset>
            <legend className="field-label">Champs demandés (prénom et présence le sont toujours)</legend>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {RSVP_FIELD_KEYS.map((k) => (
                <label key={k} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name={`field_${k}`} defaultChecked={form?.fields[k] ?? false} className="h-4 w-4 accent-forest" />
                  {RSVP_FIELD_LABELS[k]}
                </label>
              ))}
            </div>
            <p className="mt-2 text-xs text-stone">Ne demandez les allergies que si le traiteur en a besoin : ce sont des informations sensibles.</p>
          </fieldset>
          <fieldset>
            <legend className="field-label">Questions personnalisées (jusqu&apos;à 5 ; laissez vide pour retirer)</legend>
            <div className="space-y-2">
              {slots.map((s, i) => (
                <div key={i} className="grid gap-2 rounded-sm border border-line p-2 md:grid-cols-[2fr_1fr_2fr_auto] md:items-center">
                  <input type="hidden" name={`q_id_${i}`} defaultValue={s?.id ?? ""} />
                  <input name={`q_label_${i}`} defaultValue={s?.label ?? ""} placeholder="ex. Prendrez-vous la navette ?" aria-label={`Question ${i + 1}`} className="field min-h-9 py-1 text-sm" />
                  <select name={`q_type_${i}`} defaultValue={s?.type ?? "yesno"} aria-label="Type de réponse" className="field min-h-9 py-1 text-sm">
                    {Object.entries(CUSTOM_QUESTION_TYPES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                  <input name={`q_options_${i}`} defaultValue={s?.options.join(", ") ?? ""} placeholder="Choix séparés par des virgules (si « liste »)" aria-label="Choix" className="field min-h-9 py-1 text-sm" />
                  <label className="flex items-center gap-1.5 text-xs">
                    <input type="checkbox" name={`q_required_${i}`} defaultChecked={s?.required ?? false} className="h-4 w-4 accent-forest" />
                    Obligatoire
                  </label>
                </div>
              ))}
            </div>
          </fieldset>
          <SubmitButton pendingLabel="Enregistrement…">Enregistrer les réglages</SubmitButton>
        </form>
      </section>

      <section className="card p-5">
        <h2 className="font-serif text-2xl">Invités nominatifs</h2>
        <p className="mt-1 text-sm text-stone">
          {form?.mode === "code"
            ? "Mode actif : chaque invité répond avec son code personnel, et ne peut pas dépasser son nombre d'accompagnants. Une nouvelle réponse avec le même code remplace la précédente."
            : "Facultatif. Pour limiter les réponses aux personnes invitées, ajoutez-les ici puis choisissez « Seulement les invités nominatifs » dans les réglages."}
        </p>
        <form action={addGuests} className="mt-4 grid gap-2 md:grid-cols-[1fr_auto] md:items-end">
          <input type="hidden" name="id" value={invitationId} />
          <label>
            <span className="field-label !text-xs">Un invité par ligne : « Nom ; nombre d&apos;accompagnants autorisés »</span>
            <textarea name="guests" rows={3} className="field text-sm" placeholder={"Famille Martin ; 3\nLéa Dubois ; 1\nOncle Karim ; 0"} />
          </label>
          <SubmitButton className="btn btn-secondary btn-sm" pendingLabel="Ajout…">Ajouter</SubmitButton>
        </form>
        {o.guests.length ? (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead className="border-b border-line text-xs uppercase tracking-wider text-stone">
                <tr>
                  <th className="py-2 font-normal">Invité</th>
                  <th className="py-2 font-normal">Code</th>
                  <th className="py-2 font-normal">Accompagnants</th>
                  <th className="py-2 font-normal">Réponse</th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {o.guests.map((g) => (
                  <tr key={g.id}>
                    <td className="py-2">{g.display_name}</td>
                    <td className="py-2 font-mono tracking-widest">{g.code}</td>
                    <td className="py-2 lining-nums tabular-nums">{g.max_companions}</td>
                    <td className="py-2">{respondedGuests.has(g.id) ? "Reçue" : <span className="text-stone">En attente</span>}</td>
                    <td className="py-2 text-right">
                      <form action={deleteGuest}>
                        <input type="hidden" name="id" value={invitationId} />
                        <input type="hidden" name="guestId" value={g.id} />
                        <SubmitButton className="text-xs text-stone hover:text-danger" confirm={`Retirer ${g.display_name} ?`}>Retirer</SubmitButton>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>
    </div>
  );
}
