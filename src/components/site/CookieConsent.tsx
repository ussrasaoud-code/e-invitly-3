"use client";

import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import type { SiteDict } from "@/lib/i18n/dict";

type T = SiteDict["cookies"];
type Choice = { v: 1; analytics: boolean; marketing: boolean; at: string };

const COOKIE = "ei-consent";
/** Le choix est conservé 6 mois, puis redemandé (recommandation de la CNIL). */
const MAX_AGE = 60 * 60 * 24 * 182;
export const OPEN_EVENT = "ei:cookies";

function readChoice(): Choice | null {
  try {
    const raw = document.cookie.split("; ").find((c) => c.startsWith(`${COOKIE}=`))?.slice(COOKIE.length + 1);
    if (!raw) return null;
    const c = JSON.parse(decodeURIComponent(raw)) as Choice;
    return c?.v === 1 ? c : null;
  } catch {
    return null;
  }
}

function writeChoice(c: Choice) {
  document.cookie = `${COOKIE}=${encodeURIComponent(JSON.stringify(c))}; Max-Age=${MAX_AGE}; Path=/; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`;
}

/** Retire les cookies déposés par les outils quand le visiteur retire son accord. */
function clearTrackers(prefixes: string[]) {
  const host = location.hostname;
  const domains = ["", host, `.${host}`, `.${host.split(".").slice(-2).join(".")}`];
  for (const c of document.cookie.split("; ")) {
    const name = c.split("=")[0];
    if (prefixes.some((p) => name.startsWith(p))) {
      for (const d of domains) document.cookie = `${name}=; Max-Age=0; Path=/${d ? `; Domain=${d}` : ""}`;
    }
  }
}

type W = Window & { dataLayer?: unknown[]; gtag?: (...a: unknown[]) => void; fbq?: ((...a: unknown[]) => void) & { callMethod?: unknown; queue?: unknown[]; loaded?: boolean; version?: string; push?: unknown } };

function loadGa(id: string) {
  const w = window as W;
  if (w.gtag) return;
  w.dataLayer = w.dataLayer || [];
  w.gtag = function gtag() {
    // eslint-disable-next-line prefer-rest-params
    w.dataLayer!.push(arguments);
  };
  w.gtag("js", new Date());
  w.gtag("config", id, { send_page_view: false });
  const s = document.createElement("script");
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`;
  document.head.appendChild(s);
}

function loadPixel(id: string) {
  const w = window as W;
  if (w.fbq) return;
  const fbq = function (...args: unknown[]) {
    if (fbq.callMethod) (fbq.callMethod as (...a: unknown[]) => void)(...args);
    else fbq.queue!.push(args);
  } as NonNullable<W["fbq"]>;
  fbq.push = fbq;
  fbq.loaded = true;
  fbq.version = "2.0";
  fbq.queue = [];
  w.fbq = fbq;
  const s = document.createElement("script");
  s.async = true;
  s.src = "https://connect.facebook.net/en_US/fbevents.js";
  document.head.appendChild(s);
  fbq("init", id);
}

type Pending = { name: "lead" | "checkout" | "purchase"; params: { value?: number; currency?: string; id?: string; item?: string } };
type QW = Window & { __eiEvents?: Pending[] };

/**
 * Événement de conversion (commande, paiement) : envoyé seulement aux outils acceptés
 * par le visiteur. Mis en file s'ils ne sont pas encore chargés.
 */
export function trackConversion(e: Pending) {
  const w = window as QW;
  (w.__eiEvents ??= []).push(e);
  window.dispatchEvent(new Event("ei:track"));
}

function flush(choice: Choice | null) {
  const w = window as QW & W;
  const list = w.__eiEvents ?? [];
  if (!choice || !list.length) return;
  w.__eiEvents = [];
  for (const e of list) {
    const { value, currency = "EUR", id, item } = e.params;
    if (choice.marketing && w.fbq) {
      if (e.name === "lead") w.fbq("track", "InitiateCheckout", { value, currency, content_name: item });
      if (e.name === "purchase") w.fbq("track", "Purchase", { value, currency, content_name: item }, id ? { eventID: id } : undefined);
    }
    if (choice.analytics && w.gtag) {
      if (e.name === "lead") w.gtag("event", "begin_checkout", { value, currency, items: item ? [{ item_name: item }] : [] });
      if (e.name === "purchase") w.gtag("event", "purchase", { transaction_id: id, value, currency, items: item ? [{ item_name: item }] : [] });
    }
  }
}

/**
 * Bandeau de consentement du site vitrine. Rien n'est chargé avant l'accord :
 * Google Analytics (mesure d'audience) et le pixel Meta (publicité) sont deux choix séparés.
 * « Tout refuser » est aussi simple que « Tout accepter ».
 */
export function CookieConsent({ gaId, pixelId, t, privacyHref }: { gaId: string; pixelId: string; t: T; privacyHref: string }) {
  const enabled = !!gaId || !!pixelId;
  const [choice, setChoice] = useState<Choice | null>(null);
  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState(false);
  const [draft, setDraft] = useState({ analytics: false, marketing: false });
  const pathname = usePathname();
  const lastPath = useRef<string | null>(null);

  useEffect(() => {
    if (!enabled) return;
    const c = readChoice();
    setChoice(c);
    if (!c) setOpen(true);
    const reopen = () => {
      const cur = readChoice();
      setDraft({ analytics: !!cur?.analytics, marketing: !!cur?.marketing });
      setCustom(true);
      setOpen(true);
    };
    window.addEventListener(OPEN_EVENT, reopen);
    return () => window.removeEventListener(OPEN_EVENT, reopen);
  }, [enabled]);

  // Chargement des outils acceptés, puis une page vue par changement de page
  useEffect(() => {
    if (!choice) return;
    if (choice.analytics && gaId) loadGa(gaId);
    if (choice.marketing && pixelId) loadPixel(pixelId);
    if (lastPath.current === pathname) return;
    lastPath.current = pathname;
    const w = window as W;
    if (choice.analytics && gaId) w.gtag?.("event", "page_view", { page_path: pathname, page_location: location.href, page_title: document.title });
    if (choice.marketing && pixelId) w.fbq?.("track", "PageView");
  }, [choice, gaId, pixelId, pathname]);

  // Conversions en attente : envoyées après le chargement des outils acceptés
  useEffect(() => {
    flush(choice);
    const onTrack = () => flush(readChoice());
    window.addEventListener("ei:track", onTrack);
    return () => window.removeEventListener("ei:track", onTrack);
  }, [choice]);

  const save = useCallback(
    (analytics: boolean, marketing: boolean) => {
      const prev = readChoice();
      const c: Choice = { v: 1, analytics: !!gaId && analytics, marketing: !!pixelId && marketing, at: new Date().toISOString() };
      writeChoice(c);
      setOpen(false);
      setCustom(false);
      // Accord retiré : on efface les cookies des outils et on recharge pour les décharger
      const withdrawn = (prev?.analytics && !c.analytics) || (prev?.marketing && !c.marketing);
      if (withdrawn) {
        if (prev?.analytics && !c.analytics) clearTrackers(["_ga", "_gid", "_gat"]);
        if (prev?.marketing && !c.marketing) clearTrackers(["_fbp", "_fbc"]);
        location.reload();
        return;
      }
      setChoice(c);
    },
    [gaId, pixelId],
  );

  if (!enabled || !open) return null;
  return (
    <section
      role="dialog"
      aria-modal="false"
      aria-labelledby="cookies-title"
      className="fixed inset-x-3 bottom-3 z-[70] mx-auto max-w-2xl rounded-sm border border-line bg-ivory p-5 shadow-2xl sm:inset-x-6 sm:bottom-6"
    >
      <h2 id="cookies-title" className="font-serif text-2xl">{t.title}</h2>
      <p className="mt-2 text-sm leading-relaxed text-stone">
        {t.text}{" "}
        <a href={privacyHref} className="text-forest underline underline-offset-4">{t.privacy}</a>
      </p>
      {custom ? (
        <ul className="mt-4 space-y-3 text-sm">
          <li className="flex items-start gap-3">
            <input type="checkbox" checked disabled className="mt-0.5 h-5 w-5 shrink-0 accent-forest" aria-describedby="ck-needed" />
            <span id="ck-needed"><strong className="font-medium">{t.needed}</strong><span className="block text-stone">{t.neededText}</span></span>
          </li>
          {gaId ? (
            <li>
              <label className="flex items-start gap-3">
                <input type="checkbox" checked={draft.analytics} onChange={(e) => setDraft((d) => ({ ...d, analytics: e.target.checked }))} className="mt-0.5 h-5 w-5 shrink-0 accent-forest" />
                <span><strong className="font-medium">{t.analytics}</strong><span className="block text-stone">{t.analyticsText}</span></span>
              </label>
            </li>
          ) : null}
          {pixelId ? (
            <li>
              <label className="flex items-start gap-3">
                <input type="checkbox" checked={draft.marketing} onChange={(e) => setDraft((d) => ({ ...d, marketing: e.target.checked }))} className="mt-0.5 h-5 w-5 shrink-0 accent-forest" />
                <span><strong className="font-medium">{t.marketing}</strong><span className="block text-stone">{t.marketingText}</span></span>
              </label>
            </li>
          ) : null}
        </ul>
      ) : null}
      <div className="mt-5 grid gap-2 sm:grid-cols-3">
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => save(false, false)}>{t.refuse}</button>
        {custom ? (
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => save(draft.analytics, draft.marketing)}>{t.save}</button>
        ) : (
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => setCustom(true)}>{t.customize}</button>
        )}
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => save(true, true)}>{t.accept}</button>
      </div>
    </section>
  );
}

/** Lien « Gérer les cookies » (pied de page) : rouvre le bandeau. */
export function CookieSettingsLink({ label, className }: { label: string; className?: string }) {
  return (
    <button type="button" className={className} onClick={() => window.dispatchEvent(new Event(OPEN_EVENT))}>
      {label}
    </button>
  );
}
