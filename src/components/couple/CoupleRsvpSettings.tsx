"use client";

import { useState } from "react";
import { saveCoupleRsvp } from "@/app/mon-espace/actions";
import { RsvpChoicesEditor } from "@/components/rsvp/RsvpChoicesEditor";
import type { SiteDict } from "@/lib/i18n/dict";
import { DEFAULT_RSVP_FIELDS, type RsvpChoices } from "@/lib/rsvp";

/** Espace des mariés : ce que leurs invités renseignent en répondant. */
export function CoupleRsvpSettings({ invitationId, initial, initialDeadline, initialOpen, t }: {
  invitationId: string;
  initial: RsvpChoices;
  initialDeadline: string;
  initialOpen: boolean;
  t: SiteDict["rsvpSetup"];
}) {
  const [choices, setChoices] = useState(initial);
  const [deadline, setDeadline] = useState(initialDeadline);
  const [open, setOpen] = useState(initialOpen);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const save = async () => {
    setBusy(true);
    setMsg(null);
    const res = await saveCoupleRsvp(invitationId, { choices, deadline, open }).catch(() => ({ ok: false as const, error: "server" as const }));
    setBusy(false);
    if (res.ok) setMsg({ ok: true, text: t.saved });
    else if (res.error === "choice" && "label" in res) setMsg({ ok: false, text: t.errorChoice.replace("{label}", res.label ?? "") });
    else setMsg({ ok: false, text: t.error });
  };

  return (
    <section className="card mt-10 p-5 sm:p-6" aria-labelledby="rsvp-settings">
      <h2 id="rsvp-settings" className="font-serif text-2xl">{t.coupleTitle}</h2>
      <p className="mt-1 text-sm text-stone">{t.coupleHint}</p>
      <div className="mt-5">
        <RsvpChoicesEditor value={choices} onChange={setChoices} t={t} defaults={DEFAULT_RSVP_FIELDS} />
      </div>
      <div className="mt-6 grid gap-4 border-t border-line pt-5 sm:grid-cols-2">
        <label className="block">
          <span className="field-label">{t.deadline}</span>
          <input type="date" className="field" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
        </label>
        <label className="flex items-center gap-2.5 self-end pb-3 text-sm">
          <input type="checkbox" className="h-4 w-4 accent-forest" checked={open} onChange={(e) => setOpen(e.target.checked)} />
          {t.open}
        </label>
      </div>
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button type="button" className="btn btn-primary" disabled={busy} onClick={save}>{busy ? t.saving : t.save}</button>
        {msg ? <p role={msg.ok ? "status" : "alert"} className={`text-sm ${msg.ok ? "text-success" : "text-danger"}`}>{msg.text}</p> : null}
      </div>
    </section>
  );
}
