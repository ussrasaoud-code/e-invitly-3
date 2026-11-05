"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { OptionalLabelContext, SelectField, TextField } from "@/components/ui/Field";
import { LANG_META, SITE_LANGS, localePath, type SiteLang } from "@/lib/i18n/config";
import type { SiteDict } from "@/lib/i18n/dict";
import { COUNTRIES, ORDER_EVENT_TYPES, flattenErrors, orderSchema, translateError, type OrderInput } from "@/lib/validation/request";
import { startOrder } from "../actions";

type State = Omit<OrderInput, "consent"> & { consent: boolean };

const LANG_OPTIONS = SITE_LANGS.map((l) => ({ value: l, label: LANG_META[l].native }));

/**
 * Commande en ligne : quelques informations, puis la page de paiement.
 * Le formulaire détaillé (cérémonies, réception, RSVP…) est rempli après le
 * paiement, dans l'espace client.
 */
export function QuickOrderForm({ templateSlug, category, t, lang, invitationLang, languages }: {
  templateSlug: string;
  category: string;
  t: Pick<SiteDict, "request" | "order" | "categories">;
  lang: SiteLang;
  invitationLang: SiteLang;
  languages?: SiteLang[];
}) {
  const r = t.request;
  const f = r.f;
  const o = t.order;
  const langOptions = languages?.length ? LANG_OPTIONS.filter((x) => languages.includes(x.value)) : LANG_OPTIONS;
  const [state, setState] = useState<State>({
    templateSlug,
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    country: "France",
    language: invitationLang,
    secondLanguage: "",
    eventType: (ORDER_EVENT_TYPES as readonly string[]).includes(category) ? (category as State["eventType"]) : "mariage",
    partnerOne: "",
    partnerTwo: "",
    eventDate: "",
    consent: false,
    website: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverMessage, setServerMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const set = <K extends keyof State>(key: K, value: State[K]) => {
    setState((s) => ({ ...s, [key]: value }));
    // Le message d'erreur disparaît dès que le champ est corrigé
    setErrors((e) => {
      if (!(key in e)) return e;
      const next = { ...e };
      delete next[key as string];
      return next;
    });
  };
  const e = (key: string) => (errors[key] ? translateError(errors[key], r.errors) : undefined);

  const submit = () => {
    const parsed = orderSchema.safeParse(state);
    if (!parsed.success) {
      setErrors(flattenErrors(parsed.error));
      return;
    }
    setErrors({});
    setServerMessage(null);
    startTransition(async () => {
      const res = await startOrder(state as OrderInput, lang);
      if (res.ok) router.push(localePath(lang, `/paiement/${res.token}`));
      else {
        setServerMessage(res.message);
        if (res.fieldErrors) setErrors(res.fieldErrors);
      }
    });
  };

  return (
    <OptionalLabelContext.Provider value={r.optional}>
      <form
        noValidate
        onSubmit={(ev) => {
          ev.preventDefault();
          submit();
        }}
      >
        <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
          <label>
            {r.honeypot}
            <input tabIndex={-1} autoComplete="off" value={state.website ?? ""} onChange={(ev) => set("website", ev.target.value)} />
          </label>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <TextField label={f.firstName} autoComplete="given-name" value={state.firstName} onChange={(ev) => set("firstName", ev.target.value)} error={e("firstName")} required />
          <TextField label={f.lastName} autoComplete="family-name" value={state.lastName} onChange={(ev) => set("lastName", ev.target.value)} error={e("lastName")} required />
          <TextField label={f.email} type="email" autoComplete="email" inputMode="email" value={state.email} onChange={(ev) => set("email", ev.target.value)} error={e("email")} required className="sm:col-span-2" hint={f.emailHint} />
          <TextField label={f.phone} type="tel" autoComplete="tel" value={state.phone} onChange={(ev) => set("phone", ev.target.value)} error={e("phone")} optional />
          <SelectField label={f.country} value={state.country} onChange={(ev) => set("country", ev.target.value)} error={e("country")} options={COUNTRIES.map((c) => ({ value: c, label: r.countries[c as keyof typeof r.countries] ?? c }))} />

          <SelectField
            label={o.eventType}
            value={state.eventType}
            onChange={(ev) => set("eventType", ev.target.value as State["eventType"])}
            options={ORDER_EVENT_TYPES.map((c) => ({ value: c, label: t.categories[c as keyof typeof t.categories] ?? c }))}
            className="sm:col-span-2"
          />
          <TextField label={f.partnerOne} value={state.partnerOne} onChange={(ev) => set("partnerOne", ev.target.value)} error={e("partnerOne")} required />
          <TextField label={f.partnerTwo} value={state.partnerTwo} onChange={(ev) => set("partnerTwo", ev.target.value)} error={e("partnerTwo")} required />
          <TextField label={f.eventDate} hint={o.eventDateHint} type="date" value={state.eventDate} onChange={(ev) => set("eventDate", ev.target.value)} error={e("eventDate")} optional className="sm:col-span-2" />

          <SelectField
            label={f.language}
            hint={f.languageHint}
            value={state.language}
            onChange={(ev) => {
              const v = ev.target.value as State["language"];
              setState((s) => ({ ...s, language: v, secondLanguage: s.secondLanguage === v ? "" : s.secondLanguage }));
            }}
            error={e("language")}
            options={langOptions}
          />
          <SelectField
            label={f.secondLanguage}
            hint={f.secondLanguageHint}
            value={state.secondLanguage ?? ""}
            onChange={(ev) => set("secondLanguage", ev.target.value as State["secondLanguage"])}
            options={[{ value: "", label: f.secondLanguageNone }, ...LANG_OPTIONS.filter((x) => x.value !== state.language && (!languages?.length || languages.includes(x.value) || x.value === "en"))]}
          />
        </div>

        <div className="mt-8">
          <label className="flex items-start gap-3 text-sm leading-relaxed">
            <input type="checkbox" className="mt-0.5 h-5 w-5 shrink-0 accent-forest" checked={state.consent} onChange={(ev) => set("consent", ev.target.checked)} aria-invalid={e("consent") ? true : undefined} />
            <span>
              {r.consent}{" "}
              <a href={localePath(lang, "/confidentialite")} target="_blank" className="text-forest underline underline-offset-4">{r.consentLink}</a>.
            </span>
          </label>
          {e("consent") ? <p className="field-error" role="alert">{e("consent")}</p> : null}
        </div>

        {serverMessage ? (
          <p role="alert" className="mt-6 border border-danger/30 bg-danger-soft px-4 py-3 text-sm text-danger">{serverMessage}</p>
        ) : null}
        {Object.keys(errors).length > 0 && !serverMessage ? <p role="alert" className="mt-6 text-sm text-danger">{r.fixFields}</p> : null}

        <div className="mt-8 border-t border-line pt-6 sm:text-end">
          <button type="submit" className="btn btn-primary w-full sm:w-auto" disabled={pending}>
            {pending ? o.sending : o.submit}
          </button>
        </div>
      </form>
    </OptionalLabelContext.Provider>
  );
}
