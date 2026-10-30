"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Logo } from "@/components/brand/Logo";

const NAV = [
  { href: "/invitations", label: "Invitations" },
  { href: "/#comment-ca-marche", label: "Comment ça marche" },
  { href: "/#avantages", label: "Avantages" },
  { href: "/#faq", label: "FAQ" },
];

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  useEffect(() => setOpen(false), [pathname]);

  return (
    <header className="sticky top-0 z-40 border-b border-line/70 bg-ivory/90 backdrop-blur supports-[backdrop-filter]:bg-ivory/75">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 md:h-20">
        <Logo />
        <nav aria-label="Navigation principale" className="hidden items-center gap-8 md:flex">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className="text-[0.78rem] uppercase tracking-[0.18em] text-charcoal/80 transition-colors hover:text-forest">
              {n.label}
            </Link>
          ))}
          <Link href="/invitations" className="btn btn-primary btn-sm">
            Choisir un modèle
          </Link>
        </nav>
        <button
          type="button"
          className="-mr-2 flex h-11 w-11 items-center justify-center md:hidden"
          aria-expanded={open}
          aria-controls="menu-mobile"
          aria-label={open ? "Fermer le menu" : "Ouvrir le menu"}
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
      {open ? (
        <nav id="menu-mobile" aria-label="Navigation mobile" className="border-t border-line bg-ivory px-5 pb-6 md:hidden">
          <ul className="divide-y divide-line">
            {NAV.map((n) => (
              <li key={n.href}>
                <Link href={n.href} className="block py-4 text-sm uppercase tracking-[0.18em]" onClick={() => setOpen(false)}>
                  {n.label}
                </Link>
              </li>
            ))}
          </ul>
          <Link href="/invitations" className="btn btn-primary mt-4 w-full">
            Choisir un modèle
          </Link>
        </nav>
      ) : null}
    </header>
  );
}
