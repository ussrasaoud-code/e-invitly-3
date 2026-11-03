"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { OptionalLabelContext, SelectField, TextArea, TextField } from "@/components/ui/Field";
import { LANG_META, SITE_LANGS, fmt, localePath, type SiteLang } from "@/lib/i18n/config";
import type { SiteDict } from "@/lib/i18n/dict";
import {
  CEREMONY_TYPES,
  COUNTRIES,
  MAGHREB_STEP_SCHEMAS,
  MIXTE_STEP_SCHEMAS,
  STEP_SCHEMAS,
  hasMaghrebSteps,
  type Culture,
  type MaghrebInput,
  flattenErrors,
  translateError,
  type CeremonyInput,
  type RequestInput,
} from "@/lib/validation/request";
import { submitRequest } from "../actions";
import { DecorationFields, HennaStep, MomentsStep, SoireeStep, emptyMaghreb } from "./MaghrebSteps";

type T = SiteDict["request"];

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

const initialState = (templateSlug: string, language: SiteLang = "fr", culture: Culture = "europeen"): FormState => ({
  templateSlug,
  culture,
  ...(hasMaghrebSteps(culture) ? { maghreb: emptyMaghreb() } : {}),
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  country: "France",
  language,
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

/** Langues de l'invitation, chacune écrite dans sa propre langue */
const LANG_OPTIONS = SITE_LANGS.map((l) => ({ value: l, label: LANG_META[l].native }));

type StepKey = "contact" | "couple" | "ceremonies" | "reception" | "details" | "henna" | "soiree" | "moments" | "maghrebDetails" | "review";
const STEP_KEYS: Record<Culture, StepKey[]> = {
  europeen: ["contact", "couple", "ceremonies", "reception", "details", "review"],
  maghrebin: ["contact", "couple", "henna", "soiree", "moments", "maghrebDetails", "review"],
  mixte: ["contact", "couple", "ceremonies", "henna", "soiree", "moments", "maghrebDetails", "review"],
};
type Schema = { safeParse: (v: unknown) => { success: true } | { success: false; error: import("zod").ZodError } };
const SCHEMAS_BY: Record<Culture, ReadonlyArray<Schema>> = { europeen: STEP_SCHEMAS, maghrebin: MAGHREB_STEP_SCHEMAS, mixte: MIXTE_STEP_SCHEMAS };

export function RequestForm({ templateSlug, templateName, t, lang, invitationLang, cultures = ["europeen"] }: { templateSlug: string; templateName: string; t: T; lang: SiteLang; invitationLang: SiteLang; cultures?: Culture[] }) {
  const storageKey = `e-invitly:demande:${templateSlug}`;
  const single = cultures.length === 1;
  const [chosen, setChosen] = useState(single);
  const CEREMONY_LABELS = t.ceremonies;
  const f = t.f;
  const [state, setState] = useState<FormState>(() => initialState(templateSlug, invitationLang, cultures[0]));
  const culture: Culture = cultures.includes(state.culture as Culture) ? (state.culture as Culture) : cultures[0];
  const mag = hasMaghrebSteps(culture);
  const KEYS = STEP_KEYS[culture];
  const STEP_TITLES = culture === "mixte" ? t.wtype.mixSteps : culture === "maghrebin" ? t.mag.steps : t.steps;
  const SCHEMAS = SCHEMAS_BY[culture];
  const LAST = STEP_TITLES.length - 1;
  const chooseCulture = (c: Culture) => {
    setState((s) => ({ ...s, culture: c, maghreb: hasMaghrebSteps(c) ? (s.maghreb ?? emptyMaghreb()) : s.maghreb }));
    setChosen(true);
    setStep(0);
    setErrors({});
  };
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
      if (saved) {
        const data = JSON.parse(saved);
        const c: Culture = cultures.includes(data.culture) ? data.culture : cultures[0];
        setState({ ...initialState(templateSlug, invitationLang, c), ...data, culture: c, ...(hasMaghrebSteps(c) && !data.maghreb ? { maghreb: emptyMaghreb() } : {}), consent: false, website: "" });
        if (cultures.includes(data.culture)) setChosen(true);
      }
    } catch {
      /* stockage indisponible */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey, templateSlug, invitationLang]);
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
  const setMaghreb = (patch: Partial<MaghrebInput>) =>
    setState((s) => ({ ...s, maghreb: { ...(s.maghreb ?? emptyMaghreb()), ...patch } }));
  const setCeremony = (i: number, patch: Partial<CeremonyInput>) =>
    setState((s) => ({ ...s, ceremonies: (s.ceremonies ?? []).map((c, j) => (j === i ? { ...c, ...patch } : c)) }));

  const validateStep = (index: number) => {
    const result = SCHEMAS[index].safeParse(state);
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
    for (let i = 0; i < SCHEMAS.length; i++) {
      if (!validateStep(i)) {
        setStep(i);
        return;
      }
    }
    setServerMessage(null);
    startTransition(async () => {
      const res = await submitRequest(state as RequestInput, lang);
      if (res.ok) {
        try {
          window.localStorage.removeItem(storageKey);
        } catch {}
        router.push(localePath(lang, `/personnalisation/merci?ref=${encodeURIComponent(res.reference)}&email=${res.emailSent ? "1" : "0"}`));
      } else {
        setServerMessage(res.message);
        if (res.fieldErrors) setErrors(res.fieldErrors);
      }
    });
  };

  const e = (key: string) => (errors[key] ? translateError(errors[key], t.errors) : undefined);
  const ceremonies = state.ceremonies ?? [];

  return (
    <OptionalLabelContext.Provider value={t.optional}>
    {!chosen ? (
      <TypeChooser cultures={cultures} current={state.culture as Culture} onChoose={chooseCulture} t={t} />
    ) : (
    <div>
      {cultures.length > 1 ? (
        <p className="mb-6 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
          <span className="text-stone">{t.wtype.current}</span>
          <strong className="font-medium text-forest-deep">{typeTitle(culture, t)}</strong>
          <button type="button" className="text-forest underline underline-offset-4" onClick={() => setChosen(false)}>{t.wtype.change}</button>
        </p>
      ) : null}
      {culture !== "europeen" && step === 0 ? (
        <p className="mb-8 max-w-2xl leading-relaxed text-stone">{culture === "mixte" ? t.wtype.mixIntro : t.mag.intro}</p>
      ) : null}
      {/* Progression */}
      <ol className="mb-10 grid gap-1.5" style={{ gridTemplateColumns: `repeat(${STEP_TITLES.length}, minmax(0, 1fr))` }} aria-label={t.progress}>
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
        {fmt(t.stepOf, { n: step + 1, total: STEP_TITLES.length })}
      </p>
      <h2 ref={headingRef} tabIndex={-1} className="mt-1 font-serif text-3xl outline-none md:text-4xl">
        {STEP_TITLES[step]}
      </h2>

      <form
        className="mt-8"
        noValidate
        onSubmit={(ev) => {
          ev.preventDefault();
          if (step < LAST) next();
          else submit();
        }}
      >
        {/* Champ piège pour robots, invisible pour les humains et les lecteurs d'écran */}
        <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
          <label>
            {t.honeypot}
            <input tabIndex={-1} autoComplete="off" value={state.website ?? ""} onChange={(ev) => set("website", ev.target.value)} />
          </label>
        </div>

        {KEYS[step] === "contact" && (
          <div className="grid gap-5 sm:grid-cols-2">
            <TextField label={f.firstName} autoComplete="given-name" value={state.firstName} onChange={(ev) => set("firstName", ev.target.value)} error={e("firstName")} required />
            <TextField label={f.lastName} autoComplete="family-name" value={state.lastName} onChange={(ev) => set("lastName", ev.target.value)} error={e("lastName")} required />
            <TextField label={f.email} type="email" autoComplete="email" inputMode="email" value={state.email} onChange={(ev) => set("email", ev.target.value)} error={e("email")} required className="sm:col-span-2" hint={f.emailHint} />
            <TextField label={f.phone} type="tel" autoComplete="tel" value={state.phone} onChange={(ev) => set("phone", ev.target.value)} error={e("phone")} optional />
            <SelectField label={f.country} value={state.country} onChange={(ev) => set("country", ev.target.value)} error={e("country")} options={COUNTRIES.map((c) => ({ value: c, label: t.countries[c as keyof T["countries"]] ?? c }))} />
            <SelectField label={f.language} hint={f.languageHint} value={state.language} onChange={(ev) => set("language", ev.target.value as FormState["language"])} error={e("language")} options={LANG_OPTIONS} className="sm:col-span-2" />
          </div>
        )}

        {KEYS[step] === "couple" && (
          <div className="grid gap-5 sm:grid-cols-2">
            <TextField label={f.partnerOne} value={state.partnerOne} onChange={(ev) => set("partnerOne", ev.target.value)} error={e("partnerOne")} required />
            <TextField label={f.partnerTwo} value={state.partnerTwo} onChange={(ev) => set("partnerTwo", ev.target.value)} error={e("partnerTwo")} required />
            <TextField label={mag ? t.mag.eventDate : f.eventDate} type="date" value={state.eventDate} onChange={(ev) => set("eventDate", ev.target.value)} error={e("eventDate")} required className="sm:col-span-2" />
            <TextArea label={f.introText} value={state.introText} onChange={(ev) => set("introText", ev.target.value)} error={e("introText")} optional className="sm:col-span-2" hint={f.introHint} />
          </div>
        )}

        {mag && ["henna", "soiree", "moments", "maghrebDetails"].includes(KEYS[step]) && (() => {
          const m = { ...emptyMaghreb(), ...(state.maghreb ?? {}) } as ReturnType<typeof emptyMaghreb>;
          const props = { m, set: setMaghreb, t, e };
          if (KEYS[step] === "henna") return <HennaStep {...props} />;
          if (KEYS[step] === "soiree") return <SoireeStep {...props} />;
          if (KEYS[step] === "moments") return <MomentsStep {...props} />;
          return <DecorationFields {...props} />;
        })()}

        {KEYS[step] === "ceremonies" && (
          <div>
            <p className="mb-6 leading-relaxed text-stone">{culture === "mixte" ? t.wtype.ceremoniesMixIntro : f.ceremoniesIntro}</p>
            {ceremonies.length === 0 ? (
              <p className="card p-5 text-sm text-stone">{f.noCeremony}</p>
            ) : null}
            <div className="space-y-6">
              {ceremonies.map((c, i) => (
                <fieldset key={i} className="card p-5">
                  <legend className="px-1 font-serif text-xl">{CEREMONY_LABELS[c.type]}</legend>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <SelectField label={f.type} value={c.type} onChange={(ev) => setCeremony(i, { type: ev.target.value as CeremonyInput["type"] })} options={CEREMONY_TYPES.map((t) => ({ value: t, label: CEREMONY_LABELS[t] }))} />
                    <TextField label={f.customLabel} value={c.label} onChange={(ev) => setCeremony(i, { label: ev.target.value })} optional placeholder={f.customLabelPh} />
                    {culture === "mixte" ? (
                      <TextField label={t.wtype.ceremonyDate} type="date" value={c.date ?? ""} onChange={(ev) => setCeremony(i, { date: ev.target.value })} error={e(`ceremonies.${i}.date`)} optional />
                    ) : null}
                    <TextField label={f.venue} value={c.venueName} onChange={(ev) => setCeremony(i, { venueName: ev.target.value })} optional />
                    <TextField label={f.address} value={c.address} onChange={(ev) => setCeremony(i, { address: ev.target.value })} optional />
                    <TextField label={f.guestsArrival} type="time" value={c.arrivalTime} onChange={(ev) => setCeremony(i, { arrivalTime: ev.target.value })} error={e(`ceremonies.${i}.arrivalTime`)} optional />
                    <TextField label={f.ceremonyStart} type="time" value={c.startTime} onChange={(ev) => setCeremony(i, { startTime: ev.target.value })} error={e(`ceremonies.${i}.startTime`)} optional />
                    <TextArea label={f.notes} value={c.notes} onChange={(ev) => setCeremony(i, { notes: ev.target.value })} optional className="sm:col-span-2" />
                    <label className="flex min-h-11 items-center gap-3 text-sm sm:col-span-2">
                      <input type="checkbox" className="h-5 w-5 accent-forest" checked={c.showOnInvitation} onChange={(ev) => setCeremony(i, { showOnInvitation: ev.target.checked })} />
                      {f.showCeremony}
                    </label>
                  </div>
                  <button type="button" className="btn btn-ghost btn-sm mt-3 text-danger" onClick={() => set("ceremonies", ceremonies.filter((_, j) => j !== i))}>
                    {f.removeCeremony}
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

        {KEYS[step] === "reception" && (
          <div className="grid gap-5 sm:grid-cols-2">
            <TextField label={f.receptionVenue} value={state.reception?.venueName} onChange={(ev) => setReception("venueName", ev.target.value)} optional />
            <TextField label={f.fullAddress} autoComplete="street-address" value={state.reception?.address} onChange={(ev) => setReception("address", ev.target.value)} optional />
            <TextField label={f.guestsArrival} type="time" value={state.reception?.arrivalTime} onChange={(ev) => setReception("arrivalTime", ev.target.value)} error={e("reception.arrivalTime")} optional />
            <TextField label={f.cocktail} type="time" value={state.reception?.cocktailTime} onChange={(ev) => setReception("cocktailTime", ev.target.value)} error={e("reception.cocktailTime")} optional />
            <TextField label={f.dinner} type="time" value={state.reception?.dinnerTime} onChange={(ev) => setReception("dinnerTime", ev.target.value)} error={e("reception.dinnerTime")} optional />
            <TextField label={f.mapsUrl} type="url" inputMode="url" value={state.reception?.mapsUrl} onChange={(ev) => setReception("mapsUrl", ev.target.value)} error={e("reception.mapsUrl")} optional />
            <TextArea label={f.otherTimes} value={state.reception?.otherTimes} onChange={(ev) => setReception("otherTimes", ev.target.value)} optional className="sm:col-span-2" placeholder={f.otherTimesPh} />
            <TextArea label={f.parking} value={state.reception?.parking} onChange={(ev) => setReception("parking", ev.target.value)} optional />
            <TextArea label={f.shuttles} value={state.reception?.shuttles} onChange={(ev) => setReception("shuttles", ev.target.value)} optional />
            <TextArea label={f.lodging} value={state.reception?.lodging} onChange={(ev) => setReception("lodging", ev.target.value)} optional className="sm:col-span-2" />
          </div>
        )}

        {(KEYS[step] === "details" || KEYS[step] === "maghrebDetails") && (
          <div className="grid gap-5 sm:grid-cols-2">
            <TextArea label={f.dressCode} value={state.details?.dressCode} onChange={(ev) => setDetails("dressCode", ev.target.value)} optional />
            <TextField label={f.rsvpDeadline} type="date" value={state.details?.rsvpDeadline} onChange={(ev) => setDetails("rsvpDeadline", ev.target.value)} error={e("details.rsvpDeadline")} optional />
            <TextArea label={f.program} value={state.details?.program} onChange={(ev) => setDetails("program", ev.target.value)} optional className="sm:col-span-2" />
            <TextArea label={f.witnesses} value={state.details?.witnesses} onChange={(ev) => setDetails("witnesses", ev.target.value)} optional hint={f.witnessesHint} />
            <TextArea label={f.phoneNumbers} value={state.details?.phoneNumbers} onChange={(ev) => setDetails("phoneNumbers", ev.target.value)} optional />
            <TextArea label={f.customText} value={state.details?.customText} onChange={(ev) => setDetails("customText", ev.target.value)} optional className="sm:col-span-2" />
            <TextArea label={f.preferences} value={state.details?.preferences} onChange={(ev) => setDetails("preferences", ev.target.value)} optional hint={f.preferencesHint} />
            <TextArea label={f.photos} value={state.details?.photos} onChange={(ev) => setDetails("photos", ev.target.value)} optional hint={f.photosHint} />
            <TextField label={f.music} value={state.details?.music} onChange={(ev) => setDetails("music", ev.target.value)} optional />
            <TextArea label={f.comments} value={state.details?.comments} onChange={(ev) => setDetails("comments", ev.target.value)} optional className="sm:col-span-2" />
          </div>
        )}

        {step === LAST && (
          <Review state={state} templateName={templateName} onEdit={(i) => setStep(i)} t={t} lang={lang} culture={culture} keys={KEYS} />
        )}

        {step === LAST && (
          <div className="mt-8">
            <label className="flex items-start gap-3 text-sm leading-relaxed">
              <input type="checkbox" className="mt-0.5 h-5 w-5 shrink-0 accent-forest" checked={state.consent} onChange={(ev) => set("consent", ev.target.checked)} aria-invalid={e("consent") ? true : undefined} />
              <span>
                {t.consent}{" "}
                <a href={localePath(lang, "/confidentialite")} target="_blank" className="text-forest underline underline-offset-4">{t.consentLink}</a>.
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
          <p role="alert" className="mt-6 text-sm text-danger">{t.fixFields}</p>
        ) : null}

        <div className="mt-10 flex flex-col-reverse gap-3 border-t border-line pt-6 sm:flex-row sm:justify-between">
          {step > 0 ? (
            <button type="button" className="btn btn-ghost" onClick={back} disabled={pending}>
              {t.back}
            </button>
          ) : (
            <span />
          )}
          <button type="submit" className="btn btn-primary" disabled={pending}>
            {step < LAST ? t.continue : pending ? t.sending : t.send}
          </button>
        </div>
        <p className="mt-4 text-center text-xs text-stone sm:text-end">{t.keptLocally}</p>
      </form>
    </div>
    )}
    </OptionalLabelContext.Provider>
  );
}

type ReviewRow = { step: number; title: string; items: Array<[string, string | undefined]> };

function Review({ state, templateName, onEdit, t, lang, culture, keys }: { state: FormState; templateName: string; onEdit: (step: number) => void; t: T; lang: SiteLang; culture: Culture; keys: StepKey[] }) {
  const mag = hasMaghrebSteps(culture);
  const at = (k: StepKey) => keys.indexOf(k);
  const r = t.review;
  const langLabel = LANG_OPTIONS.find((l) => l.value === state.language)?.label;
  const country = t.countries[state.country as keyof T["countries"]] ?? state.country;
  const rows: Array<{ step: number; title: string; items: Array<[string, string | undefined]> }> = [
    {
      step: 0,
      title: r.contact,
      items: [
        [r.person, `${state.firstName} ${state.lastName}`],
        [r.email, state.email],
        [r.phone, state.phone],
        [r.country, country],
        [r.language, langLabel],
        [r.template, templateName],
      ],
    },
    {
      step: 1,
      title: r.couple,
      items: [
        [r.names, `${state.partnerOne} & ${state.partnerTwo}`],
        [r.date, state.eventDate ? new Date(`${state.eventDate}T12:00`).toLocaleDateString(LANG_META[lang].intl, { dateStyle: "full" }) : ""],
        [r.intro, state.introText],
      ],
    },
    ...(keys.includes("ceremonies") ? ([{
      step: at("ceremonies"),
      title: r.ceremonies,
      items: (state.ceremonies ?? []).map((c): [string, string] => [
        c.label || t.ceremonies[c.type],
        [c.date ? new Date(`${c.date}T12:00`).toLocaleDateString(LANG_META[lang].intl, { dateStyle: "long" }) : "", c.venueName, c.address, c.startTime && fmt(r.start, { t: c.startTime }), c.showOnInvitation ? "" : r.hidden].filter(Boolean).join(" · "),
      ]),
    }] as ReviewRow[]) : []),
    ...(mag ? maghrebRows(state, t, lang, at) : []),
    ...(keys.includes("reception") ? ([{
      step: at("reception"),
      title: r.reception,
      items: [
        [r.venue, [state.reception?.venueName, state.reception?.address].filter(Boolean).join(" — ")],
        [
          r.times,
          [
            state.reception?.arrivalTime && fmt(r.arrival, { t: state.reception.arrivalTime }),
            state.reception?.cocktailTime && fmt(r.cocktail, { t: state.reception.cocktailTime }),
            state.reception?.dinnerTime && fmt(r.dinner, { t: state.reception.dinnerTime }),
          ]
            .filter(Boolean)
            .join(" · "),
        ],
        [r.otherTimes, state.reception?.otherTimes],
        [r.parking, state.reception?.parking],
        [r.transport, state.reception?.shuttles],
        [r.lodging, state.reception?.lodging],
      ],
    }] as ReviewRow[]) : []),
    {
      step: at(mag ? "maghrebDetails" : "details"),
      title: r.other,
      items: [
        [r.dressCode, state.details?.dressCode],
        [r.rsvp, state.details?.rsvpDeadline],
        [r.program, state.details?.program],
        [r.witnesses, state.details?.witnesses],
        [r.phones, state.details?.phoneNumbers],
        [r.customText, state.details?.customText],
        [r.preferences, state.details?.preferences],
        [r.photos, state.details?.photos],
        [r.music, state.details?.music],
        [r.comments, state.details?.comments],
      ],
    },
  ];
  return (
    <div className="space-y-6">
      {rows.map((row) => {
        const filled = row.items.filter(([, v]) => v && v.trim());
        return (
          <section key={row.title} className="card p-5">
            <div className="flex items-center justify-between gap-4">
              <h3 className="font-serif text-xl">{row.title}</h3>
              <button type="button" className="text-sm text-forest underline underline-offset-4" onClick={() => onEdit(row.step)}>
                {r.edit}
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
              <p className="mt-2 text-sm text-stone">{r.empty}</p>
            )}
          </section>
        );
      })}
    </div>
  );
}

/** Récapitulatif du formulaire maghrébin (henné, soirée, autres moments, décoration). */
function maghrebRows(state: FormState, t: T, lang: SiteLang, at: (k: StepKey) => number): Array<{ step: number; title: string; items: Array<[string, string | undefined]> }> {
  const g = t.mag;
  const m = { ...emptyMaghreb(), ...(state.maghreb ?? {}) } as ReturnType<typeof emptyMaghreb>;
  const day = (d?: string) => (d ? new Date(`${d}T12:00`).toLocaleDateString(LANG_META[lang].intl, { dateStyle: "full" }) : "");
  const join = (...xs: Array<string | false | undefined>) => xs.filter(Boolean).join(" · ");
  const aud = (a?: string) => (a === "henna" ? g.audHenna : a === "hidden" ? g.audHidden : g.audAll);
  const sep = m.separateGuests === "yes" ? g.separateYes : m.separateGuests === "no" ? g.separateNo : g.separateUnknown;
  const h = m.henna;
  const s = m.soiree;
  const moment = (x: { date?: string; time?: string; venueName?: string; address?: string; audience?: string }) => join(day(x.date), x.time, x.venueName, x.address, aud(x.audience));
  const deco = m.decoration;
  return [
    {
      step: at("henna"),
      title: g.rHenna,
      items: [
        [g.rGuests, sep],
        ...(h.enabled === false
          ? []
          : ([
              [g.hennaDate, day(h.date)],
              [g.hennaVenue, join(h.venueName, h.address)],
              [g.hammamTime, join(h.hammamTime, h.hammamPlace, h.hammamTime || h.hammamPlace ? aud(h.hammamAudience) : "")],
              [g.hennaTime, h.hennaTime],
              [g.chantTime, h.chantTime],
              [g.hennaDinner, h.dinnerTime],
              [g.notesDay, h.notes],
            ] as Array<[string, string | undefined]>)),
      ],
    },
    {
      step: at("soiree"),
      title: g.rSoiree,
      items: [
        [g.soireeVenue, join(s.venueName, s.address)],
        [g.receptionTime, s.receptionTime],
        [g.brideTime, s.brideTime],
        [g.teaTime, s.teaTime],
        [g.dinnerTime, s.dinnerTime],
        [g.cakeTime, s.cakeTime],
        [g.endTime, s.endTime],
        [g.notesDay, s.notes],
        [t.review.parking, s.parking],
        [t.review.transport, s.shuttles],
        [t.review.lodging, s.lodging],
      ],
    },
    {
      step: at("moments"),
      title: g.rMoments,
      items: [
        ...(m.fatiha.enabled ? ([[g.fatiha, moment(m.fatiha)]] as Array<[string, string]>) : []),
        ...(m.lendemain.enabled ? ([[g.lendemain, moment(m.lendemain)]] as Array<[string, string]>) : []),
        ...(m.others ?? []).map((o) => [o.label || g.momentName, moment(o)] as [string, string]),
      ],
    },
    {
      step: at("maghrebDetails"),
      title: g.rDeco,
      items: [[g.decoQ, deco.known === "yes" ? join(deco.colors, deco.theme) || g.decoYes : deco.known === "no" ? g.decoNo : g.decoLater]],
    },
  ];
}

const typeTitle = (c: Culture, t: T) => (c === "mixte" ? t.wtype.mixTitle : c === "maghrebin" ? t.wtype.magTitle : t.wtype.euTitle);

/** Premier écran quand le modèle propose plusieurs types de mariage. */
function TypeChooser({ cultures, current, onChoose, t }: { cultures: Culture[]; current: Culture; onChoose: (c: Culture) => void; t: T }) {
  const w = t.wtype;
  const desc: Record<Culture, string> = { europeen: w.euDesc, maghrebin: w.magDesc, mixte: w.mixDesc };
  return (
    <section aria-labelledby="type-title">
      <h2 id="type-title" className="font-serif text-3xl md:text-4xl">{w.choose}</h2>
      <p className="mt-3 max-w-2xl leading-relaxed text-stone">{w.chooseIntro}</p>
      <div className={`mt-8 grid gap-4 ${cultures.length === 3 ? "md:grid-cols-3" : "md:grid-cols-2"}`}>
        {cultures.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => onChoose(c)}
            className={`group flex flex-col rounded-sm border bg-white p-6 text-start transition hover:-translate-y-0.5 hover:border-forest hover:shadow-[0_14px_30px_-18px_rgb(60_50_40/0.4)] ${current === c ? "border-forest" : "border-line"}`}
          >
            <span className="font-serif text-2xl leading-tight group-hover:text-forest">{typeTitle(c, t)}</span>
            <span className="mt-3 text-sm leading-relaxed text-stone">{desc[c]}</span>
            <span className="mt-5 text-[0.72rem] uppercase tracking-[0.2em] text-forest">{t.continue} →</span>
          </button>
        ))}
      </div>
    </section>
  );
}
