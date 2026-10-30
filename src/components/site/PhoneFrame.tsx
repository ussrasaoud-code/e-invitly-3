import type { ReactNode } from "react";

/** Cadre de smartphone pour présenter une invitation (le contenu défile à l'intérieur). */
export function PhoneFrame({ children, label, className = "" }: { children: ReactNode; label?: string; className?: string }) {
  return (
    <div className={`relative mx-auto w-[min(300px,82vw)] ${className}`}>
      <div className="relative rounded-[2.6rem] border border-charcoal/15 bg-charcoal p-[9px] shadow-lift">
        <div className="absolute left-1/2 top-[14px] z-30 h-[18px] w-[86px] -translate-x-1/2 rounded-full bg-charcoal" aria-hidden="true" />
        <div
          className="relative aspect-[9/19] overflow-y-auto overflow-x-hidden overscroll-contain rounded-[2.1rem] bg-ivory [scrollbar-width:none]"
          tabIndex={0}
          role="region"
          aria-label={label ?? "Aperçu d'invitation"}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
