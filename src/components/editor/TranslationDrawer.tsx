"use client";

import { useMemo, useState } from "react";
import { translateTexts } from "@/app/admin/traduction-actions";
import { LANG_META } from "@/lib/i18n/config";
import type { InvitationContent, Language } from "@/lib/invitation/schema";
import { setText, translationRows, type TextRow } from "@/lib/invitation/texts";

export type TranslationSetup = { main: InvitationContent; mainLang: Language; lang: Language };

/** Nombre de textes encore identiques à la version principale */
export function remainingCount(main: InvitationContent, content: InvitationContent) {
  return translationRows(main, content).filter((r) => r.todo).length;
}

/**
 * Tous les textes du modèle au même endroit : texte d'origine à gauche, traduction à droite,
 * avec pré-remplissage automatique (DeepL) à relire.
 */
export function TranslationDrawer({ setup, content, update, onClose }: {
  setup: TranslationSetup;
  content: InvitationContent;
  update: (fn: (c: InvitationContent) => InvitationContent) => void;
  onClose: () => void;
}) {
  const rows = useMemo(() => translationRows(setup.main, content), [setup.main, content]);
  const [onlyTodo, setOnlyTodo] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const todo = rows.filter((r) => r.todo);
  const autoTodo = todo.filter((r) => r.auto);
  const shown = onlyTodo ? todo : rows;
  const groups = [...new Set(shown.map((r) => r.group))];
  const from = LANG_META[setup.mainLang];
  const to = LANG_META[setup.lang];

  const run = async (list: TextRow[], id: string) => {
    if (!list.length) return;
    setBusy(id);
    setMessage(null);
    const res = await translateTexts(list.map((r) => r.source), setup.mainLang, setup.lang).catch(() => ({ ok: false as const, message: "Connexion perdue." }));
    setBusy(null);
    if (!res.ok) {
      setMessage({ ok: false, text: res.message });
      return;
    }
    update((c) => list.reduce((acc, r, i) => setText(acc, r, res.texts[i] ?? r.source), c));
    setMessage({ ok: true, text: `${list.length} texte${list.length > 1 ? "s" : ""} traduit${list.length > 1 ? "s" : ""} : relisez-les avant d'enregistrer.` });
  };

  return (
    <div className="fixed inset-0 z-[60] flex justify-end bg-charcoal/40" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <section role="dialog" aria-modal="true" aria-label="Textes à traduire" className="flex h-full w-[min(640px,100vw)] flex-col bg-ivory shadow-2xl">
        <header className="space-y-3 border-b border-line px-5 py-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-serif text-2xl">Textes à traduire</h2>
            <button type="button" onClick={onClose} aria-label="Fermer" className="px-2 text-xl text-stone hover:text-charcoal">×</button>
          </div>
          <p className="text-sm text-stone">
            {from.native} → {to.native} · <strong className="font-medium text-charcoal">{rows.length - todo.length} / {rows.length}</strong> traduits
            {todo.length ? <> · {todo.length} restant{todo.length > 1 ? "s" : ""}</> : " · tout est traduit ✓"}
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" className="btn btn-primary btn-sm" disabled={!autoTodo.length || !!busy} onClick={() => run(autoTodo, "all")}>
              {busy === "all" ? "Traduction…" : `Traduire automatiquement${autoTodo.length ? ` (${autoTodo.length})` : ""}`}
            </button>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" className="h-4 w-4 accent-forest" checked={onlyTodo} onChange={(e) => setOnlyTodo(e.target.checked)} />
              Seulement les textes à traduire
            </label>
          </div>
          <p className="text-xs text-stone">Les prénoms, adresses et le cachet ne sont pas traduits automatiquement : adaptez-les vous-même si besoin.</p>
          {message ? (
            <p role={message.ok ? "status" : "alert"} className={`text-sm ${message.ok ? "text-success" : "text-danger"}`}>{message.text}</p>
          ) : null}
        </header>
        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-5 py-4">
          {groups.map((g) => (
            <fieldset key={g} className="space-y-3">
              <legend className="mb-1 text-[0.7rem] uppercase tracking-wider text-stone">{g}</legend>
              {shown.filter((r) => r.group === g).map((r) => (
                <div key={r.key} className={`grid gap-2 rounded-sm border p-2.5 sm:grid-cols-2 ${r.todo ? "border-warning/50 bg-[#fbf3e2]" : "border-line bg-paper"}`}>
                  <div className="min-w-0">
                    <p className="text-xs font-medium">{r.label}</p>
                    <p dir="auto" className="mt-1 whitespace-pre-line break-words text-sm text-stone">{r.source || "—"}</p>
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <label htmlFor={`tr-${r.key}`} className="text-xs text-stone">{to.native}</label>
                      {r.source.trim() ? (
                        <button type="button" className="text-xs underline underline-offset-2 hover:text-forest disabled:opacity-50" disabled={!!busy} onClick={() => run([r], r.key)}>
                          {busy === r.key ? "…" : "Traduire"}
                        </button>
                      ) : null}
                    </div>
                    {r.multiline || r.value.length > 60 ? (
                      <textarea id={`tr-${r.key}`} dir="auto" rows={Math.min(6, Math.max(2, Math.ceil(r.value.length / 45)))} maxLength={r.max} className="field mt-1 text-sm" value={r.value} onChange={(e) => update((c) => setText(c, r, e.target.value))} />
                    ) : (
                      <input id={`tr-${r.key}`} dir="auto" maxLength={r.max} className="field mt-1 text-sm" value={r.value} onChange={(e) => update((c) => setText(c, r, e.target.value))} />
                    )}
                  </div>
                </div>
              ))}
            </fieldset>
          ))}
          {!shown.length ? <p className="text-sm text-stone">Aucun texte à afficher.</p> : null}
        </div>
      </section>
    </div>
  );
}
