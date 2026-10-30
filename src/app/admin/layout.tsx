import type { Metadata } from "next";
import { AdminNav } from "@/components/admin/AdminNav";
import { requireStaff } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: { default: "Administration", template: "%s · Admin E-Invitly" }, robots: { index: false, follow: false } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  if (!isSupabaseConfigured()) {
    return (
      <main className="mx-auto max-w-xl px-5 py-24 text-center">
        <h1 className="font-serif text-3xl">Administration</h1>
        <p className="mt-4 text-stone">
          Supabase n&apos;est pas configuré. Renseignez les variables d&apos;environnement (voir README) puis redéployez.
        </p>
      </main>
    );
  }
  const user = await requireStaff();
  const supabase = await createClient();
  const { count } = await supabase!
    .from("client_requests")
    .select("id", { count: "exact", head: true })
    .eq("status", "new")
    .is("archived_at", null);

  return (
    <div className="min-h-dvh bg-[#f7f5f0] lg:flex">
      <AdminNav email={user.email} role={user.role} newRequests={count ?? 0} />
      <div className="min-w-0 flex-1">
        <div className="sticky top-14 z-30 border-b border-line bg-[#f7f5f0]/90 px-4 py-3 backdrop-blur lg:top-0 lg:px-8">
          <form action="/admin/recherche" method="get" role="search" className="flex max-w-xl items-center gap-2">
            <label htmlFor="admin-search" className="sr-only">Recherche globale</label>
            <input id="admin-search" name="q" type="search" placeholder="Rechercher un client, une référence, une invitation…" className="field min-h-10 bg-white text-sm" />
            <button type="submit" className="btn btn-secondary btn-sm">Chercher</button>
          </form>
        </div>
        <div className="px-4 py-8 lg:px-8">{children}</div>
      </div>
    </div>
  );
}
