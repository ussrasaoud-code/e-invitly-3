"use server";

import { isAllowedAssetUrl } from "@/lib/url";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { logActivity } from "@/lib/audit";
import { requireStaff } from "@/lib/auth";
import { CATEGORIES, STYLES } from "@/lib/catalog";
import { PRESETS } from "@/lib/invitation/presets";
import { RENDERERS, invitationContentSchema, templateDefinitionSchema, type InvitationContentInput } from "@/lib/invitation/schema";
import type { SaveResult } from "@/lib/save-result";
import { slugify } from "@/lib/slug";
import { createClient } from "@/lib/supabase/server";

const uuid = z.string().uuid();

function refreshCatalog(id?: string) {
  revalidatePath("/admin/modeles");
  if (id) revalidatePath(`/admin/modeles/${id}`);
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
  await supabase.from("templates").update({ is_featured: !data?.is_featured }).eq("id", id);
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
    price_label: form.get("price_label") ?? "",
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
  await logActivity({ actorId: user.id, action: "template.updated", resourceType: "template", resourceId: d.id, summary: `Fiche du modèle ${d.name} modifiée` });
  refreshCatalog(d.id);
}

/**
 * Enregistre le design du modèle comme NOUVELLE version.
 * Les invitations existantes gardent la version qu'elles avaient figée.
 */
export async function saveTemplateVersion(templateId: string, sample: InvitationContentInput): Promise<SaveResult> {
  const user = await requireStaff();
  if (!uuid.safeParse(templateId).success) return { ok: false, message: "Modèle inconnu." };
  const parsed = invitationContentSchema.safeParse(sample);
  if (!parsed.success) {
    return { ok: false, message: "Valeurs invalides : version non enregistrée.", issues: parsed.error.issues.slice(0, 5).map((i) => `${i.path.join(" › ")} : ${i.message}`) };
  }
  const supabase = (await createClient())!;
  const { data: tpl } = await supabase
    .from("templates")
    .select("name, template_versions!template_versions_template_id_fkey(version, renderer)")
    .eq("id", templateId)
    .single();
  if (!tpl) return { ok: false, message: "Modèle introuvable." };
  const versions = (tpl.template_versions as Array<{ version: number; renderer: string }>) ?? [];
  const last = versions.sort((a, b) => b.version - a.version)[0];
  const renderer = z.enum(RENDERERS).parse(last?.renderer ?? "the-garden");
  const definition = templateDefinitionSchema.parse({ renderer, sample: parsed.data });
  const nextVersion = (last?.version ?? 0) + 1;
  const { data: v, error } = await supabase
    .from("template_versions")
    .insert({ template_id: templateId, version: nextVersion, renderer, definition, created_by: user.id })
    .select("id, created_at")
    .single();
  if (error || !v) return { ok: false, message: `Enregistrement impossible : ${error?.message}` };
  await supabase.from("templates").update({ current_version_id: v.id }).eq("id", templateId);
  await logActivity({ actorId: user.id, action: "template.version", resourceType: "template", resourceId: templateId, summary: `Modèle ${tpl.name} : version ${nextVersion} enregistrée` });
  refreshCatalog(templateId);
  return { ok: true, savedAt: v.created_at };
}

export async function restoreTemplateVersion(form: FormData) {
  const user = await requireStaff();
  const id = uuid.parse(form.get("id"));
  const versionId = uuid.parse(form.get("versionId"));
  const supabase = (await createClient())!;
  const { data: v } = await supabase.from("template_versions").select("version, template_id").eq("id", versionId).single();
  if (!v || v.template_id !== id) throw new Error("Version introuvable.");
  await supabase.from("templates").update({ current_version_id: versionId }).eq("id", id);
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
  const definition = templateDefinitionSchema.parse({ renderer, sample: invitationContentSchema.parse(PRESETS[renderer]) });
  const { data: v } = await supabase
    .from("template_versions")
    .insert({ template_id: t.id, version: 1, renderer, definition, note: "Version initiale", created_by: user.id })
    .select("id")
    .single();
  if (v) await supabase.from("templates").update({ current_version_id: v.id }).eq("id", t.id);
  await logActivity({ actorId: user.id, action: "template.created", resourceType: "template", resourceId: t.id, summary: `Modèle ${name} créé${renderer === "blank" ? " (page blanche)" : ""}` });
  redirect(form.get("ouvrir") === "editeur" ? `/admin/modeles/${t.id}/editeur` : `/admin/modeles/${t.id}`);
}
