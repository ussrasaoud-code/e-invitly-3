import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export type Role = "admin" | "collaborator" | "client";
export type CurrentUser = { id: string; email: string; fullName: string | null; role: Role };

/** Utilisateur connecté + rôle lu en base (jamais depuis le navigateur). */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const supabase = await createClient();
  if (!supabase) return null;
  const { data } = await supabase.auth.getUser();
  if (!data.user) return null;
  const { data: profile } = await supabase
    .from("profiles")
    .select("email, full_name, role")
    .eq("id", data.user.id)
    .maybeSingle();
  return {
    id: data.user.id,
    email: profile?.email ?? data.user.email ?? "",
    fullName: profile?.full_name ?? null,
    role: (profile?.role as Role) ?? "client",
  };
});

/** À appeler en tête de chaque page ET de chaque action d'administration. */
export async function requireStaff(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/connexion?suite=/admin");
  if (user.role !== "admin" && user.role !== "collaborator") redirect("/connexion?erreur=acces");
  return user;
}

export async function requireAdmin(): Promise<CurrentUser> {
  const user = await requireStaff();
  if (user.role !== "admin") redirect("/admin?erreur=reserve-admin");
  return user;
}
