/** Lecture centralisée des variables d'environnement. */
export const env = {
  // Tolère l'adresse copiée depuis la page « Data API » (…supabase.co/rest/v1/)
  supabaseUrl: (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim().replace(/\/rest\/v1\/?$/, "").replace(/\/+$/, ""),
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
  siteUrl: (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, ""),
};

/** true si Supabase est configuré (sinon l'interface affiche un message d'installation). */
export const isSupabaseConfigured = () => Boolean(env.supabaseUrl && env.supabaseAnonKey);
