"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { logActivity } from "@/lib/audit";
import { requireStaff } from "@/lib/auth";
import { MEDIA_TYPES, guessMime, isSafeSvg, type MediaItem, type MediaKind } from "@/lib/media";
import { slugify } from "@/lib/slug";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const BUCKET = "media";

function storage() {
  const admin = createAdminClient();
  if (!admin) throw new Error("Stockage non configuré (clé Supabase manquante).");
  return admin.storage.from(BUCKET);
}

export const publicMediaUrl = async (path: string) => storage().getPublicUrl(path).data.publicUrl;

const collectionSchema = z.string().trim().min(1, "Choisissez une collection").max(60);

/**
 * Étape 1 de l'import : vérifie le fichier annoncé et renvoie une autorisation
 * d'envoi à usage unique. Le fichier part ensuite directement du navigateur
 * vers le stockage (pas de limite de taille du serveur web).
 */
export async function requestUpload(input: { name: string; type: string; size: number; collection: string }) {
  await requireStaff();
  const mime = guessMime(input.name, input.type);
  const spec = MEDIA_TYPES[mime];
  if (!spec) return { ok: false as const, message: "Format non accepté (PNG, JPG, WebP, SVG, MP4, WebM, MP3, M4A, OGG)." };
  if (!Number.isFinite(input.size) || input.size <= 0) return { ok: false as const, message: "Fichier vide." };
  if (input.size > spec.maxBytes) return { ok: false as const, message: `Fichier trop lourd (maximum ${Math.round(spec.maxBytes / 1024 / 1024)} Mo pour ce format).` };
  const collection = collectionSchema.safeParse(input.collection);
  if (!collection.success) return { ok: false as const, message: collection.error.issues[0].message };

  const base = slugify(input.name.replace(/\.[^.]+$/, "")).slice(0, 50) || "fichier";
  const path = `${slugify(collection.data) || "divers"}/${new Date().getFullYear()}/${randomUUID().slice(0, 8)}-${base}.${spec.ext}`;
  const { data, error } = await storage().createSignedUploadUrl(path);
  if (error || !data) return { ok: false as const, message: `Envoi impossible : ${error?.message ?? "inconnu"}` };
  return { ok: true as const, path, token: data.token, mime: mime === "audio/x-m4a" ? "audio/mp4" : mime };
}

/** Étape 2 : vérifie le fichier réellement reçu, puis l'ajoute à la bibliothèque. */
export async function registerUpload(input: {
  path: string;
  name: string;
  collection: string;
  licenseNote?: string;
  width?: number | null;
  height?: number | null;
}): Promise<{ ok: true; item: MediaItem } | { ok: false; message: string }> {
  const user = await requireStaff();
  const path = z.string().regex(/^[a-z0-9-]+\/\d{4}\/[a-z0-9-]+\.[a-z0-9]+$/).safeParse(input.path);
  if (!path.success) return { ok: false, message: "Fichier introuvable." };
  const store = storage();
  const { data: info, error: infoErr } = await store.info(path.data);
  if (infoErr || !info) return { ok: false, message: "Le fichier n'a pas été reçu. Réessayez." };
  const ext = path.data.split(".").pop()!;
  const mime = Object.entries(MEDIA_TYPES).find(([, s]) => s.ext === ext)?.[0];
  const spec = mime ? MEDIA_TYPES[mime] : null;
  const meta = info as { size?: number; metadata?: { size?: number } };
  const size = Number(meta.size ?? meta.metadata?.size ?? 0);
  if (!spec || !mime || size <= 0 || size > spec.maxBytes) {
    await store.remove([path.data]);
    return { ok: false, message: "Fichier refusé (format ou taille)." };
  }
  const url = store.getPublicUrl(path.data).data.publicUrl;

  if (spec.kind === "svg") {
    const text = await fetch(url, { cache: "no-store" }).then((r) => r.text()).catch(() => "");
    if (!text || !isSafeSvg(text)) {
      await store.remove([path.data]);
      return { ok: false, message: "Ce SVG contient du code ou des éléments externes : il a été refusé par sécurité. Réexportez-le en « SVG simple »." };
    }
  }

  const supabase = (await createClient())!;
  const dims = (v: unknown) => (typeof v === "number" && v > 0 && v < 20000 ? Math.round(v) : null);
  const { data: row, error } = await supabase
    .from("media_assets")
    .insert({
      name: z.string().trim().min(1).max(120).catch("Sans titre").parse(input.name.replace(/\.[^.]+$/, "")),
      kind: spec.kind,
      bucket: BUCKET,
      path: path.data,
      mime_type: mime === "audio/x-m4a" ? "audio/mp4" : mime,
      size_bytes: size,
      width: dims(input.width),
      height: dims(input.height),
      collection: collectionSchema.catch("Divers").parse(input.collection),
      license_note: z.string().trim().max(300).catch("").parse(input.licenseNote ?? "") || null,
      uploaded_by: user.id,
    })
    .select("*")
    .single();
  if (error || !row) {
    await store.remove([path.data]);
    return { ok: false, message: `Enregistrement impossible : ${error?.message}` };
  }
  revalidatePath("/admin/medias");
  return { ok: true, item: { ...(row as Omit<MediaItem, "url">), url } };
}

/** Ajout groupé terminé : une seule ligne dans l'activité récente. */
export async function logUploadBatch(count: number, collection: string) {
  const user = await requireStaff();
  if (count > 0) {
    await logActivity({ actorId: user.id, action: "media.uploaded", resourceType: "media", summary: `${count} fichier(s) ajouté(s) à la bibliothèque (${collection})` });
  }
}

export async function updateMedia(form: FormData) {
  await requireStaff();
  const id = z.string().uuid().parse(form.get("id"));
  const supabase = (await createClient())!;
  const { error } = await supabase
    .from("media_assets")
    .update({
      name: z.string().trim().min(1, "Nom requis").max(120).parse(form.get("name")),
      collection: collectionSchema.parse(form.get("collection")),
      tags: String(form.get("tags") ?? "")
        .split(",")
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean)
        .slice(0, 12),
      license_note: z.string().trim().max(300).parse(form.get("license_note") ?? "") || null,
    })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath(`/admin/medias/${id}`);
  revalidatePath("/admin/medias");
}

/** Invitations et modèles qui utilisent ce fichier. */
export async function mediaUsage(url: string) {
  await requireStaff();
  const supabase = (await createClient())!;
  const { data, error } = await supabase.rpc("media_usage", { p_url: url });
  if (error) throw new Error(`Vérification impossible : ${error.message}`);
  return (data ?? []) as Array<{ kind: "invitation" | "modele"; id: string; title: string }>;
}

/** Suppression, seulement si le fichier n'est utilisé nulle part. */
export async function deleteMedia(form: FormData) {
  const user = await requireStaff();
  const id = z.string().uuid().parse(form.get("id"));
  const supabase = (await createClient())!;
  const { data: m } = await supabase.from("media_assets").select("name, path").eq("id", id).single();
  if (!m) throw new Error("Fichier introuvable.");
  const url = await publicMediaUrl(m.path);
  const usage = await mediaUsage(url);
  if (usage.length) {
    throw new Error(`Ce fichier est utilisé par : ${usage.map((u) => u.title).join(", ")}. Retirez-le d'abord de ces invitations ou modèles.`);
  }
  const { error: rmErr } = await storage().remove([m.path]);
  if (rmErr) throw new Error(`Suppression impossible : ${rmErr.message}`);
  const { error } = await supabase.from("media_assets").delete().eq("id", id);
  if (error) throw new Error(error.message);
  await logActivity({ actorId: user.id, action: "media.deleted", resourceType: "media", summary: `Fichier « ${m.name} » supprimé de la bibliothèque` });
  revalidatePath("/admin/medias");
  redirect("/admin/medias?supprime=1");
}

/** Liste pour le sélecteur de l'éditeur. */
export async function listMediaForPicker(kinds: MediaKind[]): Promise<MediaItem[]> {
  await requireStaff();
  const supabase = (await createClient())!;
  const { data } = await supabase
    .from("media_assets")
    .select("*")
    .in("kind", kinds)
    .order("created_at", { ascending: false })
    .limit(300);
  const store = storage();
  return (data ?? []).map((m) => ({ ...(m as Omit<MediaItem, "url">), url: store.getPublicUrl(m.path).data.publicUrl }));
}
