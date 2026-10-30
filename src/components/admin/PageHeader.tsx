import type { ReactNode } from "react";

export function PageHeader({ title, description, actions, eyebrow }: { title: string; description?: ReactNode; actions?: ReactNode; eyebrow?: ReactNode }) {
  return (
    <header className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div>
        {eyebrow ? <div className="mb-2 text-sm text-stone">{eyebrow}</div> : null}
        <h1 className="font-serif text-4xl leading-tight">{title}</h1>
        {description ? <p className="mt-2 max-w-2xl text-sm leading-relaxed text-stone">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </header>
  );
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="card px-6 py-12 text-center">
      <p className="font-serif text-2xl">{title}</p>
      {children ? <div className="mx-auto mt-2 max-w-md text-sm text-stone">{children}</div> : null}
    </div>
  );
}

export function SoonPanel({ phase, children }: { phase: string; children: ReactNode }) {
  return (
    <div className="card border-dashed p-6">
      <p className="text-[0.68rem] uppercase tracking-[0.2em] text-stone">Prévu en {phase} — pas encore disponible</p>
      <div className="mt-2 text-sm leading-relaxed text-charcoal/90">{children}</div>
    </div>
  );
}
