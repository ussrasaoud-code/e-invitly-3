"use server";

import { formatPrice } from "@/lib/price";

import { isAllowedAssetUrl } from "@/lib/url";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { logActivity } from "@/lib/audit";
import { requireAdmin, requireStaff } from "@/lib/auth";
import { CATEGORIES, STYLES } from "@/lib/catalog";
import { PRESETS } from "@/lib/invitation/presets";
import {
  LANGUAGES,
  RENDERERS,
  invitationContentSchema,
  templateDefinitionSchema,
  type InvitationContent,
  type InvitationContentInput,
  type Language,
  type TemplateDefinition,
} from "@/lib/invitation/schema";
import { getVariant, mainLang, newVariant, removeVariant, setVariant, syncAllVariants, templateLangs } from "@/lib/invitation/variants";
import type { SaveResult } from "@/lib/save-result";
import { slugify } from "@/lib/slug";
import { createClient } from "@/lib/supabase/server";

const uuid = z.string().uuid();

function refreshCatalog(id?: string) {
  revalidatePath("/admin/modeles");
  if (id) {
    revalidatePath(`/admin/modeles/${id}`);
    revalidatePath(`/admin/modeles/${id}/editeur`);
  }
  revalidatePath("/");
  revalidatePath("/invitations");
}

export async function setTemplateStatus(form: FormData) {
  const user = await requireStaff();
  const id = uuid.parse(form.get("id"));
  const status = z.enum(["draft", "published", "archived"]).parse(form.get("status"));
  const supabase = (await createClient())!;
  if (status === "published") {
    const { data } = await supabase.from("templates").select("current_version_id").eq("id", id).single();
    if (!data?.current_version_id) throw new Error("Ce modèle n'a pas encore de version : impossible de le publier.");
  }
  const { data, error } = await supabase.from("templates").update({ status }).eq("id", id).select("name").single();
  if (error) throw new Error(error.message);
  const label = status === "published" ? "ajouté au catalogue" : status === "archived" ? "archivé" : "retiré du catalogue";
  await logActivity({ actorId: user.id, action: `template.${status}`, resourceType: "template", resourceId: id, summary: `Modèle ${data.name} ${label}` });
  refreshCatalog(id);
}

export async function toggleFeatured(form: FormData) {
  await requireStaff();
  const id = uuid.parse(form.get("id"));
  const supabase = (await createClient())!;
  const { data } = await supabase.from("templates").select("is_featured").eq("id", id).single();
  const featured = !data?.is_featured;
  const patch: { is_featured: boolean; sort_order?: number } = { is_featured: featured };
  if (featured) {
    // Mis en avant : passe en tête du catalogue (devant les autres modèles mis en avant)
    const { data: first } = await supabase.from("templates").select("sort_order").neq("id", id).order("sort_order").limit(1).maybeSingle();
    patch.sort_order = (first?.sort_order ?? 10) - 10;
  }
  await supabase.from("templates").update(patch).eq("id", id);
  refreshCatalog(id);
}

/** Réordonne le catalogue : échange la position avec le voisin. */
export async function moveTemplate(form: FormData) {
  await requireStaff();
  const id = uuid.parse(form.get("id"));
  const dir = form.get("dir") === "up" ? -1 : 1;
  const supabase = (await createClient())!;
  const { data: all } = await supabase.from("templates").select("id, sort_order").neq("status", "archived").order("sort_order").order("name");
  if (!all) return;
  const i = all.findIndex((t) => t.id === id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= all.length) return;
  // Renumérote proprement (10, 20, 30…) puis échange
  const ordered = [...all];
  [ordered[i], ordered[j]] = [ordered[j], ordered[i]];
  await Promise.all(ordered.map((t, k) => supabase.from("templates").update({ sort_order: (k + 1) * 10 }).eq("id", t.id)));
  refreshCatalog();
}

const metaSchema = z.object({
  id: uuid,
  name: z.string().trim().min(1, "Nom requis").max(80),
  slug: z.string().trim().max(60),
  short_description: z.string().trim().max(200),
  description: z.string().trim().max(3000),
  category: z.enum(CATEGORIES.map((c) => c.value) as [string, ...string[]]),
  styles: z.array(z.enum(STYLES.map((s) => s.value) as [string, ...string[]])),
  features: z.string().max(2000),
  price_label: z.string().trim().max(80),
  cover_image: z.string().trim().max(1000).refine(isAllowedAssetUrl, "Lien d'image invalide"),
  gallery: z.string().max(5000),
});

export async function updateTemplateMeta(form: FormData) {
  const user = await requireStaff();
  const parsed = metaSchema.safeParse({
    id: form.get("id"),
    name: form.get("name"),
    slug: form.get("slug"),
    short_description: form.get("short_description"),
    description: form.get("description"),
    category: form.get("category"),
    styles: form.getAll("styles"),
    features: form.get("features") ?? "",
    price_label: form.has("price_mode")
      ? formatPrice(String(form.get("price_mode")), String(form.get("price_amount") ?? ""), String(form.get("price_text") ?? "")) ?? ""
      : (form.get("price_label") ?? ""),
    cover_image: form.get("cover_image") ?? "",
    gallery: form.get("gallery") ?? "",
  });
  if (!parsed.success) throw new Error(parsed.error.issues.map((i) => i.message).join(" · "));
  const d = parsed.data;
  const slug = slugify(d.slug || d.name);
  if (!slug) throw new Error("Identifiant invalide.");
  const lines = (s: string) => s.split("\n").map((l) => l.trim()).filter(Boolean);
  const gallery = lines(d.gallery).filter((u) => u !== "" && isAllowedAssetUrl(u));
  const supabase = (await createClient())!;
  const { error } = await supabase
    .from("templates")
    .update({
      name: d.name,
      slug,
      short_description: d.short_description,
      description: d.description,
      category: d.category,
      styles: d.styles,
      features: lines(d.features).slice(0, 20),
      price_label: d.price_label || null,
      cover_image: d.cover_image || null,
      gallery,
    })
    .eq("id", d.id);
  if (error) throw new Error(error.code === "23505" ? "Cet identifiant est déjà utilisé par un autre modèle." : error.message);
  // Fiche traduite (colonne ajoutée par la migration « languages »)
  const FIELDS = { name: 80, short_description: 200, description: 3000, price_label: 80, features: 2000 } as const;
  const translations: Record<string, Record<string, string>> = {};
  for (const l of LANGUAGES) {
    if (l === "fr") continue;
    const entry: Record<string, string> = {};
    for (const [f, max] of Object.entries(FIELDS)) {
      const v = String(form.get(`tr_${l}_${f}`) ?? "").trim().slice(0, max);
      if (v) entry[f] = v;
    }
    if (Object.keys(entry).length) translations[l] = entry;
  }
  if ([...form.keys()].some((k) => k.startsWith("tr_"))) {
    const { error: trError } = await supabase.from("templates").update({ translations }).eq("id", d.id);
    if (trError) throw new Error(`Traductions non enregistrées : ${trError.message}. Avez-vous exécuté la migration 20261105000001_languages.sql ?`);
  }
  await logActivity({ actorId: user.id, action: "template.updated", resourceType: "template", resourceId: d.id, summary: `Fiche du modèle ${d.name} modifiée` });
  refreshCatalog(d.id);
}

/**
 * Enregistre le design du modèle comme NOUVELLE version.
 * Les invitations existantes gardent la version qu'elles avaient figée.
 */
type Supa = NonNullable<Awaited<ReturnType<typeof createClient>>>;

/** Définition de travail d'un modèle : le brouillon s'il existe, sinon la version courante. */
async function loadWorking(supabase: Supa, templateId: string) {
  const { data: tpl } = await supabase
    .from("templates")
    .select("name, current:template_versions!templates_current_version_fk(renderer, definition, created_at)")
    .eq("id", templateId)
    .maybeSingle();
  if (!tpl) return null;
  const { data: draft } = await supabase.from("template_drafts").select("definition, updated_at").eq("template_id", templateId).maybeSingle();
  const cur = tpl.current as { renderer?: string; definition?: unknown; created_at?: string } | null;
  const fromDraft = draft ? templateDefinitionSchema.safeParse(draft.definition) : null;
  const fromCur = cur?.definition ? templateDefinitionSchema.safeParse(cur.definition) : null;
  const def: TemplateDefinition | null = fromDraft?.success ? fromDraft.data : fromCur?.success ? fromCur.data : null;
  const renderer = z.enum(RENDERERS).catch("the-garden").parse(cur?.renderer ?? def?.renderer);
  const changedAt = Math.max(draft?.updated_at ? Date.parse(draft.updated_at) : 0, cur?.created_at ? Date.parse(cur.created_at) : 0);
  return { name: tpl.name as string, def, renderer, changedAt };
}

/**
 * Deux onglets ouverts sur le même modèle (formulaire « Design » et éditeur visuel, par exemple) :
 * celui qui a été chargé avant le dernier enregistrement ne doit pas écraser le travail de l'autre.
 */
function staleMessage(changedAt: number, base?: string): SaveResult | null {
  if (!base) return null;
  const b = Date.parse(base);
  if (!Number.isFinite(b) || changedAt <= b + 1000) return null;
  const at = new Intl.DateTimeFormat("fr-FR", { timeStyle: "short", timeZone: "Europe/Paris" }).format(new Date(changedAt));
  return {
    ok: false,
    message: `Ce modèle a été modifié ailleurs à ${at} (autre onglet ou autre personne). Pour ne pas écraser ce travail, rien n'a été enregistré ici : rechargez la page pour repartir de la dernière version.`,
  };
}

/** Intègre le contenu d'une langue dans la définition de travail. */
function mergeContent(base: TemplateDefinition | null, renderer: TemplateDefinition["renderer"], lang: Language | null, content: InvitationContent): TemplateDefinition {
  if (!base) return { renderer, sample: content, variants: {} };
  return setVariant({ ...base, renderer }, lang ?? mainLang(base), content);
}

async function saveDraftDefinition(supabase: Supa, templateId: string, definition: TemplateDefinition, userId: string): Promise<SaveResult> {
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("template_drafts")
    .upsert({ template_id: templateId, definition, updated_by: userId, updated_at: now }, { onConflict: "template_id" });
  if (error) return { ok: false, message: `Brouillon non enregistré : ${error.message}` };
  return { ok: true, savedAt: now };
}

/** Crée une nouvelle version (toutes les langues) et la rend courante. */
async function insertVersion(supabase: Supa, templateId: string, name: string, definition: TemplateDefinition, userId: string): Promise<SaveResult> {
  const { data: last } = await supabase
    .from("template_versions")
    .select("version")
    .eq("template_id", templateId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextVersion = (last?.version ?? 0) + 1;
  const { data: v, error } = await supabase
    .from("template_versions")
    .insert({ template_id: templateId, version: nextVersion, renderer: definition.renderer, definition, created_by: userId })
    .select("id, created_at")
    .single();
  if (error || !v) return { ok: false, message: `Enregistrement impossible : ${error?.message}` };
  await supabase.from("templates").update({ current_version_id: v.id }).eq("id", templateId);
  // Langues disponibles (colonne ajoutée par la migration « languages » ; ignorée si absente)
  await supabase.from("templates").update({ languages: templateLangs(definition) }).eq("id", templateId);
  await logActivity({ actorId: userId, action: "template.version", resourceType: "template", resourceId: templateId, summary: `Modèle ${name} : version ${nextVersion} enregistrée` });
  refreshCatalog(templateId);
  return { ok: true, savedAt: v.created_at };
}

function parseContent(sample: InvitationContentInput, what: string): { ok: true; data: InvitationContent } | { ok: false; res: SaveResult } {
  const parsed = invitationContentSchema.safeParse(sample);
  if (parsed.success) return { ok: true, data: parsed.data };
  return {
    ok: false,
    res: { ok: false, message: `Valeurs invalides : ${what} non enregistré${what === "version" ? "e" : ""}.`, issues: parsed.error.issues.slice(0, 5).map((i) => `${i.path.join(" › ")} : ${i.message}`) },
  };
}

const langOrNull = (v: unknown): Language | null => (LANGUAGES as readonly string[]).includes(v as string) ? (v as Language) : null;

/**
 * Brouillon automatique du modèle, pour la langue éditée (enregistré à chaque modification).
 * Les invitations et le catalogue n'en voient rien tant qu'une version n'est pas créée.
 */
export async function saveTemplateDraft(templateId: string, lang: string | null, sample: InvitationContentInput, base?: string): Promise<SaveResult> {
  const user = await requireStaff();
  if (!uuid.safeParse(templateId).success) return { ok: false, message: "Modèle inconnu." };
  const c = parseContent(sample, "brouillon");
  if (!c.ok) return c.res;
  const supabase = (await createClient())!;
  const w = await loadWorking(supabase, templateId);
  if (!w) return { ok: false, message: "Modèle introuvable." };
  const stale = staleMessage(w.changedAt, base);
  if (stale) return stale;
  return saveDraftDefinition(supabase, templateId, mergeContent(w.def, w.renderer, langOrNull(lang), c.data), user.id);
}

/** Enregistre une nouvelle version (toutes les langues) à partir du contenu affiché, puis vide le brouillon. */
export async function publishTemplateDraft(templateId: string, lang: string | null, sample: InvitationContentInput, base?: string): Promise<SaveResult> {
  const user = await requireStaff();
  if (!uuid.safeParse(templateId).success) return { ok: false, message: "Modèle inconnu." };
  const c = parseContent(sample, "version");
  if (!c.ok) return c.res;
  const supabase = (await createClient())!;
  const w = await loadWorking(supabase, templateId);
  if (!w) return { ok: false, message: "Modèle introuvable." };
  const stale = staleMessage(w.changedAt, base);
  if (stale) return stale;
  const res = await insertVersion(supabase, templateId, w.name, mergeContent(w.def, w.renderer, langOrNull(lang), c.data), user.id);
  if (res.ok) await supabase.from("template_drafts").delete().eq("template_id", templateId);
  return res;
}

/** Ancienne signature (version principale) : publie directement. */
export async function saveTemplateVersion(templateId: string, sample: InvitationContentInput): Promise<SaveResult> {
  return publishTemplateDraft(templateId, null, sample);
}

/** Ajoute une langue au modèle : copie de la version principale, textes à traduire. */
export async function addTemplateLanguage(form: FormData) {
  const user = await requireStaff();
  const id = uuid.parse(form.get("id"));
  const lang = z.enum(LANGUAGES).parse(form.get("lang"));
  const supabase = (await createClient())!;
  const w = await loadWorking(supabase, id);
  if (!w?.def) throw new Error("Ce modèle n'a pas de version valide.");
  if (!getVariant(w.def, lang)) {
    const res = await saveDraftDefinition(supabase, id, setVariant(w.def, lang, newVariant(w.def, lang)), user.id);
    if (!res.ok) throw new Error(res.message);
  }
  redirect(`/admin/modeles/${id}/editeur?langue=${lang}`);
}

/** Retire une langue (jamais la langue principale). Effectif à la prochaine version. */
export async function removeTemplateLanguage(form: FormData) {
  const user = await requireStaff();
  const id = uuid.parse(form.get("id"));
  const lang = z.enum(LANGUAGES).parse(form.get("lang"));
  const supabase = (await createClient())!;
  const w = await loadWorking(supabase, id);
  if (!w?.def) throw new Error("Ce modèle n'a pas de version valide.");
  const res = await saveDraftDefinition(supabase, id, removeVariant(w.def, lang), user.id);
  if (!res.ok) throw new Error(res.message);
  redirect(`/admin/modeles/${id}/editeur`);
}

/** Reprend le design de la langue principale dans toutes les autres (textes traduits conservés). */
export async function syncTemplateLanguages(form: FormData) {
  const user = await requireStaff();
  const id = uuid.parse(form.get("id"));
  const supabase = (await createClient())!;
  const w = await loadWorking(supabase, id);
  if (!w?.def) throw new Error("Ce modèle n'a pas de version valide.");
  const res = await saveDraftDefinition(supabase, id, syncAllVariants(w.def), user.id);
  if (!res.ok) throw new Error(res.message);
  revalidatePath(`/admin/modeles/${id}/editeur`);
}

export async function restoreTemplateVersion(form: FormData) {
  const user = await requireStaff();
  const id = uuid.parse(form.get("id"));
  const versionId = uuid.parse(form.get("versionId"));
  const supabase = (await createClient())!;
  const { data: v } = await supabase.from("template_versions").select("version, template_id").eq("id", versionId).single();
  if (!v || v.template_id !== id) throw new Error("Version introuvable.");
  await supabase.from("templates").update({ current_version_id: versionId }).eq("id", id);
  await supabase.from("template_drafts").delete().eq("template_id", id);
  await logActivity({ actorId: user.id, action: "template.restored", resourceType: "template", resourceId: id, summary: `Version ${v.version} du modèle rétablie` });
  refreshCatalog(id);
}

export async function duplicateTemplate(form: FormData) {
  const user = await requireStaff();
  const id = uuid.parse(form.get("id"));
  const supabase = (await createClient())!;
  const { data: src } = await supabase
    .from("templates")
    .select("*, current:template_versions!templates_current_version_fk(renderer, definition)")
    .eq("id", id)
    .single();
  if (!src) throw new Error("Modèle introuvable.");
  let slug = `${src.slug}-copie`;
  for (let n = 2; n < 50; n++) {
    const { data } = await supabase.from("templates").select("id").eq("slug", slug).maybeSingle();
    if (!data) break;
    slug = `${src.slug}-copie-${n}`;
  }
  const { data: copy, error } = await supabase
    .from("templates")
    .insert({
      slug,
      name: `${src.name} (copie)`,
      short_description: src.short_description,
      description: src.description,
      category: src.category,
      styles: src.styles,
      features: src.features,
      cover_image: src.cover_image,
      gallery: src.gallery,
      price_label: src.price_label,
      status: "draft",
      sort_order: src.sort_order + 5,
    })
    .select("id")
    .single();
  if (error || !copy) throw new Error(`Duplication impossible : ${error?.message}`);
  const current = src.current as { renderer: string; definition: unknown } | null;
  if (current) {
    const { data: v } = await supabase
      .from("template_versions")
      .insert({ template_id: copy.id, version: 1, renderer: current.renderer, definition: current.definition, note: `Copie de ${src.name}`, created_by: user.id })
      .select("id")
      .single();
    if (v) await supabase.from("templates").update({ current_version_id: v.id }).eq("id", copy.id);
  }
  await logActivity({ actorId: user.id, action: "template.duplicated", resourceType: "template", resourceId: copy.id, summary: `Modèle ${src.name} dupliqué` });
  redirect(`/admin/modeles/${copy.id}`);
}

/** Crée un modèle à partir d'un moteur de rendu existant (hors catalogue jusqu'à publication). */
export async function createTemplate(form: FormData) {
  const user = await requireStaff();
  const name = z.string().trim().min(1, "Nom requis").max(80).parse(form.get("name"));
  const renderer = z.enum(RENDERERS).parse(form.get("renderer"));
  const supabase = (await createClient())!;
  let slug = slugify(name) || "modele";
  for (let n = 2; n < 50; n++) {
    const { data } = await supabase.from("templates").select("id").eq("slug", slug).maybeSingle();
    if (!data) break;
    slug = `${slugify(name)}-${n}`;
  }
  const { data: t, error } = await supabase.from("templates").insert({ slug, name, status: "draft", sort_order: 900 }).select("id").single();
  if (error || !t) throw new Error(error?.message ?? "Création impossible");
  const language = z.enum(LANGUAGES).catch("fr").parse(form.get("langue"));
  const definition = templateDefinitionSchema.parse({ renderer, sample: { ...invitationContentSchema.parse(PRESETS[renderer]), language } });
  await supabase.from("templates").update({ languages: [language] }).eq("id", t.id);
  const { data: v } = await supabase
    .from("template_versions")
    .insert({ template_id: t.id, version: 1, renderer, definition, note: "Version initiale", created_by: user.id })
    .select("id")
    .single();
  if (v) await supabase.from("templates").update({ current_version_id: v.id }).eq("id", t.id);
  await logActivity({ actorId: user.id, action: "template.created", resourceType: "template", resourceId: t.id, summary: `Modèle ${name} créé${renderer === "blank" ? " (page blanche)" : ""}` });
  redirect(form.get("ouvrir") === "editeur" ? `/admin/modeles/${t.id}/editeur` : `/admin/modeles/${t.id}`);
}

/**
 * Suppression définitive d'un modèle archivé (administrateurs).
 * Les invitations déjà créées avec ce modèle ne sont pas touchées : elles gardent leur propre contenu.
 */
export async function deleteTemplate(form: FormData) {
  const user = await requireAdmin();
  const id = uuid.parse(form.get("id"));
  const supabase = (await createClient())!;
  const { data: t } = await supabase.from("templates").select("name, slug, status").eq("id", id).maybeSingle();
  if (!t) redirect("/admin/modeles?archives=1");
  if (t.status !== "archived") throw new Error("Archivez d'abord ce modèle avant de le supprimer.");
  // La version courante pointe vers template_versions : on la détache avant la suppression en cascade
  await supabase.from("templates").update({ current_version_id: null }).eq("id", id);
  const { error } = await supabase.from("templates").delete().eq("id", id);
  if (error) throw new Error(`Suppression impossible : ${error.message}`);
  await logActivity({ actorId: user.id, action: "template.deleted", resourceType: "template", resourceId: id, summary: `Modèle ${t.name} supprimé définitivement` });
  refreshCatalog(id);
  revalidatePath("/admin/modeles");
  redirect(`/admin/modeles?archives=1&supprime=${encodeURIComponent(t.name)}`);
}
