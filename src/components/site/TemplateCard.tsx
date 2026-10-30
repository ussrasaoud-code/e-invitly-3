import Link from "next/link";
import { styleLabel } from "@/lib/catalog";
import type { CatalogTemplate } from "@/lib/templates";

export function TemplateCard({ template, priority = false }: { template: CatalogTemplate; priority?: boolean }) {
  return (
    <article className="group flex flex-col">
      <Link href={`/invitations/${template.slug}`} className="relative block overflow-hidden bg-paper" aria-label={`Voir la fiche du modèle ${template.name}`}>
        {template.cover_image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={template.cover_image}
            alt={`Aperçu du modèle ${template.name}`}
            width={600}
            height={800}
            loading={priority ? "eager" : "lazy"}
            className="aspect-[3/4] w-full object-cover transition-transform duration-700 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="flex aspect-[3/4] items-center justify-center font-display text-sm tracking-[0.3em] text-stone">
            {template.name.toUpperCase()}
          </div>
        )}
      </Link>
      <div className="flex flex-1 flex-col pt-5">
        <p className="eyebrow">{template.styles.map(styleLabel).join(" · ")}</p>
        <h3 className="mt-2 font-serif text-[1.7rem] leading-tight">{template.name}</h3>
        <p className="mt-2 flex-1 text-[0.95rem] leading-relaxed text-stone">{template.short_description}</p>
        {template.price_label ? <p className="mt-3 text-sm text-charcoal">{template.price_label}</p> : null}
        <div className="mt-5 flex flex-wrap gap-3">
          <Link href={`/demo/${template.slug}`} className="btn btn-secondary btn-sm">
            Voir la démo
          </Link>
          <Link href={`/personnalisation/${template.slug}`} className="btn btn-primary btn-sm">
            Choisir ce modèle
          </Link>
        </div>
      </div>
    </article>
  );
}
