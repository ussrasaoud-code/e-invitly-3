"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { SelectField, TextArea, TextField } from "@/components/ui/Field";
import {
  CEREMONY_LABELS,
  CEREMONY_TYPES,
  COUNTRIES,
  STEP_SCHEMAS,
  STEP_TITLES,
  flattenErrors,
  type CeremonyInput,
  type RequestInput,
} from "@/lib/validation/request";
import { submitRequest } from "../actions";

type FormState = Omit<RequestInput, "consent"> & { consent: boolean };

const emptyCeremony = (type: CeremonyInput["type"] = "civil"): CeremonyInput => ({
  type,
  label: "",
  showOnInvitation: true,
  venueName: "",
  address: "",
  arrivalTime: "",
  startTime: "",
  notes: "",
});

const initialState = (templateSlug: string): FormState => ({
  templateSlug,
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  country: "France",
  language: "fr",
  partnerOne: "",
  partnerTwo: "",
  eventDate: "",
  introText: "",
  ceremonies: [],
  reception: {
    venueName: "",
    address: "",
    arrivalTime: "",
    cocktailTime: "",
    dinnerTime: "",
    otherTimes: "",
    mapsUrl: "",
    parking: "",
    shuttles: "",
    lodging: "",
  },
  details: {
    dressCode: "",
    rsvpDeadline: "",
    program: "",
    witnesses: "",
    phoneNumbers: "",
    customText: "",
    preferences: "",
    photos: "",
    music: "",
    comments: "",
  },
  consent: false,
  website: "",
});

const LANG_OPTIONS = [
  { value: "fr", label: "Français" },
  { value: "en", label: "Anglais" },
  { value: "ar", label: "Arabe" },
];

export function RequestForm({ templateSlug, templateName }: { templateSlug: string; templateName: string }) {
  const storageKey = `e-invitly:demande:${templateSlug}`;
  const [state, setState] = useState<FormState>(() => initialState(templateSlug));
  const [step, setStep] = useState(0);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverMessage, setServerMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const restored = useRef(false);

  // Brouillon local (confort uniquement : rien n'est envoyé avant validation)
  useEffect(() => {
    if (restored.current) return;
    restored.current = true;
    try {
      const saved = window.localStorage.getItem(storageKey);
      if (saved) setState({ ...initialState(templateSlug), ...JSON.parse(saved), consent: false, website: "" });
    } catch {
      /* stockage indisponible */
    }
  }, [storageKey, templateSlug]);
  useEffect(() => {
    try {
      const { consent: _c, website: _w, ...rest } = state;
      void _c; void _w;
      window.localStorage.setItem(storageKey, JSON.stringify(rest));
    } catch {
      /* stockage indisponible */
    }
  }, [state, storageKey]);

  useEffect(() => {
    headingRef.current?.focus();
  }, [step]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setState((s) => ({ ...s, [key]: value }));
  const setReception = (key: keyof FormState["reception"], value: string) =>
    setState((s) => ({ ...s, reception: { ...s.reception, [key]: value } }));
  const setDetails = (key: keyof FormState["details"], value: string) =>
    setState((s) => ({ ...s, details: { ...s.details, [key]: value } }));
  const setCeremony = (i: number, patch: Partial<CeremonyInput>) =>
    setState((s) => ({ ...s, ceremonies: (s.ceremonies ?? []).map((c, j) => (j === i ? { ...c, ...patch } : c)) }));

  const validateStep = (index: number) => {
    const result = STEP_SCHEMAS[index].safeParse(state);
    if (result.success) {
      setErrors({});
      return true;
    }
    setErrors(flattenErrors(result.error));
    return false;
  };

  const next = () => {
    if (!validateStep(step)) return;
    setStep((s) => Math.min(s + 1, STEP_TITLES.length - 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const back = () => {
    setErrors({});
    setStep((s) => Math.max(s - 1, 0));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const submit = () => {
    for (let i = 0; i < STEP_SCHEMAS.length; i++) {
      if (!validateStep(i)) {
        setStep(i);
        return;
      }
    }
    setServerMessage(null);
    startTransition(async () => {
      const res = await submitRequest(state as RequestInput);
      if (res.ok) {
        try {
          window.localStorage.removeItem(storageKey);
        } catch {}
        router.push(`/personnalisation/merci?ref=${encodeURIComponent(res.reference)}&email=${res.emailSent ? "1" : "0"}`);
      } else {
        setServerMessage(res.message);
        if (res.fieldErrors) setErrors(res.fieldErrors);
      }
    });
  };

  const e = (key: string) => errors[key];
  const ceremonies = state.ceremonies ?? [];

  return (
    <div>
      {/* Progression */}
      <ol className="mb-10 grid grid-cols-6 gap-1.5" aria-label="Étapes du formulaire">
        {STEP_TITLES.map((title, i) => (
          <li key={title} aria-current={i === step ? "step" : undefined}>
            <span className={`block h-1 ${i <= step ? "bg-forest" : "bg-sand"}`} />
            <span className={`mt-2 hidden text-[0.68rem] uppercase tracking-[0.12em] md:block ${i === step ? "text-forest" : "text-stone"}`}>
              {title}
            </span>
          </li>
        ))}
      </ol>
      <p className="text-sm text-stone">
        Étape {step + 1} sur {STEP_TITLES.length}
      </p>
      <h2 ref={headingRef} tabIndex={-1} className="mt-1 font-serif text-3xl outline-none md:text-4xl">
        {STEP_TITLES[step]}
      </h2>

      <form
        className="mt-8"
        noValidate
        onSubmit={(ev) => {
          ev.preventDefault();
          if (step < STEP_TITLES.length - 1) next();
          else submit();
        }}
      >
        {/* Champ piège pour robots, invisible pour les humains et les lecteurs d'écran */}
        <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
          <label>
            Ne pas remplir
            <input tabIndex={-1} autoComplete="off" value={state.website ?? ""} onChange={(ev) => set("website", ev.target.value)} />
          </label>
        </div>

        {step === 0 && (
          <div className="grid gap-5 sm:grid-cols-2">
            <TextField label="Prénom" autoComplete="given-name" value={state.firstName} onChange={(ev) => set("firstName", ev.target.value)} error={e("firstName")} required />
            <TextField label="Nom" autoComplete="family-name" value={state.lastName} onChange={(ev) => set("lastName", ev.target.value)} error={e("lastName")} required />
            <TextField label="Adresse e-mail" type="email" autoComplete="email" inputMode="email" value={state.email} onChange={(ev) => set("email", ev.target.value)} error={e("email")} required className="sm:col-span-2" hint="Nous l'utiliserons pour vous envoyer l'aperçu et votre accès aux réponses." />
            <TextField label="Téléphone" type="tel" autoComplete="tel" value={state.phone} onChange={(ev) => set("phone", ev.target.value)} error={e("phone")} optional />
            <SelectField label="Pays" value={state.country} onChange={(ev) => set("country", ev.target.value)} error={e("country")} options={COUNTRIES.map((c) => ({ value: c, label: c }))} />
            <SelectField label="Langue de l'invitation" value={state.language} onChange={(ev) => set("language", ev.target.value as FormState["language"])} error={e("language")} options={LANG_OPTIONS} className="sm:col-span-2" />
          </div>
        )}

        {step === 1 && (
          <div className="grid gap-5 sm:grid-cols-2">
            <TextField label="Prénom de la première personne" value={state.partnerOne} onChange={(ev) => set("partnerOne", ev.target.value)} error={e("partnerOne")} required />
            <TextField label="Prénom de la seconde personne" value={state.partnerTwo} onChange={(ev) => set("partnerTwo", ev.target.value)} error={e("partnerTwo")} required />
            <TextField label="Date de l'événement" type="date" value={state.eventDate} onChange={(ev) => set("eventDate", ev.target.value)} error={e("eventDate")} required className="sm:col-span-2" />
            <TextArea label="Texte d'introduction souhaité" value={state.introText} onChange={(ev) => set("introText", ev.target.value)} error={e("introText")} optional className="sm:col-span-2" hint="Par exemple : « Ensemble, avec leurs familles, ont la joie de vous convier… » Laissez vide pour que nous vous proposions un texte." />
          </div>
        )}

        {step === 2 && (
          <div>
            <p className="mb-6 leading-relaxed text-stone">
              Ajoutez les cérémonies de votre mariage. Vous choisissez celles qui apparaîtront sur l&apos;invitation : une
              cérémonie civile peut, par exemple, rester privée.
            </p>
            {ceremonies.length === 0 ? (
              <p className="card p-5 text-sm text-stone">Aucune cérémonie ajoutée pour l&apos;instant. Cette étape est facultative.</p>
            ) : null}
            <div className="space-y-6">
              {ceremonies.map((c, i) => (
                <fieldset key={i} className="card p-5">
                  <legend className="px-1 font-serif text-xl">{CEREMONY_LABELS[c.type]}</legend>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <SelectField label="Type" value={c.type} onChange={(ev) => setCeremony(i, { type: ev.target.value as CeremonyInput["type"] })} options={CEREMONY_TYPES.map((t) => ({ value: t, label: CEREMONY_LABELS[t] }))} />
                    <TextField label="Intitulé personnalisé" value={c.label} onChange={(ev) => setCeremony(i, { label: ev.target.value })} optional placeholder="ex. Bénédiction" />
                    <TextField label="Lieu" value={c.venueName} onChange={(ev) => setCeremony(i, { venueName: ev.target.value })} optional />
                    <TextField label="Adresse" value={c.address} onChange={(ev) => setCeremony(i, { address: ev.target.value })} optional />
                    <TextField label="Arrivée des invités" type="time" value={c.arrivalTime} onChange={(ev) => setCeremony(i, { arrivalTime: ev.target.value })} error={e(`ceremonies.${i}.arrivalTime`)} optional />
                    <TextField label="Début de la cérémonie" type="time" value={c.startTime} onChange={(ev) => setCeremony(i, { startTime: ev.target.value })} error={e(`ceremonies.${i}.startTime`)} optional />
                    <TextArea label="Informations complémentaires" value={c.notes} onChange={(ev) => setCeremony(i, { notes: ev.target.value })} optional className="sm:col-span-2" />
                    <label className="flex min-h-11 items-center gap-3 text-sm sm:col-span-2">
                      <input type="checkbox" className="h-5 w-5 accent-forest" checked={c.showOnInvitation} onChange={(ev) => setCeremony(i, { showOnInvitation: ev.target.checked })} />
                      Afficher cette cérémonie sur l&apos;invitation
                    </label>
                  </div>
                  <button type="button" className="btn btn-ghost btn-sm mt-3 text-danger" onClick={() => set("ceremonies", ceremonies.filter((_, j) => j !== i))}>
                    Retirer cette cérémonie
                  </button>
                </fieldset>
              ))}
            </div>
            {ceremonies.length < 6 ? (
              <div className="mt-6 flex flex-wrap gap-2">
                {CEREMONY_TYPES.map((t) => (
                  <button key={t} type="button" className="btn btn-secondary btn-sm" onClick={() => set("ceremonies", [...ceremonies, emptyCeremony(t)])}>
                    + {CEREMONY_LABELS[t]}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        )}

        {step === 3 && (
          <div className="grid gap-5 sm:grid-cols-2">
            <TextField label="Nom du lieu de réception" value={state.reception?.venueName} onChange={(ev) => setReception("venueName", ev.target.value)} optional />
            <TextField label="Adresse complète" autoComplete="street-address" value={state.reception?.address} onChange={(ev) => setReception("address", ev.target.value)} optional />
            <TextField label="Arrivée des invités" type="time" value={state.reception?.arrivalTime} onChange={(ev) => setReception("arrivalTime", ev.target.value)} error={e("reception.arrivalTime")} optional />
            <TextField label="Cocktail" type="time" value={state.reception?.cocktailTime} onChange={(ev) => setReception("cocktailTime", ev.target.value)} error={e("reception.cocktailTime")} optional />
            <TextField label="Dîner" type="time" value={state.reception?.dinnerTime} onChange={(ev) => setReception("dinnerTime", ev.target.value)} error={e("reception.dinnerTime")} optional />
            <TextField label="Lien Google Maps" type="url" inputMode="url" value={state.reception?.mapsUrl} onChange={(ev) => setReception("mapsUrl", ev.target.value)} error={e("reception.mapsUrl")} optional />
            <TextArea label="Autres horaires" value={state.reception?.otherTimes} onChange={(ev) => setReception("otherTimes", ev.target.value)} optional className="sm:col-span-2" placeholder="ex. Soirée dansante à 23h, brunch le lendemain à 11h" />
            <TextArea label="Stationnement" value={state.reception?.parking} onChange={(ev) => setReception("parking", ev.target.value)} optional />
            <TextArea label="Navettes ou transports" value={state.reception?.shuttles} onChange={(ev) => setReception("shuttles", ev.target.value)} optional />
            <TextArea label="Hébergements conseillés" value={state.reception?.lodging} onChange={(ev) => setReception("lodging", ev.target.value)} optional className="sm:col-span-2" />
          </div>
        )}

        {step === 4 && (
          <div className="grid gap-5 sm:grid-cols-2">
            <TextArea label="Dress code" value={state.details?.dressCode} onChange={(ev) => setDetails("dressCode", ev.target.value)} optional />
            <TextField label="Date limite de réponse (RSVP)" type="date" value={state.details?.rsvpDeadline} onChange={(ev) => setDetails("rsvpDeadline", ev.target.value)} error={e("details.rsvpDeadline")} optional />
            <TextArea label="Programme du mariage" value={state.details?.program} onChange={(ev) => setDetails("program", ev.target.value)} optional className="sm:col-span-2" />
            <TextArea label="Contacts des témoins" value={state.details?.witnesses} onChange={(ev) => setDetails("witnesses", ev.target.value)} optional hint="Prénoms et rôle de chacun." />
            <TextArea label="Numéros de téléphone à afficher" value={state.details?.phoneNumbers} onChange={(ev) => setDetails("phoneNumbers", ev.target.value)} optional />
            <TextArea label="Texte personnalisé" value={state.details?.customText} onChange={(ev) => setDetails("customText", ev.target.value)} optional className="sm:col-span-2" />
            <TextArea label="Préférences particulières" value={state.details?.preferences} onChange={(ev) => setDetails("preferences", ev.target.value)} optional hint="Couleurs, ambiance, éléments à éviter…" />
            <TextArea label="Photos à intégrer" value={state.details?.photos} onChange={(ev) => setDetails("photos", ev.target.value)} optional hint="Décrivez-les : nous vous indiquerons comment nous les transmettre après l'envoi." />
            <TextField label="Musique souhaitée" value={state.details?.music} onChange={(ev) => setDetails("music", ev.target.value)} optional />
            <TextArea label="Commentaires pour E-Invitly" value={state.details?.comments} onChange={(ev) => setDetails("comments", ev.target.value)} optional className="sm:col-span-2" />
          </div>
        )}

        {step === 5 && (
          <Review state={state} templateName={templateName} onEdit={(i) => setStep(i)} />
        )}

        {step === 5 && (
          <div className="mt-8">
            <label className="flex items-start gap-3 text-sm leading-relaxed">
              <input type="checkbox" className="mt-0.5 h-5 w-5 shrink-0 accent-forest" checked={state.consent} onChange={(ev) => set("consent", ev.target.checked)} aria-invalid={e("consent") ? true : undefined} />
              <span>
                J&apos;accepte que E-Invitly utilise ces informations pour préparer mon invitation et me recontacter à ce sujet.
                Elles ne sont ni vendues ni partagées. Voir la{" "}
                <a href="/confidentialite" target="_blank" className="text-forest underline underline-offset-4">politique de confidentialité</a>.
              </span>
            </label>
            {e("consent") ? <p className="field-error" role="alert">{e("consent")}</p> : null}
          </div>
        )}

        {serverMessage ? (
          <p role="alert" className="mt-6 border border-danger/30 bg-danger-soft px-4 py-3 text-sm text-danger">
            {serverMessage}
          </p>
        ) : null}
        {Object.keys(errors).length > 0 && !serverMessage ? (
          <p role="alert" className="mt-6 text-sm text-danger">Merci de corriger les champs signalés.</p>
        ) : null}

        <div className="mt-10 flex flex-col-reverse gap-3 border-t border-line pt-6 sm:flex-row sm:justify-between">
          {step > 0 ? (
            <button type="button" className="btn btn-ghost" onClick={back} disabled={pending}>
              ← Retour
            </button>
          ) : (
            <span />
          )}
          <button type="submit" className="btn btn-primary" disabled={pending}>
            {step < STEP_TITLES.length - 1 ? "Continuer" : pending ? "Envoi en cours…" : "Envoyer ma demande"}
          </button>
        </div>
        <p className="mt-4 text-center text-xs text-stone sm:text-right">
          Vos réponses sont gardées sur cet appareil jusqu&apos;à l&apos;envoi. Votre invitation ne sera publiée qu&apos;après votre validation.
        </p>
      </form>
    </div>
  );
}

function Review({ state, templateName, onEdit }: { state: FormState; templateName: string; onEdit: (step: number) => void }) {
  const lang = LANG_OPTIONS.find((l) => l.value === state.language)?.label;
  const rows: Array<{ step: number; title: string; items: Array<[string, string | undefined]> }> = [
    {
      step: 0,
      title: "Coordonnées",
      items: [
        ["Contact", `${state.firstName} ${state.lastName}`],
        ["E-mail", state.email],
        ["Téléphone", state.phone],
        ["Pays", state.country],
        ["Langue", lang],
        ["Modèle", templateName],
      ],
    },
    {
      step: 1,
      title: "Le couple",
      items: [
        ["Prénoms", `${state.partnerOne} & ${state.partnerTwo}`],
        ["Date", state.eventDate ? new Date(`${state.eventDate}T12:00`).toLocaleDateString("fr-FR", { dateStyle: "full" }) : ""],
        ["Introduction", state.introText],
      ],
    },
    {
      step: 2,
      title: "Cérémonies",
      items: (state.ceremonies ?? []).map((c) => [
        c.label || CEREMONY_LABELS[c.type],
        [c.venueName, c.address, c.startTime && `début ${c.startTime}`, c.showOnInvitation ? "" : "(non affichée)"].filter(Boolean).join(" · "),
      ]),
    },
    {
      step: 3,
      title: "Réception",
      items: [
        ["Lieu", [state.reception?.venueName, state.reception?.address].filter(Boolean).join(" — ")],
        ["Horaires", [state.reception?.arrivalTime && `arrivée ${state.reception.arrivalTime}`, state.reception?.cocktailTime && `cocktail ${state.reception.cocktailTime}`, state.reception?.dinnerTime && `dîner ${state.reception.dinnerTime}`].filter(Boolean).join(" · ")],
        ["Autres horaires", state.reception?.otherTimes],
        ["Stationnement", state.reception?.parking],
        ["Transports", state.reception?.shuttles],
        ["Hébergements", state.reception?.lodging],
      ],
    },
    {
      step: 4,
      title: "Autres informations",
      items: [
        ["Dress code", state.details?.dressCode],
        ["Date limite RSVP", state.details?.rsvpDeadline],
        ["Programme", state.details?.program],
        ["Témoins", state.details?.witnesses],
        ["Téléphones", state.details?.phoneNumbers],
        ["Texte personnalisé", state.details?.customText],
        ["Préférences", state.details?.preferences],
        ["Photos", state.details?.photos],
        ["Musique", state.details?.music],
        ["Commentaires", state.details?.comments],
      ],
    },
  ];
  return (
    <div className="space-y-6">
      {rows.map((r) => {
        const filled = r.items.filter(([, v]) => v && v.trim());
        return (
          <section key={r.title} className="card p-5">
            <div className="flex items-center justify-between gap-4">
              <h3 className="font-serif text-xl">{r.title}</h3>
              <button type="button" className="text-sm text-forest underline underline-offset-4" onClick={() => onEdit(r.step)}>
                Modifier
              </button>
            </div>
            {filled.length ? (
              <dl className="mt-3 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[10rem_1fr]">
                {filled.map(([k, v]) => (
                  <div key={k} className="contents">
                    <dt className="text-stone">{k}</dt>
                    <dd className="whitespace-pre-line break-words">{v}</dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p className="mt-2 text-sm text-stone">Non renseigné</p>
            )}
          </section>
        );
      })}
    </div>
  );
}
