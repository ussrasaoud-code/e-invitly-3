import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_SETTINGS, type SettingsMap } from "@/lib/settings-defaults";

/** Lit les paramètres en base ; complète avec les valeurs par défaut. */
export const getSettings = cache(async (): Promise<SettingsMap> => {
  const result = Object.fromEntries(
    Object.entries(DEFAULT_SETTINGS).map(([k, v]) => [k, structuredClone(v.value)]),
  ) as SettingsMap;
  const supabase = await createClient();
  if (!supabase) return result;
  const { data, error } = await supabase.from("settings").select("key, value");
  if (error) {
    console.error("[settings]", error.message);
    return result;
  }
  for (const row of data ?? []) {
    if (row.key in result) {
      const key = row.key as keyof SettingsMap;
      (result as Record<string, unknown>)[key] = { ...result[key], ...(row.value as object) };
    }
  }
  return result;
});
