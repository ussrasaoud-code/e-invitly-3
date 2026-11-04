"use client";

import type { SiteDict } from "@/lib/i18n/dict";
import { RSVP_FIELD_KEYS, type RsvpChoices, type RsvpFieldKey } from "@/lib/rsvp";

type T = SiteDict["rsvpSetup"];
type Q = RsvpChoices["questions"][number];

/**
 * Ce que le formulaire de réponse demande aux invités : rubriques à cocher,
 * nombre d'accompagnants, questions personnalisées. Utilisé dans la demande
 * de personnalisation et dans l'espace des mariés.
 */
export function RsvpChoicesEditor({ value, onChange, t, defaults }: {
  value: RsvpChoices;
  onChange: (next: RsvpChoices) => void;
  t: T;
  defaults: Record<RsvpFieldKey, boolean>;
}) {
  const on = (k: RsvpFieldKey) => value.fields[k] ?? defaults[k];
  const setField = (k: RsvpFieldKey, v: boolean) => onChange({ ...value, fields: { ...defaults, ...value.fields, [k]: v } });
  const setQ = (i: number, patch: Partial<Q>) => onChange({ ...value, questions: value.questions.map((q, j) => (j === i ? { ...q, ...patch } : q)) });

  return (
    <div className="space-y-6">
      <p className="text-sm leading-relaxed text-stone">{t.intro}</p>
      <ul className="grid gap-2.5 sm:grid-cols-2">
        {RSVP_FIELD_KEYS.map((k) => (
          <li key={k}>
            <label className="flex items-start gap-2.5 text-sm">
              <input type="checkbox" className="mt-0.5 h-4 w-4 shrink-0 accent-forest" checked={on(k)} onChange={(e) => setField(k, e.target.checked)} />
              {t.fields[k]}
            </label>
          </li>
        ))}
      </ul>
      {on("companions") ? (
        <label className="block max-w-xs">
          <span className="field-label">{t.maxCompanions}</span>
          <input
            type="number"
            min={0}
            max={20}
            inputMode="numeric"
            className="field"
            value={value.maxCompanions}
            onChange={(e) => onChange({ ...value, maxCompanions: Math.max(0, Math.min(20, Number(e.target.value) || 0)) })}
          />
        </label>
      ) : null}

      <div>
        <p className="field-label">{t.questionsTitle}</p>
        <p className="field-hint !mt-0 mb-3">{t.questionsHint}</p>
        <ol className="space-y-3">
          {value.questions.map((q, i) => (
            <li key={i} className="space-y-3 rounded-sm border border-line bg-paper/60 p-3">
              <label className="block">
                <span className="field-label">{t.question} {i + 1}</span>
                <input className="field" maxLength={160} value={q.label} onChange={(e) => setQ(i, { label: e.target.value })} />
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="field-label">{t.type}</span>
                  <select className="field" value={q.type} onChange={(e) => setQ(i, { type: e.target.value as Q["type"] })}>
                    {(["text", "yesno", "choice"] as const).map((ty) => <option key={ty} value={ty}>{t.types[ty]}</option>)}
                  </select>
                </label>
                <label className="flex items-center gap-2.5 self-end pb-3 text-sm">
                  <input type="checkbox" className="h-4 w-4 accent-forest" checked={q.required} onChange={(e) => setQ(i, { required: e.target.checked })} />
                  {t.required}
                </label>
              </div>
              {q.type === "choice" ? (
                <label className="block">
                  <span className="field-label">{t.options}</span>
                  <input
                    className="field"
                    value={q.options.join(", ")}
                    onChange={(e) => setQ(i, { options: e.target.value.split(",").map((o) => o.trimStart()).slice(0, 8) })}
                  />
                  <span className="field-hint">{t.optionsHint}</span>
                </label>
              ) : null}
              <button type="button" className="btn btn-ghost btn-sm text-danger" onClick={() => onChange({ ...value, questions: value.questions.filter((_, j) => j !== i) })}>
                ✕ {t.remove}
              </button>
            </li>
          ))}
        </ol>
        {value.questions.length < 5 ? (
          <button
            type="button"
            className="btn btn-secondary btn-sm mt-3"
            onClick={() => onChange({ ...value, questions: [...value.questions, { id: "", label: "", type: "text", options: [], required: false }] })}
          >
            {t.addQuestion}
          </button>
        ) : null}
      </div>
    </div>
  );
}
