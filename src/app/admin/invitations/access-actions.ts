"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { logActivity } from "@/lib/audit";
import { requireStaff } from "@/lib/auth";
import { sendWelcomeEmail } from "@/lib/login-link";
import { createClient } from "@/lib/supabase/server";
import { newHennaToken } from "@/lib/publication";

const uuid = z.string().uuid();
const email = z.string().trim().toLowerCase().email("Adresse e-mail invalide").max(200);

async function invitationInfo(invitationId: string) {
  const supabase = (await createClient())!;
  const { data } = await supabase.from("invitations").select("title, partner_one, partner_two, language").eq("id", invitationId).single();
  if (!data) throw new Error("Invitation introuvable.");
  return { couple: data.partner_one && data.partner_two ? `${data.partner_one} & ${data.partner_two}` : data.title, lang: data.language as string };
}

/** Crée le compte si besoin et envoie l'e-mail de bienvenue avec le lien de connexion. */
export async function sendCoupleAccess(form: FormData) {
  const user = await requireStaff();
  const invitationId = uuid.parse(form.get("id"));
  const to = email.parse(form.get("email"));
  const info = await invitationInfo(invitationId);
  const res = await sendWelcomeEmail(to, info.couple, info.lang);
  if (!res.sent) throw new Error(`E-mail non envoyé : ${res.error ?? "service e-mail"}.`);
  await logActivity({ actorId: user.id, action: "access.sent", resourceType: "invitation", resourceId: invitationId, summary: `Accès à l'espace mariés envoyé à ${to}` });
  revalidatePath(`/admin/invitations/${invitationId}`);
}

/** Ajoute une personne (ex. le conjoint) à l'espace mariés, et lui envoie son accès si demandé. */
export async function addCoupleAccess(form: FormData) {
  const user = await requireStaff();
  const invitationId = uuid.parse(form.get("id"));
  const to = email.parse(form.get("email"));
  const supabase = (await createClient())!;
  const { error } = await supabase.from("invitation_access").insert({ invitation_id: invitationId, email: to, role: "owner", granted_by: user.id });
  if (error && error.code !== "23505") throw new Error(`Ajout impossible : ${error.message}`);
  await logActivity({ actorId: user.id, action: "access.granted", resourceType: "invitation", resourceId: invitationId, summary: `Accès à l'espace mariés accordé à ${to}` });
  if (form.get("envoyer") === "on") {
    const info = await invitationInfo(invitationId);
    const res = await sendWelcomeEmail(to, info.couple, info.lang);
    if (!res.sent) throw new Error(`Accès ajouté, mais e-mail non envoyé : ${res.error ?? "service e-mail"}.`);
  }
  revalidatePath(`/admin/invitations/${invitationId}`);
}

export async function removeCoupleAccess(form: FormData) {
  const user = await requireStaff();
  const invitationId = uuid.parse(form.get("id"));
  const to = email.parse(form.get("email"));
  const supabase = (await createClient())!;
  await supabase.from("invitation_access").delete().eq("invitation_id", invitationId).eq("email", to);
  await logActivity({ actorId: user.id, action: "access.revoked", resourceType: "invitation", resourceId: invitationId, summary: `Accès à l'espace mariés retiré à ${to}` });
  revalidatePath(`/admin/invitations/${invitationId}`);
}

/** Crée (ou remplace) le lien privé « henné + soirée » d'une invitation. */
export async function createHennaLink(form: FormData) {
  const user = await requireStaff();
  const invitationId = z.string().uuid().parse(form.get("id"));
  const supabase = (await createClient())!;
  const { data, error } = await supabase.from("invitations").update({ henna_token: newHennaToken() }).eq("id", invitationId).select("title").single();
  if (error) throw new Error(`Lien non créé : ${error.message}. Avez-vous exécuté la migration 20261107000001_maghreb.sql ?`);
  await logActivity({ actorId: user.id, action: "invitation.henna_link", resourceType: "invitation", resourceId: invitationId, summary: `Lien « henné + soirée » créé pour ${data.title}` });
  revalidatePath(`/admin/invitations/${invitationId}`);
}
