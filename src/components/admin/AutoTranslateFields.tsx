"use client";

import { useRef, useState } from "react";
import { translateTexts } from "@/app/admin/traduction-actions";
import type { Language } from "@/lib/invitation/schema";

/**
 * Pré-remplit les cases vides d'une langue de la fiche avec la traduction automatique
 * des textes français (à relire, puis « Enregistrer la fiche »).
 */
export function AutoTranslateFields({ lang, sources }: { lang: Language; sources: Record<string, string> }) {
  const ref = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const run = async () => {
    const box = ref.current?.closest("details");
    if (!box) return;
    const todo = Object.entries(sources).filter(([field, src]) => {
      const el = box.querySelector<HTMLInputElement | HTMLTextAreaElement>(`[name="tr_${lang}_${field}"]`);
      return src.trim() && el && !el.value.trim();
    });
    if (!todo.length) {
      setMsg({ ok: true, text: "Toutes les cases sont déjà remplies." });
      return;
    }
    setBusy(true);
    setMsg(null);
    const res = await translateTexts(todo.map(([, s]) => s), "fr", lang).catch(() => ({ ok: false as const, message: "Connexion perdue." }));
    setBusy(false);
    if (!res.ok) {
      setMsg({ ok: false, text: res.message });
      return;
    }
    todo.forEach(([field], i) => {
      const el = box.querySelector<HTMLInputElement | HTMLTextAreaElement>(`[name="tr_${lang}_${field}"]`);
      if (el) el.value = (res.texts[i] ?? "").slice(0, el.maxLength > 0 ? el.maxLength : undefined);
    });
    setMsg({ ok: true, text: "Cases vides traduites : relisez-les puis cliquez sur « Enregistrer la fiche »." });
  };

  return (
    <div ref={ref} className="md:col-span-2 flex flex-wrap items-center gap-3" dir="ltr">
      <button type="button" className="btn btn-secondary btn-sm" disabled={busy} onClick={run}>
        {busy ? "Traduction…" : "Traduire automatiquement les cases vides"}
      </button>
      {msg ? <span role={msg.ok ? "status" : "alert"} className={`text-xs ${msg.ok ? "text-success" : "text-danger"}`}>{msg.text}</span> : null}
    </div>
  );
}
