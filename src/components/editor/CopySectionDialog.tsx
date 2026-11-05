"use client";

import { useEffect, useState } from "react";
import { listTemplatesForCopy, templateSectionsForCopy } from "@/app/admin/modeles/actions";
import { REPEATABLE_SECTIONS, SECTION_LABELS, type InvitationContent, type InvitationSection } from "@/lib/invitation/schema";

/**
 * Copier une section (avec ses calques, couleurs, fond et réglages) depuis un autre modèle.
 * Une section unique déjà présente (ex. Dress code) peut être remplacée par la copie.
 */
export function CopySectionDialog({ lang, present, onCopy, onClose }: {
  lang: string;
  /** Types déjà présents dans l'invitation ouverte */
  present: InvitationSection["type"][];
  onCopy: (section: InvitationSection, mode: "add" | "replace", extra: { dressCode?: InvitationContent["dressCode"] }) => void;
  onClose: () => void;
}) {
  const [templates, setTemplates] = useState<{ id: string; name: string }[] | null>(null);
  const [templateId, setTemplateId] = useState("");
  const [sections, setSections] = useState<InvitationSection[] | null>(null);
  const [dressCode, setDressCode] = useState<InvitationContent["dressCode"] | undefined>();
  const [error, setError] = useState("");

  useEffect(() => {
    listTemplatesForCopy().then(setTemplates).catch(() => setError("Impossible de charger les modèles."));
  }, []);
  useEffect(() => {
    if (!templateId) return;
    setSections(null);
    setError("");
    templateSectionsForCopy(templateId, lang)
      .then((r) => {
        if (r.ok) {
          setSections(r.sections);
          setDressCode(r.dressCode);
        } else setError(r.message);
      })
      .catch(() => setError("Impossible de charger les sections."));
  }, [templateId, lang]);

  const name = (s: InvitationSection) => (s.title && !["hero", "closing"].includes(s.type) ? `${SECTION_LABELS[s.type]} — ${s.title}` : SECTION_LABELS[s.type]);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-charcoal/40 p-4" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <section role="dialog" aria-modal="true" aria-label="Copier une section d'un autre modèle" className="flex max-h-[85vh] w-[min(520px,100%)] flex-col rounded-sm bg-ivory shadow-2xl">
        <header className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 className="font-serif text-2xl">Copier une section</h2>
          <button type="button" onClick={onClose} aria-label="Fermer" className="px-2 text-xl text-stone hover:text-charcoal">×</button>
        </header>
        <div className="space-y-4 overflow-y-auto px-5 py-4">
          <label className="block">
            <span className="text-xs text-stone">Depuis le modèle</span>
            <select aria-label="Modèle source" className="field mt-1 text-sm" value={templateId} onChange={(e) => setTemplateId(e.target.value)}>
              <option value="">{templates ? "Choisir un modèle…" : "Chargement…"}</option>
              {templates?.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </label>
          {error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}
          {templateId && !sections && !error ? <p className="text-sm text-stone">Chargement des sections…</p> : null}
          {sections ? (
            <ul className="divide-y divide-line border-y border-line">
              {sections.map((s) => {
                const unique = !REPEATABLE_SECTIONS.includes(s.type);
                const exists = unique && present.includes(s.type);
                return (
                  <li key={s.id} className="flex items-center justify-between gap-3 py-2.5">
                    <span className="min-w-0 text-sm">
                      {name(s)}
                      <span className="block text-xs text-stone">
                        {s.layers.length} calque{s.layers.length > 1 ? "s" : ""}
                        {s.background.image ? " · image de fond" : ""}
                        {!s.visible ? " · masquée" : ""}
                      </span>
                    </span>
                    <span className="flex shrink-0 gap-2">
                      {exists ? (
                        <button type="button" className="btn btn-primary btn-sm" onClick={() => onCopy(s, "replace", { dressCode })} title="Remplace la section du même type dans ce modèle">
                          Remplacer la mienne
                        </button>
                      ) : null}
                      {!exists ? (
                        <button type="button" className="btn btn-primary btn-sm" onClick={() => onCopy(s, "add", { dressCode })}>
                          Ajouter
                        </button>
                      ) : null}
                    </span>
                  </li>
                );
              })}
            </ul>
          ) : null}
          <p className="text-xs text-stone">
            La section est copiée avec son design : calques, fond, couleurs, animations et textes. Pour le dress code, le texte et les couleurs sont aussi copiés si ceux du modèle ouvert sont vides. Les autres informations (programme, lieux, contacts…) restent celles du modèle ouvert.
          </p>
        </div>
      </section>
    </div>
  );
}
