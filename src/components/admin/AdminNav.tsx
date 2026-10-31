"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Logo } from "@/components/brand/Logo";

const ITEMS = [
  { href: "/admin", label: "Vue d'ensemble", exact: true },
  { href: "/admin/demandes", label: "Demandes clients" },
  { href: "/admin/invitations", label: "Invitations" },
  { href: "/admin/modeles", label: "Modèles" },
  { href: "/admin/editeur", label: "Éditeur", soon: "Phase 6" },
  { href: "/admin/rsvp", label: "RSVP" },
  { href: "/admin/medias", label: "Médias" },
  { href: "/admin/parametres", label: "Paramètres" },
];

export function AdminNav({ email, role, newRequests }: { email: string; role: string; newRequests: number }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [pathname]);

  const links = (
    <nav aria-label="Administration">
      <ul className="space-y-0.5">
        {ITEMS.map((it) => {
          const active = it.exact ? pathname === it.href : pathname.startsWith(it.href);
          return (
            <li key={it.href}>
              <Link
                href={it.href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-10 items-center justify-between gap-2 rounded-sm px-3 text-[0.92rem] transition-colors ${
                  active ? "bg-sage-soft text-forest-deep" : "text-charcoal/80 hover:bg-paper hover:text-charcoal"
                }`}
              >
                <span>{it.label}</span>
                {it.href === "/admin/demandes" && newRequests > 0 ? (
                  <span className="rounded-full bg-forest px-2 text-[0.7rem] text-ivory" aria-label={`${newRequests} nouvelles demandes`}>
                    {newRequests}
                  </span>
                ) : it.soon ? (
                  <span className="text-[0.62rem] uppercase tracking-wider text-stone/80">{it.soon}</span>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );

  const footer = (
    <div className="border-t border-line pt-4 text-xs text-stone">
      <p className="truncate" title={email}>{email}</p>
      <p className="mt-0.5 capitalize">{role === "admin" ? "Administratrice" : "Collaborateur·rice"}</p>
      <div className="mt-3 flex gap-4">
        <Link href="/" className="hover:text-forest" target="_blank">Voir le site ↗</Link>
        <form action="/auth/deconnexion" method="post">
          <button type="submit" className="hover:text-danger">Déconnexion</button>
        </form>
      </div>
    </div>
  );

  return (
    <>
      {/* Barre mobile */}
      <div className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-line bg-white px-4 lg:hidden">
        <Logo href="/admin" className="h-7" />
        <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-controls="admin-menu" className="flex h-11 w-11 items-center justify-center" aria-label="Menu">
          <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden="true">
            {open ? <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="1.4" /> : <path d="M4 8h16M4 16h16" stroke="currentColor" strokeWidth="1.4" />}
          </svg>
        </button>
      </div>
      {open ? (
        <div id="admin-menu" className="fixed inset-x-0 bottom-0 top-14 z-40 flex flex-col justify-between overflow-y-auto bg-white p-4 lg:hidden">
          {links}
          {footer}
        </div>
      ) : null}
      {/* Barre latérale */}
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col justify-between border-r border-line bg-white p-5 lg:flex">
        <div>
          <Logo href="/admin" className="h-8" />
          <p className="mb-6 mt-2 text-[0.68rem] uppercase tracking-[0.2em] text-stone">Administration</p>
          {links}
        </div>
        {footer}
      </aside>
    </>
  );
}
