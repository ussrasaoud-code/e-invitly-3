"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { instagramUrl } from "@/lib/instagram";
import { logActivity } from "@/lib/audit";
import { requireAdmin } from "@/lib/auth";
import { SITE_LANGS } from "@/lib/i18n/config";
import { createClient } from "@/lib/supabase/server";
import { checkToken, saveConnection, tokenKind } from "@/lib/instagram-feed";

const str = (max: number) => z.string().trim().max(max);
const url = z.string().trim().max(300).refine((v) => v === "" || /^https:\/\//.test(v), "Lien https:// attendu");

async function saveSetting(key: string, value: unknown, isPublic: boolean, actorId: string) {
  const supabase = (await createClient())!;
  const { error } = await supabase.from("settings").upsert({ key, value, is_public: isPublic, updated_by: actorId }, { onConflict: "key" });
  if (error) throw new Error(`Enregistrement impossible : ${error.message}`);
  await logActivity({ actorId, action: "settings.updated", resourceType: "settings", resourceId: key, summary: `Paramètres « ${key} » modifiés` });
  revalidatePath("/", "layout");
}

export async function saveBrand(form: FormData) {
  const user = await requireAdmin();
  const value = z
    .object({
      name: str(60).min(1),
      tagline: str(200),
      contactEmail: z.string().trim().max(200).refine((v) => v === "" || z.string().email().safeParse(v).success, "E-mail invalide"),
      contactPhone: str(30),
      whatsapp: z.string().trim().max(30).refine((v) => v === "" || /^\+?[\d\s().-]{8,}$/.test(v), "Numéro WhatsApp invalide : format international, ex. +33 6 12 34 56 78"),
      instagram: z.string().transform(instagramUrl).pipe(url),
      facebook: url,
      pinterest: url,
    })
    .parse(Object.fromEntries(["name", "tagline", "contactEmail", "contactPhone", "whatsapp", "instagram", "facebook", "pinterest"].map((k) => [k, form.get(k) ?? ""])));
  await saveSetting("brand", value, true, user.id);
}

export async function saveHome(form: FormData) {
  const user = await requireAdmin();
  const questions = form.getAll("faq_q").map(String);
  const answers = form.getAll("faq_a").map(String);
  const faq = questions
    .map((q, i) => ({ question: q.trim().slice(0, 200), answer: (answers[i] ?? "").trim().slice(0, 1500) }))
    .filter((f) => f.question && f.answer);
  const value = {
    heroTitle: str(160).min(1).parse(form.get("heroTitle")),
    heroSubtitle: str(400).parse(form.get("heroSubtitle") ?? ""),
    faq,
  };
  await saveSetting("home", value, true, user.id);
}

export async function savePolicies(form: FormData) {
  const user = await requireAdmin();
  const value = {
    legalNotice: str(20000).parse(form.get("legalNotice") ?? ""),
    privacyPolicy: str(30000).parse(form.get("privacyPolicy") ?? ""),
    termsOfSale: str(30000).parse(form.get("termsOfSale") ?? ""),
    publicationDuration: str(200).parse(form.get("publicationDuration") ?? ""),
    creationDelay: str(80).parse(form.get("creationDelay") ?? ""),
    rsvpRetentionMonths: z.coerce.number().int().min(1).max(120).parse(form.get("rsvpRetentionMonths")),
  };
  await saveSetting("policies", value, true, user.id);
}

export async function saveLanguages(form: FormData) {
  const user = await requireAdmin();
  const enabled = ["fr", ...SITE_LANGS.filter((l) => l !== "fr" && form.get(`lang_${l}`) === "on")];
  await saveSetting("languages", { enabled }, true, user.id);
}

export async function saveNotifications(form: FormData) {
  const user = await requireAdmin();
  await saveSetting(
    "notifications",
    { notifyOnNewRequest: form.get("notifyOnNewRequest") === "on", notifyOnNewRsvp: form.get("notifyOnNewRsvp") === "on" },
    false,
    user.id,
  );
}

export async function saveProtection(form: FormData) {
  const user = await requireAdmin();
  const hours = z.coerce.number().int().min(1).max(24 * 30).catch(48).parse(form.get("previewHours"));
  await saveSetting(
    "protection",
    {
      previewHours: hours,
      previewWatermark: form.get("previewWatermark") === "on",
      demoWatermark: form.get("demoWatermark") === "on",
      watermarkText: z.string().trim().max(40).catch("").parse(form.get("watermarkText") ?? ""),
      deterrents: form.get("deterrents") === "on",
    },
    true,
    user.id,
  );
}

/** Outils de mesure : identifiants publics (aucune clé secrète), chargés seulement après consentement. */
export async function saveAnalytics(form: FormData) {
  const user = await requireAdmin();
  const ga = z.string().trim().toUpperCase().refine((v) => v === "" || /^G-[A-Z0-9]{4,20}$/.test(v), "Identifiant Google Analytics attendu au format G-XXXXXXX").parse(form.get("gaId") ?? "");
  const pixel = z.string().trim().refine((v) => v === "" || /^\d{6,20}$/.test(v), "Identifiant du pixel Meta attendu (chiffres uniquement)").parse(form.get("metaPixelId") ?? "");
  await saveSetting("analytics", { gaId: ga, metaPixelId: pixel }, true, user.id);
}

/** Instagram : vérifie le jeton d'accès puis l'enregistre (paramètre privé, jamais envoyé au navigateur). */
export async function connectInstagram(form: FormData) {
  const user = await requireAdmin();
  const token = z.string().trim().min(20, "Collez le jeton d'accès Instagram").max(600).parse(form.get("igToken") ?? "");
  const igId = z.string().trim().regex(/^\d{0,30}$/, "L'identifiant du compte Instagram ne contient que des chiffres").parse(form.get("igUserId") ?? "");
  const check = await checkToken(token, igId);
  if (!check.ok) throw new Error(`Jeton refusé par Instagram : ${check.message}`);
  const now = new Date().toISOString();
  await saveConnection({ token, username: check.username, kind: tokenKind(token), igUserId: check.igUserId, savedAt: now, refreshedAt: now }, user.id);
  await logActivity({ actorId: user.id, action: "settings.updated", resourceType: "settings", resourceId: "instagram", summary: `Instagram connecté (@${check.username})` });
  revalidatePath("/", "layout");
}

export async function disconnectInstagram() {
  const user = await requireAdmin();
  await saveConnection(null, user.id);
  await logActivity({ actorId: user.id, action: "settings.updated", resourceType: "settings", resourceId: "instagram", summary: "Instagram déconnecté" });
  revalidatePath("/", "layout");
}

/** Change le rôle d'un compte existant (créé au préalable dans Supabase → Authentication). */
export async function setMemberRole(form: FormData) {
  const user = await requireAdmin();
  const email = z.string().trim().toLowerCase().email("E-mail invalide").parse(form.get("email"));
  const role = z.enum(["admin", "collaborator", "client"]).parse(form.get("role"));
  const supabase = (await createClient())!;
  const { data: profile } = await supabase.from("profiles").select("id, role").eq("email", email).maybeSingle();
  if (!profile) throw new Error("Aucun compte avec cet e-mail. Créez d'abord l'utilisateur dans Supabase (Authentication → Add user).");
  if (profile.id === user.id && role !== "admin") throw new Error("Vous ne pouvez pas retirer vos propres droits d'administratrice.");
  const { error } = await supabase.from("profiles").update({ role }).eq("id", profile.id);
  if (error) throw new Error(error.message);
  await logActivity({ actorId: user.id, action: "member.role", resourceType: "profile", resourceId: profile.id, summary: `${email} → ${role}` });
  revalidatePath("/admin/parametres");
}
