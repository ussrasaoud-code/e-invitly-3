"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Logo } from "@/components/brand/Logo";
import type { SiteDict } from "@/lib/i18n/dict";
import { useHref } from "./LangContext";
import { LanguageSwitcher } from "./LanguageSwitcher";

export function SiteHeader({ t }: { t: SiteDict["nav"] }) {
  const href = useHref();
  const NAV = [
    { href: href("/invitations"), label: t.invitations },
    { href: href("/#comment-ca-marche"), label: t.howItWorks },
    { href: href("/#avantages"), label: t.benefits },
    { href: href("/#faq"), label: t.faq },
  ];
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  useEffect(() => setOpen(false), [pathname]);

  return (
    <header className="sticky top-0 z-40 border-b border-line/70 bg-ivory/90 backdrop-blur supports-[backdrop-filter]:bg-ivory/75">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-6 px-5 lg:h-20">
        <Logo priority className="h-8 shrink-0 lg:h-10" href={href("/")} />
        <nav aria-label={t.main} className="hidden items-center gap-6 xl:flex">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className="whitespace-nowrap text-[0.78rem] uppercase tracking-[0.18em] text-charcoal/80 transition-colors hover:text-forest">
              {n.label}
            </Link>
          ))}
          <LanguageSwitcher label={t.language} title={t.languageTitle} />
          <Link href={href("/invitations")} className="btn btn-primary btn-sm whitespace-nowrap">
            {t.choose}
          </Link>
          <Link href="/mon-espace" className="btn btn-secondary btn-sm gap-2" title={t.clientSpace}>
            <UserIcon />
            <span className="whitespace-nowrap">{t.clientSpace}</span>
          </Link>
        </nav>
        <div className="-me-2 flex items-center xl:hidden">
        <LanguageSwitcher label={t.language} title={t.languageTitle} />
        <Link href="/mon-espace" className="flex h-11 w-11 items-center justify-center text-forest" aria-label={t.clientSpace} title={t.clientSpace}>
          <UserIcon className="h-6 w-6" />
        </Link>
        <button
          type="button"
          className="flex h-11 w-11 items-center justify-center"
          aria-expanded={open}
          aria-controls="menu-mobile"
          aria-label={open ? t.close : t.open}
          onClick={() => setOpen((o) => !o)}
        >
          <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden="true">
            {open ? (
              <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="1.4" />
            ) : (
              <path d="M4 8h16M4 16h16" stroke="currentColor" strokeWidth="1.4" />
            )}
          </svg>
        </button>
        </div>
      </div>
      {open ? (
        <nav id="menu-mobile" aria-label={t.mobile} className="border-t border-line bg-ivory px-5 pb-6 xl:hidden">
          <ul className="divide-y divide-line">
            {NAV.map((n) => (
              <li key={n.href}>
                <Link href={n.href} className="block py-4 text-sm uppercase tracking-[0.18em]" onClick={() => setOpen(false)}>
                  {n.label}
                </Link>
              </li>
            ))}
          </ul>
          <Link href={href("/invitations")} className="btn btn-primary mt-4 w-full">
            {t.choose}
          </Link>
          <Link href="/mon-espace" className="btn btn-secondary mt-3 w-full gap-2">
            <UserIcon />
            {t.clientSpace}
          </Link>
        </nav>
      ) : null}
    </header>
  );
}

function UserIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="none" stroke="currentColor" strokeWidth={1.6}>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20.5c1.4-3.6 4.4-5.5 8-5.5s6.6 1.9 8 5.5" strokeLinecap="round" />
    </svg>
  );
}
