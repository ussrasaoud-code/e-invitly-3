"use client";

import { createContext, useContext } from "react";
import { DEFAULT_LANG, localePath, type SiteLang } from "@/lib/i18n/config";

type Ctx = { lang: SiteLang; enabled: SiteLang[]; path: string };
const LangContext = createContext<Ctx>({ lang: DEFAULT_LANG, enabled: [DEFAULT_LANG], path: "/" });

export function LangProvider({ value, children }: { value: Ctx; children: React.ReactNode }) {
  return <LangContext.Provider value={value}>{children}</LangContext.Provider>;
}

export const useLang = () => useContext(LangContext);

/** Lien interne dans la langue courante : href("/invitations") → "/en/invitations" */
export function useHref() {
  const { lang } = useLang();
  return (path: string) => localePath(lang, path);
}
