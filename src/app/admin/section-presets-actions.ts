"use server";

import { logActivity } from "@/lib/audit";
import { requireStaff } from "@/lib/auth";
import { sectionSchema, SECTION_TYPES, type InvitationSection } from "@/lib/invitation/schema";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Sections prêtes à l'emploi personnalisées par l'équipe : quand on ajoute une section
 * de ce type dans l'éditeur, c'est cette version (textes, couleurs, calques) qui est insérée
 * au lieu de la section d'origine. Gardées dans un paramètre privé (« section_presets »).
 */
const KEY = "section_presets";
type Presets = Partial<Record<InvitationSection["type"], InvitationSection>>;

async function readAll(): Promise<Presets> {
  const db = createAdminClient();
  if (!db) return {};
  const { data } = await db.from("settings").select("value").eq("key", KEY).maybeSingle();
  const raw = (data?.value ?? {}) as Record<string, unknown>;
  const out: Presets = {};
  for (const t of SECTION_TYPES) {
    const p = sectionSchema.safeParse(raw[t]);
    if (p.success) out[t] = p.data;
  }
  return out;
}

async function writeAll(value: Presets, actorId: string) {
  const db = createAdminClient();
  if (!db) throw new Error("Base non configurée");
  const { error } = await db.from("settings").upsert({ key: KEY, value, is_public: false, updated_by: actorId }, { onConflict: "key" });
  if (error) throw new Error(error.message);
}

export async function loadSectionPresets(): Promise<Presets> {
  await requireStaff();
  return readAll();
}

export async function saveSectionPreset(section: unknown): Promise<{ ok: boolean; message?: string }> {
  const user = await requireStaff();
  const parsed = sectionSchema.safeParse(section);
  if (!parsed.success) return { ok: false, message: "Section invalide" };
  try {
    const all = await readAll();
    all[parsed.data.type] = parsed.data;
    await writeAll(all, user.id);
    await logActivity({ actorId: user.id, action: "section_preset.save", resourceType: "settings", resourceId: KEY, summary: `Section prête à l'emploi enregistrée : ${parsed.data.type}` });
    return { ok: true };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Enregistrement impossible" };
  }
}

export async function resetSectionPreset(type: string): Promise<{ ok: boolean }> {
  const user = await requireStaff();
  if (!(SECTION_TYPES as readonly string[]).includes(type)) return { ok: false };
  const all = await readAll();
  delete all[type as InvitationSection["type"]];
  await writeAll(all, user.id);
  await logActivity({ actorId: user.id, action: "section_preset.reset", resourceType: "settings", resourceId: KEY, summary: `Section prête à l'emploi remise d'origine : ${type}` });
  return { ok: true };
}
