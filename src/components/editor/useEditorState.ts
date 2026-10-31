"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { InvitationContent, InvitationContentInput } from "@/lib/invitation/schema";
import type { SaveResult } from "@/lib/save-result";

export type SaveState =
  | { kind: "saved"; at: string }
  | { kind: "dirty" }
  | { kind: "saving" }
  | { kind: "error"; message: string; issues?: string[] };

/** Contenu édité + annuler/rétablir + sauvegarde (automatique ou manuelle). */
export function useEditorState({
  initial,
  initialSavedAt,
  save: saveAction,
  autosave,
}: {
  initial: InvitationContent;
  initialSavedAt: string;
  save: (content: InvitationContentInput) => Promise<SaveResult>;
  autosave: boolean;
}) {
  const [content, setContent] = useState(initial);
  // Piles d'annulation tenues dans des refs : aucune mise à jour d'état imbriquée
  const past = useRef<InvitationContent[]>([]);
  const future = useRef<InvitationContent[]>([]);
  const [, setStackVersion] = useState(0);
  const bump = () => setStackVersion((v) => v + 1);
  const [save, setSave] = useState<SaveState>({ kind: "saved", at: initialSavedAt });
  const lastPush = useRef(0);
  const savedJson = useRef(JSON.stringify(initial));
  const latest = useRef(content);

  const commit = useCallback((next: InvitationContent) => {
    latest.current = next;
    setContent(next);
    bump();
  }, []);

  const update = useCallback(
    (fn: (c: InvitationContent) => InvitationContent) => {
      const prev = latest.current;
      const next = fn(prev);
      if (next === prev) return;
      // Les changements rapprochés (glisser, frappe) forment une seule étape d'annulation
      if (Date.now() - lastPush.current > 800) past.current = [...past.current.slice(-79), prev];
      lastPush.current = Date.now();
      future.current = [];
      commit(next);
    },
    [commit],
  );

  const undo = useCallback(() => {
    const prev = past.current.at(-1);
    if (!prev) return;
    past.current = past.current.slice(0, -1);
    future.current = [latest.current, ...future.current];
    lastPush.current = 0;
    commit(prev);
  }, [commit]);

  const redo = useCallback(() => {
    const [next, ...rest] = future.current;
    if (!next) return;
    future.current = rest;
    past.current = [...past.current, latest.current];
    lastPush.current = 0;
    commit(next);
  }, [commit]);

  const runSave = useCallback(async () => {
    setSave({ kind: "saving" });
    try {
      const snapshot = latest.current;
      const res = await saveAction(snapshot);
      if (res.ok) savedJson.current = JSON.stringify(snapshot);
      setSave(res.ok ? { kind: "saved", at: res.savedAt } : { kind: "error", message: res.message, issues: res.issues });
    } catch {
      setSave({ kind: "error", message: "Connexion perdue : rien n'a été enregistré. Réessayez." });
    }
  }, [saveAction]);

  /** Remplace le contenu par une version déjà enregistrée côté serveur (restauration). */
  const reset = useCallback(
    (next: InvitationContent, savedAt: string) => {
      past.current = [...past.current, latest.current];
      future.current = [];
      savedJson.current = JSON.stringify(next);
      lastPush.current = 0;
      commit(next);
      setSave({ kind: "saved", at: savedAt });
    },
    [commit],
  );

  useEffect(() => {
    if (JSON.stringify(content) === savedJson.current) return;
    setSave({ kind: "dirty" });
    if (!autosave) return;
    const t = window.setTimeout(runSave, 1500);
    return () => window.clearTimeout(t);
  }, [content, autosave, runSave]);

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (save.kind === "dirty" || save.kind === "saving") e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [save.kind]);

  return { content, update, undo, redo, canUndo: past.current.length > 0, canRedo: future.current.length > 0, save, runSave, reset };
}
