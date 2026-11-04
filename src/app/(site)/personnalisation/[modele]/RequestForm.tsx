"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { OptionalLabelContext, SelectField, TextArea, TextField } from "@/components/ui/Field";
import { LANG_META, SITE_LANGS, fmt, localePath, type SiteLang } from "@/lib/i18n/config";
import type { SiteDict } from "@/lib/i18n/dict";
import {
  CEREMONY_TYPES,
  COUNTRIES,
  STEP_SCHEMAS,
  flattenErrors,
  translateError,
  type CeremonyInput,
  type RequestInput,
  type MomentInput,
} from "@/lib/validation/request";
import { submitRequest } from "../actions";
import { RsvpChoicesEditor } from "@/components/rsvp/RsvpChoicesEditor";
import { DEFAULT_RSVP_CHOICES, DEFAULT_RSVP_FIELDS, RSVP_FIELD_KEYS, rsvpChoicesSchema } from "@/lib/rsvp";

type T = SiteDict["request"];

type FormState = Omit<RequestInput, "consent"> & { consent: boolean };

const emptyCeremony = (type: CeremonyInput["type"] = "civil"): CeremonyInput => ({
  type,
  label: "",
  showOnInvitation: true,
  restricted: false,
  guestGroup: "",
  venueName: "",
  address: "",
  date: "",
  arrivalTime: "",
  startTime: "",
  notes: "",
});

const initialState = (templateSlug: string, language: SiteLang = "fr"): FormState => ({
  templateSlug,
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  country: "France",
  language,
  secondLanguage: "",
  partnerOne: "",
  partnerTwo: "",
  eventDate: "",
  introText: "",
  ceremonies: [],
  reception: {
    venueName: "",
    address: "",
    date: "",
    arrivalTime: "",
    moments: [],
    endTime: "",
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

export function RequestForm({ templateSlug, templateName, t, rsvpT, lang, invitationLang, languages }: { templateSlug: string; templateName: string; t: T; rsvpT: SiteDict["rsvpSetup"]; lang: SiteLang; invitationLang: SiteLang; languages?: SiteLang[] }) {
  // Langues proposées pour l'invitation : celles ouvertes sur le site (Paramètres → Langues)
  const langOptions = languages?.length ? LANG_OPTIONS.filter((o) => languages.includes(o.value)) : LANG_OPTIONS;
  const storageKey = `e-invitly:demande:${templateSlug}`;
  const STEP_TITLES = t.steps;
  const CEREMONY_LABELS = t.ceremonies;
  const f = t.f;
  const [state, setState] = useState<FormState>(() => initialState(templateSlug, invitationLang));
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
      if (saved) setState({ ...initialState(templateSlug, invitationLang), ...JSON.parse(saved), consent: false, website: "" });
    } catch {
      /* stockage indisponible */
    }
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
  // Déroulé de la soirée : proposé avec les moments habituels, que les mariés gardent ou retirent
  const moments: MomentInput[] = state.reception?.moments?.length
    ? state.reception.moments
    : (state.reception as { momentsTouched?: boolean })?.momentsTouched
      ? []
      : (["cocktail", "dinner", "cake", "party"] as const).map((kind) => ({ kind, title: f.momentKinds[kind], time: "", note: "" }));
  const setMoments = (next: MomentInput[]) => setState((s) => ({ ...s, reception: { ...s.reception, moments: next, momentsTouched: true } as FormState["reception"] }));
  const patchMoment = (i: number, patch: Partial<MomentInput>) => setMoments(moments.map((m, j) => (j === i ? { ...m, ...patch } : m)));
  const moveMoment = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= moments.length) return;
    const next = [...moments];
    [next[i], next[j]] = [next[j], next[i]];
    setMoments(next);
  };
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
    <div>
      {/* Progression */}
      <ol className="mb-10 grid grid-cols-6 gap-1.5" aria-label={t.progress}>
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
          if (step < STEP_TITLES.length - 1) next();
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

        {step === 0 && (
          <div className="grid gap-5 sm:grid-cols-2">
            <TextField label={f.firstName} autoComplete="given-name" value={state.firstName} onChange={(ev) => set("firstName", ev.target.value)} error={e("firstName")} required />
            <TextField label={f.lastName} autoComplete="family-name" value={state.lastName} onChange={(ev) => set("lastName", ev.target.value)} error={e("lastName")} required />
            <TextField label={f.email} type="email" autoComplete="email" inputMode="email" value={state.email} onChange={(ev) => set("email", ev.target.value)} error={e("email")} required className="sm:col-span-2" hint={f.emailHint} />
            <TextField label={f.phone} type="tel" autoComplete="tel" value={state.phone} onChange={(ev) => set("phone", ev.target.value)} error={e("phone")} optional />
            <SelectField label={f.country} value={state.country} onChange={(ev) => set("country", ev.target.value)} error={e("country")} options={COUNTRIES.map((c) => ({ value: c, label: t.countries[c as keyof T["countries"]] ?? c }))} />
            <SelectField label={f.language} hint={f.languageHint} value={state.language} onChange={(ev) => { const v = ev.target.value as FormState["language"]; set("language", v); if (state.secondLanguage === v) set("secondLanguage", ""); }} error={e("language")} options={langOptions} className="sm:col-span-2" />
            <SelectField
              label={f.secondLanguage}
              hint={f.secondLanguageHint}
              value={state.secondLanguage ?? ""}
              onChange={(ev) => set("secondLanguage", ev.target.value as FormState["secondLanguage"])}
              options={[{ value: "", label: f.secondLanguageNone }, ...LANG_OPTIONS.filter((o) => o.value !== state.language && (!languages?.length || languages.includes(o.value) || o.value === "en"))]}
              className="sm:col-span-2"
            />
          </div>
        )}

        {step === 1 && (
          <div className="grid gap-5 sm:grid-cols-2">
            <TextField label={f.partnerOne} value={state.partnerOne} onChange={(ev) => set("partnerOne", ev.target.value)} error={e("partnerOne")} required />
            <TextField label={f.partnerTwo} value={state.partnerTwo} onChange={(ev) => set("partnerTwo", ev.target.value)} error={e("partnerTwo")} required />
            <TextField label={f.eventDate} type="date" value={state.eventDate} onChange={(ev) => set("eventDate", ev.target.value)} error={e("eventDate")} required className="sm:col-span-2" />
            <TextArea label={f.introText} value={state.introText} onChange={(ev) => set("introText", ev.target.value)} error={e("introText")} optional className="sm:col-span-2" hint={f.introHint} />
          </div>
        )}

        {step === 2 && (
          <div>
            <p className="mb-6 leading-relaxed text-stone">{f.ceremoniesIntro}</p>
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
                    <TextField label={f.venue} value={c.venueName} onChange={(ev) => setCeremony(i, { venueName: ev.target.value })} optional />
                    <TextField label={f.address} value={c.address} onChange={(ev) => setCeremony(i, { address: ev.target.value })} optional />
                    <TextField label={f.ceremonyDate} hint={f.ceremonyDateHint} type="date" value={c.date ?? ""} onChange={(ev) => setCeremony(i, { date: ev.target.value })} error={e(`ceremonies.${i}.date`)} optional className="sm:col-span-2" />
                    <TextField label={f.guestsArrival} type="time" value={c.arrivalTime} onChange={(ev) => setCeremony(i, { arrivalTime: ev.target.value })} error={e(`ceremonies.${i}.arrivalTime`)} optional />
                    <TextField label={f.ceremonyStart} type="time" value={c.startTime} onChange={(ev) => setCeremony(i, { startTime: ev.target.value })} error={e(`ceremonies.${i}.startTime`)} optional />
                    <TextArea label={f.notes} value={c.notes} onChange={(ev) => setCeremony(i, { notes: ev.target.value })} optional className="sm:col-span-2" />
                    <label className="flex min-h-11 items-center gap-3 text-sm sm:col-span-2">
                      <input type="checkbox" className="h-5 w-5 accent-forest" checked={c.showOnInvitation} onChange={(ev) => setCeremony(i, { showOnInvitation: ev.target.checked })} />
                      {f.showCeremony}
                    </label>
                    {c.showOnInvitation ? (
                      <div className="sm:col-span-2">
                        <SelectField
                          label={f.whoInvited}
                          value={c.restricted ? "some" : "all"}
                          onChange={(ev) => setCeremony(i, { restricted: ev.target.value === "some" })}
                          options={[
                            { value: "all", label: f.allGuests },
                            { value: "some", label: f.someGuests },
                          ]}
                        />
                        {c.restricted ? (
                          <TextField
                            className="mt-3"
                            label={f.groupName}
                            value={c.guestGroup}
                            onChange={(ev) => setCeremony(i, { guestGroup: ev.target.value })}
                            placeholder={f.groupNamePh}
                            hint={f.groupHint}
                            optional
                          />
                        ) : null}
                      </div>
                    ) : null}
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

        {step === 3 && (
          <div className="grid gap-5 sm:grid-cols-2">
            <TextField label={f.receptionVenue} value={state.reception?.venueName} onChange={(ev) => setReception("venueName", ev.target.value)} optional />
            <TextField label={f.fullAddress} autoComplete="street-address" value={state.reception?.address} onChange={(ev) => setReception("address", ev.target.value)} optional />
            <TextField label={f.mapsUrl} type="url" inputMode="url" value={state.reception?.mapsUrl} onChange={(ev) => setReception("mapsUrl", ev.target.value)} error={e("reception.mapsUrl")} optional className="sm:col-span-2" />
            <TextField label={f.receptionDate} hint={f.receptionDateHint} type="date" value={state.reception?.date ?? ""} onChange={(ev) => setReception("date", ev.target.value)} error={e("reception.date")} optional />
            <TextField label={f.guestsArrival} type="time" value={state.reception?.arrivalTime} onChange={(ev) => setReception("arrivalTime", ev.target.value)} error={e("reception.arrivalTime")} optional />

            <fieldset className="card p-5 sm:col-span-2">
              <legend className="px-1 font-serif text-xl">{f.timeline}</legend>
              <p className="mb-4 text-sm text-stone">{f.timelineHint}</p>
              <ol className="space-y-3">
                {moments.map((m, i) => (
                  <li key={i} className="rounded-sm border border-line bg-paper/60 p-3">
                    <div className="grid gap-3 sm:grid-cols-[1fr_8.5rem]">
                      <TextField label={f.momentName} value={m.title} maxLength={60} placeholder={f.momentKinds[m.kind]} onChange={(ev) => patchMoment(i, { title: ev.target.value })} />
                      <TextField label={f.momentTime} type="time" value={m.time} onChange={(ev) => patchMoment(i, { time: ev.target.value })} error={e(`reception.moments.${i}.time`)} optional />
                      <TextField label={f.momentNote} value={m.note} maxLength={160} placeholder={f.momentNotePh} onChange={(ev) => patchMoment(i, { note: ev.target.value })} optional className="sm:col-span-2" />
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1">
                      <button type="button" className="btn btn-ghost btn-sm" disabled={i === 0} onClick={() => moveMoment(i, -1)} aria-label={`${f.moveUp} : ${m.title || f.momentKinds[m.kind]}`}>↑ {f.moveUp}</button>
                      <button type="button" className="btn btn-ghost btn-sm" disabled={i === moments.length - 1} onClick={() => moveMoment(i, 1)} aria-label={`${f.moveDown} : ${m.title || f.momentKinds[m.kind]}`}>↓ {f.moveDown}</button>
                      <button type="button" className="btn btn-ghost btn-sm text-danger" onClick={() => setMoments(moments.filter((_, j) => j !== i))} aria-label={`${f.removeMoment} : ${m.title || f.momentKinds[m.kind]}`}>✕ {f.removeMoment}</button>
                    </div>
                  </li>
                ))}
              </ol>
              {moments.length < 10 ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  {(["cocktail", "dinner", "cake", "party", "other"] as const).map((k) => (
                    <button key={k} type="button" className="btn btn-secondary btn-sm" onClick={() => setMoments([...moments, { kind: k, title: k === "other" ? "" : f.momentKinds[k], time: "", note: "" }])}>
                      + {f.momentKinds[k]}
                    </button>
                  ))}
                </div>
              ) : null}
              <div className="mt-5 max-w-[14rem]">
                <TextField label={f.endTime} type="time" value={state.reception?.endTime ?? ""} onChange={(ev) => setReception("endTime", ev.target.value)} error={e("reception.endTime")} optional />
              </div>
            </fieldset>
            <TextArea label={f.parking} value={state.reception?.parking} onChange={(ev) => setReception("parking", ev.target.value)} optional />
            <TextArea label={f.shuttles} value={state.reception?.shuttles} onChange={(ev) => setReception("shuttles", ev.target.value)} optional />
            <TextArea label={f.lodging} value={state.reception?.lodging} onChange={(ev) => setReception("lodging", ev.target.value)} optional className="sm:col-span-2" />
          </div>
        )}

        {step === 4 && (
          <div className="grid gap-5 sm:grid-cols-2">
            <TextArea label={f.dressCode} value={state.details?.dressCode} onChange={(ev) => setDetails("dressCode", ev.target.value)} optional />
            <TextField label={f.rsvpDeadline} type="date" value={state.details?.rsvpDeadline} onChange={(ev) => setDetails("rsvpDeadline", ev.target.value)} error={e("details.rsvpDeadline")} optional />
            <fieldset className="card p-5 sm:col-span-2">
              <legend className="px-1 font-serif text-xl">{rsvpT.title}</legend>
              <RsvpChoicesEditor
                t={rsvpT}
                defaults={DEFAULT_RSVP_FIELDS}
                value={state.details?.rsvp ? rsvpChoicesSchema.parse(state.details.rsvp) : DEFAULT_RSVP_CHOICES}
                onChange={(rsvp) => setState((s) => ({ ...s, details: { ...s.details, rsvp } }))}
              />
            </fieldset>
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

        {step === 5 && (
          <Review state={state} templateName={templateName} onEdit={(i) => setStep(i)} t={t} rsvpT={rsvpT} lang={lang} />
        )}

        {step === 5 && (
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
            {step < STEP_TITLES.length - 1 ? t.continue : pending ? t.sending : t.send}
          </button>
        </div>
        <p className="mt-4 text-center text-xs text-stone sm:text-end">{t.keptLocally}</p>
      </form>
    </div>
    </OptionalLabelContext.Provider>
  );
}

function Review({ state, templateName, onEdit, t, rsvpT, lang }: { state: FormState; templateName: string; onEdit: (step: number) => void; t: T; rsvpT: SiteDict["rsvpSetup"]; lang: SiteLang }) {
  const rsvpChoices = state.details?.rsvp ? rsvpChoicesSchema.parse(state.details.rsvp) : DEFAULT_RSVP_CHOICES;
  const rsvpSummary = [
    ...RSVP_FIELD_KEYS.filter((k) => rsvpChoices.fields[k] ?? DEFAULT_RSVP_FIELDS[k]).map((k) => rsvpT.fields[k]),
    ...rsvpChoices.questions.filter((q) => q.label.trim()).map((q) => `« ${q.label.trim()} »`),
  ].join(" · ");
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
        [r.secondLanguage, LANG_OPTIONS.find((l) => l.value === state.secondLanguage)?.label],
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
    {
      step: 2,
      title: r.ceremonies,
      items: (state.ceremonies ?? []).map((c) => [
        c.label || t.ceremonies[c.type],
        [c.date && c.date !== state.eventDate ? new Date(`${c.date}T12:00:00`).toLocaleDateString(lang, { weekday: "long", day: "numeric", month: "long" }) : "", c.venueName, c.address, c.startTime && fmt(r.start, { t: c.startTime }), c.showOnInvitation ? "" : r.hidden, c.showOnInvitation && c.restricted ? fmt(r.reserved, { name: c.guestGroup || t.f.someGuests }) : ""].filter(Boolean).join(" · "),
      ]),
    },
    {
      step: 3,
      title: r.reception,
      items: [
        [r.venue, [state.reception?.venueName, state.reception?.address].filter(Boolean).join(" — ")],
        [
          r.times,
          [
            state.reception?.date && state.reception.date !== state.eventDate ? new Date(`${state.reception.date}T12:00:00`).toLocaleDateString(lang, { weekday: "long", day: "numeric", month: "long" }) : "",
            state.reception?.arrivalTime && fmt(r.arrival, { t: state.reception.arrivalTime }),
            ...(state.reception?.moments ?? [])
              .filter((m) => m.time || m.note)
              .map((m) => [m.title || t.f.momentKinds[m.kind], m.time, m.note && `(${m.note})`].filter(Boolean).join(" ")),
            state.reception?.endTime && fmt(r.end, { t: state.reception.endTime }),
          ]
            .filter(Boolean)
            .join(" · "),
        ],
        [r.parking, state.reception?.parking],
        [r.transport, state.reception?.shuttles],
        [r.lodging, state.reception?.lodging],
      ],
    },
    {
      step: 4,
      title: r.other,
      items: [
        [r.dressCode, state.details?.dressCode],
        [r.rsvp, state.details?.rsvpDeadline],
        [rsvpT.title, rsvpSummary],
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
