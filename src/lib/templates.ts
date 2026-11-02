import "server-only";
import { createClient } from "@/lib/supabase/server";
import { templateDefinitionSchema, type Language, type TemplateDefinition } from "@/lib/invitation/schema";
import { contentFor } from "@/lib/invitation/variants";
import { translatePrice } from "@/lib/price";

export type CatalogTemplate = {
  id: string;
  slug: string;
  name: string;
  short_description: string;
  description: string;
  category: string;
  styles: string[];
  features: string[];
  cover_image: string | null;
  gallery: string[];
  price_label: string | null;
  is_featured: boolean;
  sort_order: number;
  /** Langues dans lesquelles le modèle existe */
  languages: string[];
  /** Fiche traduite par langue */
  translations: Record<string, Partial<Record<"name" | "short_description" | "description" | "price_label" | "features", string>>>;
};

const BASE_COLUMNS =
  "id, slug, name, short_description, description, category, styles, features, cover_image, gallery, price_label, is_featured, sort_order";
let CATALOG_COLUMNS = `${BASE_COLUMNS}, languages, translations`;

/** Colonnes ajoutées par la migration « languages » : on s'en passe si elle n'a pas encore été appliquée. */
function missingColumns(error: { message?: string } | null) {
  return !!error?.message && /languages|translations/.test(error.message) && /column|schema cache/i.test(error.message);
}
function normalize<T extends Partial<CatalogTemplate>>(row: T): T & CatalogTemplate {
  return { languages: ["fr"], translations: {}, ...row } as T & CatalogTemplate;
}

/** Nom, descriptions et prix dans la langue demandée (repli sur le français). */
export function localizeTemplate(t: CatalogTemplate, lang: string): CatalogTemplate {
  if (lang === "fr") return t;
  const tr = t.translations?.[lang] ?? {};
  return {
    ...t,
    name: tr.name?.trim() || t.name,
    short_description: tr.short_description?.trim() || t.short_description,
    description: tr.description?.trim() || t.description,
    price_label: tr.price_label?.trim() || translatePrice(t.price_label, lang),
    features: tr.features?.trim() ? tr.features.split("\n").map((l) => l.trim()).filter(Boolean) : t.features,
  };
}

export type QueryResult<T> = { data: T; error: string | null; configured: boolean };

/** Modèles publiés, triés selon l'ordre défini dans l'administration. */
export async function listPublishedTemplates(): Promise<QueryResult<CatalogTemplate[]>> {
  const supabase = await createClient();
  if (!supabase) return { data: [], error: null, configured: false };
  const query = () =>
    supabase
      .from("templates")
      .select(CATALOG_COLUMNS)
      .eq("status", "published")
      // Modèles mis en avant en premier, puis l'ordre choisi dans l'administration
      .order("is_featured", { ascending: false })
      .order("sort_order")
      .order("name");
  let { data, error } = await query();
  if (missingColumns(error)) {
    CATALOG_COLUMNS = BASE_COLUMNS;
    ({ data, error } = await query());
  }
  if (error) console.error("[templates]", error.message);
  return { data: ((data as Partial<CatalogTemplate>[]) ?? []).map(normalize), error: error?.message ?? null, configured: true };
}

/** Un modèle publié + la définition de sa version courante (pour la démo). */
export async function getPublishedTemplate(
  slug: string,
): Promise<{ template: CatalogTemplate; definition: TemplateDefinition | null } | null> {
  const supabase = await createClient();
  if (!supabase) return null;
  const query = () =>
    supabase
      .from("templates")
      .select(`${CATALOG_COLUMNS}, current_version:template_versions!templates_current_version_fk(definition)`)
      .eq("slug", slug)
      .eq("status", "published")
      .maybeSingle();
  let { data, error } = await query();
  if (missingColumns(error)) {
    CATALOG_COLUMNS = BASE_COLUMNS;
    ({ data, error } = await query());
  }
  if (error) console.error("[template]", error.message);
  if (!data) return null;
  const raw = (data as unknown as { current_version: { definition: unknown } | null }).current_version?.definition;
  const parsed = raw ? templateDefinitionSchema.safeParse(raw) : null;
  if (parsed && !parsed.success) console.error("[template] définition invalide", slug, parsed.error.issues.slice(0, 3));
  return { template: normalize(data as unknown as CatalogTemplate), definition: parsed?.success ? parsed.data : null };
}

export type Showcase = { slug: string; name: string; renderer: TemplateDefinition["renderer"]; sample: TemplateDefinition["sample"] };

/** Modèles mis en avant + leur contenu de démonstration (page d'accueil). */
export async function listShowcase(limit = 3, lang?: Language): Promise<Showcase[]> {
  const supabase = await createClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("templates")
    .select("slug, name, current_version:template_versions!templates_current_version_fk(definition)")
    .eq("status", "published")
    .order("is_featured", { ascending: false })
    .order("sort_order")
    .limit(limit);
  if (error) console.error("[showcase]", error.message);
  const out: Showcase[] = [];
  for (const row of (data ?? []) as unknown as Array<{ slug: string; name: string; current_version: { definition: unknown } | null }>) {
    const parsed = templateDefinitionSchema.safeParse(row.current_version?.definition);
    if (parsed.success) out.push({ slug: row.slug, name: row.name, renderer: parsed.data.renderer, sample: contentFor(parsed.data, lang) });
  }
  return out;
}
