import Link from "next/link";

/** Logotype provisoire (typographique) — remplaçable par le logo importé. */
export function Logo({ className = "", href = "/" }: { className?: string; href?: string }) {
  return (
    <Link href={href} className={`group inline-flex items-center gap-2 ${className}`} aria-label="E-Invitly — accueil">
      <svg viewBox="0 0 24 32" className="h-7 w-5 text-forest" aria-hidden="true">
        <path d="M12 31 C 11 22, 13 12, 12 2" fill="none" stroke="currentColor" strokeWidth="1" />
        <path d="M12 22 C 15 19, 20 19, 22 21 C 19 24, 15 24, 12 22Z" fill="currentColor" fillOpacity=".25" stroke="currentColor" strokeWidth=".8" />
        <path d="M12 15 C 9 12, 4 12, 2 14 C 5 17, 9 17, 12 15Z" fill="currentColor" fillOpacity=".25" stroke="currentColor" strokeWidth=".8" />
        <path d="M12 8 C 14.5 5.5, 18 5.5, 19.5 7 C 17.5 9.5, 14.5 9.5, 12 8Z" fill="currentColor" fillOpacity=".25" stroke="currentColor" strokeWidth=".8" />
      </svg>
      <span className="font-display text-[1.05rem] tracking-[0.22em] text-charcoal">E-INVITLY</span>
    </Link>
  );
}
