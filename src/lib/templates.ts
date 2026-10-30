import "server-only";
import { createClient } from "@/lib/supabase/server";
import { templateDefinitionSchema, type TemplateDefinition } from "@/lib/invitation/schema";

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
};

const CATALOG_COLUMNS =
  "id, slug, name, short_description, description, category, styles, features, cover_image, gallery, price_label, is_featured, sort_order";

export type QueryResult<T> = { data: T; error: string | null; configured: boolean };

/** Modèles publiés, triés selon l'ordre défini dans l'administration. */
export async function listPublishedTemplates(): Promise<QueryResult<CatalogTemplate[]>> {
  const supabase = await createClient();
  if (!supabase) return { data: [], error: null, configured: false };
  const { data, error } = await supabase
    .from("templates")
    .select(CATALOG_COLUMNS)
    .eq("status", "published")
    .order("sort_order")
    .order("name");
  if (error) console.error("[templates]", error.message);
  return { data: (data as CatalogTemplate[]) ?? [], error: error?.message ?? null, configured: true };
}

/** Un modèle publié + la définition de sa version courante (pour la démo). */
export async function getPublishedTemplate(
  slug: string,
): Promise<{ template: CatalogTemplate; definition: TemplateDefinition | null } | null> {
  const supabase = await createClient();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("templates")
    .select(`${CATALOG_COLUMNS}, current_version:template_versions!templates_current_version_fk(definition)`)
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();
  if (error) console.error("[template]", error.message);
  if (!data) return null;
  const raw = (data as unknown as { current_version: { definition: unknown } | null }).current_version?.definition;
  const parsed = raw ? templateDefinitionSchema.safeParse(raw) : null;
  if (parsed && !parsed.success) console.error("[template] définition invalide", slug, parsed.error.issues.slice(0, 3));
  return { template: data as unknown as CatalogTemplate, definition: parsed?.success ? parsed.data : null };
}

export type Showcase = { slug: string; name: string; renderer: TemplateDefinition["renderer"]; sample: TemplateDefinition["sample"] };

/** Modèles mis en avant + leur contenu de démonstration (page d'accueil). */
export async function listShowcase(limit = 3): Promise<Showcase[]> {
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
    if (parsed.success) out.push({ slug: row.slug, name: row.name, renderer: parsed.data.renderer, sample: parsed.data.sample });
  }
  return out;
}
