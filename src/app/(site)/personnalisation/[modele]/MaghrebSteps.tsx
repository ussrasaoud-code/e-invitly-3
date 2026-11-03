"use client";

import { SelectField, TextArea, TextField } from "@/components/ui/Field";
import type { SiteDict } from "@/lib/i18n/dict";
import type { MaghrebInput, MomentAudience } from "@/lib/validation/request";

type T = SiteDict["request"];
type M = Required<MaghrebInput>;
type Henna = NonNullable<MaghrebInput["henna"]>;
type Soiree = NonNullable<MaghrebInput["soiree"]>;
type Extra = NonNullable<MaghrebInput["fatiha"]>;
type Other = NonNullable<MaghrebInput["others"]>[number];

export const emptyExtra = (audience: MomentAudience = "all"): Extra => ({ enabled: false, date: "", venueName: "", address: "", mapsUrl: "", time: "", audience, notes: "" });

export const emptyMaghreb = (): M => ({
  separateGuests: "unknown",
  henna: { enabled: true, date: "", venueName: "", address: "", mapsUrl: "", hammamTime: "", hammamAudience: "hidden", hammamPlace: "", hennaTime: "", chantTime: "", dinnerTime: "", notes: "" },
  soiree: { date: "", venueName: "", address: "", mapsUrl: "", receptionTime: "", brideTime: "", teaTime: "", dinnerTime: "", cakeTime: "", endTime: "", notes: "", parking: "", shuttles: "", lodging: "" },
  fatiha: emptyExtra("all"),
  lendemain: emptyExtra("henna"),
  others: [],
  decoration: { known: "later", colors: "", theme: "" },
});

type Props = { m: M; set: (patch: Partial<M>) => void; t: T; e: (key: string) => string | undefined };

function Radio({ name, value, current, onChange, children }: { name: string; value: string; current: string | undefined; onChange: (v: string) => void; children: React.ReactNode }) {
  return (
    <label className={`flex min-h-11 cursor-pointer items-center gap-3 rounded-sm border px-4 py-2 text-sm transition ${current === value ? "border-forest bg-sage-soft" : "border-line bg-white hover:border-forest"}`}>
      <input type="radio" name={name} value={value} checked={current === value} onChange={() => onChange(value)} className="h-4 w-4 accent-forest" />
      {children}
    </label>
  );
}

function Audience({ value, onChange, t, label }: { value: MomentAudience | undefined; onChange: (v: MomentAudience) => void; t: T; label?: string }) {
  const g = t.mag;
  return (
    <SelectField
      label={label ?? g.audience}
      value={value ?? "all"}
      onChange={(ev) => onChange(ev.target.value as MomentAudience)}
      options={[
        { value: "all", label: g.audAll },
        { value: "henna", label: g.audHenna },
        { value: "hidden", label: g.audHidden },
      ]}
    />
  );
}

/** Étape « Le henné » : qui est invité où, puis le matin (hammam) et le soir (henné, chants, dîner). */
export function HennaStep({ m, set, t, e }: Props) {
  const g = t.mag;
  const f = t.f;
  const h = m.henna as Henna;
  const setH = (patch: Partial<Henna>) => set({ henna: { ...h, ...patch } });
  return (
    <div className="space-y-8">
      <fieldset className="card p-5">
        <legend className="px-1 font-serif text-xl">{g.separateQ}</legend>
        <div className="mt-2 grid gap-2">
          <Radio name="separate" value="yes" current={m.separateGuests} onChange={(v) => set({ separateGuests: v as M["separateGuests"] })}>{g.separateYes}</Radio>
          <Radio name="separate" value="no" current={m.separateGuests} onChange={(v) => set({ separateGuests: v as M["separateGuests"] })}>{g.separateNo}</Radio>
          <Radio name="separate" value="unknown" current={m.separateGuests} onChange={(v) => set({ separateGuests: v as M["separateGuests"] })}>{g.separateUnknown}</Radio>
        </div>
        <p className="mt-3 text-sm leading-relaxed text-stone">{g.separateHint}</p>
      </fieldset>

      <label className="flex min-h-11 items-center gap-3 text-sm">
        <input type="checkbox" className="h-5 w-5 accent-forest" checked={h.enabled !== false} onChange={(ev) => setH({ enabled: ev.target.checked })} />
        {g.hennaEnabled}
      </label>

      {h.enabled !== false ? (
        <>
          <div className="grid gap-5 sm:grid-cols-2">
            <TextField label={g.hennaDate} type="date" value={h.date} onChange={(ev) => setH({ date: ev.target.value })} error={e("maghreb.henna.date")} required />
            <TextField label={g.hennaVenue} value={h.venueName} onChange={(ev) => setH({ venueName: ev.target.value })} optional />
            <TextField label={f.fullAddress} value={h.address} onChange={(ev) => setH({ address: ev.target.value })} optional className="sm:col-span-2" />
            <TextField label={f.mapsUrl} type="url" inputMode="url" value={h.mapsUrl} onChange={(ev) => setH({ mapsUrl: ev.target.value })} error={e("maghreb.henna.mapsUrl")} optional className="sm:col-span-2" />
          </div>
          <fieldset className="card p-5">
            <legend className="px-1 font-serif text-xl">{g.morning}</legend>
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField label={g.hammamTime} type="time" value={h.hammamTime} onChange={(ev) => setH({ hammamTime: ev.target.value })} error={e("maghreb.henna.hammamTime")} optional />
              <TextField label={g.hammamPlace} value={h.hammamPlace} onChange={(ev) => setH({ hammamPlace: ev.target.value })} optional />
              <div className="sm:col-span-2">
                <Audience label={g.hammamAudience} value={h.hammamAudience} onChange={(v) => setH({ hammamAudience: v })} t={t} />
              </div>
            </div>
          </fieldset>
          <fieldset className="card p-5">
            <legend className="px-1 font-serif text-xl">{g.evening}</legend>
            <div className="grid gap-4 sm:grid-cols-3">
              <TextField label={g.hennaTime} type="time" value={h.hennaTime} onChange={(ev) => setH({ hennaTime: ev.target.value })} error={e("maghreb.henna.hennaTime")} optional />
              <TextField label={g.chantTime} type="time" value={h.chantTime} onChange={(ev) => setH({ chantTime: ev.target.value })} error={e("maghreb.henna.chantTime")} optional />
              <TextField label={g.hennaDinner} type="time" value={h.dinnerTime} onChange={(ev) => setH({ dinnerTime: ev.target.value })} error={e("maghreb.henna.dinnerTime")} optional />
            </div>
          </fieldset>
          <TextArea label={g.notesDay} value={h.notes} onChange={(ev) => setH({ notes: ev.target.value })} optional />
        </>
      ) : null}
    </div>
  );
}

/** Étape « La soirée » : accueil, entrée de la mariée, goûter, dîner, pièce montée, infos pratiques. */
export function SoireeStep({ m, set, t, e }: Props) {
  const g = t.mag;
  const f = t.f;
  const s = m.soiree as Soiree;
  const setS = (patch: Partial<Soiree>) => set({ soiree: { ...s, ...patch } });
  const timeField = (key: keyof Soiree, label: string, hint?: string) => (
    <TextField label={label} type="time" value={s[key] as string} onChange={(ev) => setS({ [key]: ev.target.value })} error={e(`maghreb.soiree.${key}`)} optional hint={hint} />
  );
  return (
    <div className="space-y-6">
      <p className="leading-relaxed text-stone">{g.soireeIntro}</p>
      <div className="grid gap-5 sm:grid-cols-2">
        <TextField label={g.soireeVenue} value={s.venueName} onChange={(ev) => setS({ venueName: ev.target.value })} optional />
        <TextField label={f.fullAddress} autoComplete="street-address" value={s.address} onChange={(ev) => setS({ address: ev.target.value })} optional />
        <TextField label={f.mapsUrl} type="url" inputMode="url" value={s.mapsUrl} onChange={(ev) => setS({ mapsUrl: ev.target.value })} error={e("maghreb.soiree.mapsUrl")} optional className="sm:col-span-2" />
      </div>
      <div className="grid gap-5 sm:grid-cols-3">
        {timeField("receptionTime", g.receptionTime)}
        {timeField("brideTime", g.brideTime, g.brideHint)}
        {timeField("teaTime", g.teaTime)}
        {timeField("dinnerTime", g.dinnerTime)}
        {timeField("cakeTime", g.cakeTime)}
        {timeField("endTime", g.endTime)}
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <TextArea label={g.notesDay} value={s.notes} onChange={(ev) => setS({ notes: ev.target.value })} optional className="sm:col-span-2" />
        <TextArea label={f.parking} value={s.parking} onChange={(ev) => setS({ parking: ev.target.value })} optional />
        <TextArea label={f.shuttles} value={s.shuttles} onChange={(ev) => setS({ shuttles: ev.target.value })} optional />
        <TextArea label={f.lodging} value={s.lodging} onChange={(ev) => setS({ lodging: ev.target.value })} optional className="sm:col-span-2" />
      </div>
    </div>
  );
}

function MomentFields({ x, onChange, t, e, prefix, label }: { x: Extra | Other; onChange: (patch: Partial<Other>) => void; t: T; e: Props["e"]; prefix: string; label?: boolean }) {
  const g = t.mag;
  const f = t.f;
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {label ? (
        <TextField label={g.momentName} value={(x as Other).label} onChange={(ev) => onChange({ label: ev.target.value })} error={e(`${prefix}.label`)} placeholder={g.momentNamePh} required className="sm:col-span-2" />
      ) : null}
      <TextField label={g.date} type="date" value={x.date} onChange={(ev) => onChange({ date: ev.target.value })} error={e(`${prefix}.date`)} optional />
      <TextField label={g.time} type="time" value={x.time} onChange={(ev) => onChange({ time: ev.target.value })} error={e(`${prefix}.time`)} optional />
      <TextField label={f.venue} value={x.venueName} onChange={(ev) => onChange({ venueName: ev.target.value })} optional />
      <TextField label={f.address} value={x.address} onChange={(ev) => onChange({ address: ev.target.value })} optional />
      <div className="sm:col-span-2">
        <Audience value={x.audience} onChange={(v) => onChange({ audience: v })} t={t} />
      </div>
      <TextArea label={f.notes} value={x.notes} onChange={(ev) => onChange({ notes: ev.target.value })} optional className="sm:col-span-2" />
    </div>
  );
}

/** Étape « Autres moments » : Fatiha, lendemain et moments libres (facultatifs). */
export function MomentsStep({ m, set, t, e }: Props) {
  const g = t.mag;
  const others = (m.others ?? []) as Other[];
  const toggle = (key: "fatiha" | "lendemain", title: string) => {
    const x = m[key] as Extra;
    return (
      <fieldset className="card p-5">
        <legend className="px-1 font-serif text-xl">{title}</legend>
        <label className="flex min-h-11 items-center gap-3 text-sm">
          <input type="checkbox" className="h-5 w-5 accent-forest" checked={!!x.enabled} onChange={(ev) => set({ [key]: { ...x, enabled: ev.target.checked } })} />
          {title}
        </label>
        {x.enabled ? <div className="mt-3"><MomentFields x={x} onChange={(p) => set({ [key]: { ...x, ...p } })} t={t} e={e} prefix={`maghreb.${key}`} /></div> : null}
      </fieldset>
    );
  };
  return (
    <div className="space-y-6">
      <p className="leading-relaxed text-stone">{g.momentsIntro}</p>
      {toggle("fatiha", g.fatiha)}
      {toggle("lendemain", g.lendemain)}
      {others.map((o, i) => (
        <fieldset key={i} className="card p-5">
          <legend className="px-1 font-serif text-xl">{o.label || g.momentName}</legend>
          <MomentFields x={o} label onChange={(p) => set({ others: others.map((x, j) => (j === i ? { ...x, ...p } : x)) })} t={t} e={e} prefix={`maghreb.others.${i}`} />
          <button type="button" className="btn btn-ghost btn-sm mt-3 text-danger" onClick={() => set({ others: others.filter((_, j) => j !== i) })}>{g.removeMoment}</button>
        </fieldset>
      ))}
      {others.length < 4 ? (
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => set({ others: [...others, { ...emptyExtra("all"), enabled: true, label: "" }] })}>
          {g.addMoment}
        </button>
      ) : null}
    </div>
  );
}

/** Décoration de la salle (avant les détails communs). */
export function DecorationFields({ m, set, t }: Props) {
  const g = t.mag;
  const d = m.decoration as NonNullable<MaghrebInput["decoration"]>;
  const setD = (patch: Partial<typeof d>) => set({ decoration: { ...d, ...patch } });
  return (
    <fieldset className="card mb-8 p-5">
      <legend className="px-1 font-serif text-xl">{g.decoQ}</legend>
      <div className="mt-2 grid gap-2 sm:grid-cols-3">
        <Radio name="deco" value="yes" current={d.known} onChange={(v) => setD({ known: v as typeof d.known })}>{g.decoYes}</Radio>
        <Radio name="deco" value="no" current={d.known} onChange={(v) => setD({ known: v as typeof d.known })}>{g.decoNo}</Radio>
        <Radio name="deco" value="later" current={d.known} onChange={(v) => setD({ known: v as typeof d.known })}>{g.decoLater}</Radio>
      </div>
      {d.known === "yes" ? (
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <TextField label={g.decoColors} value={d.colors} onChange={(ev) => setD({ colors: ev.target.value })} placeholder={g.decoColorsPh} optional />
          <TextField label={g.decoTheme} value={d.theme} onChange={(ev) => setD({ theme: ev.target.value })} placeholder={g.decoThemePh} optional />
        </div>
      ) : null}
      <p className="mt-3 text-sm text-stone">{g.decoHint}</p>
    </fieldset>
  );
}
