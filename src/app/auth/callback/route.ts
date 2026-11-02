import { NextResponse, type NextRequest } from "next/server";
import { publicUrl } from "@/lib/request-origin";
import { createClient } from "@/lib/supabase/server";

/** Retour du lien magique : échange le code contre une session puis redirige. */
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const code = url.searchParams.get("code");
  const suite = url.searchParams.get("suite") ?? "/mon-espace";
  const next = /^\/(?!\/)[\w\-/]*$/.test(suite) ? suite : "/mon-espace";

  const supabase = await createClient();
  if (code && supabase) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // Le personnel arrive sur l'administration, les couples sur leur espace.
      const { data } = await supabase.auth.getUser();
      if (data.user && next === "/mon-espace") {
        const { data: profile } = await supabase.from("profiles").select("role").eq("id", data.user.id).maybeSingle();
        if (profile?.role === "admin" || profile?.role === "collaborator") {
          return NextResponse.redirect(publicUrl("/admin", request));
        }
      }
      return NextResponse.redirect(publicUrl(next, request));
    }
  }
  return NextResponse.redirect(publicUrl("/connexion?erreur=lien", request));
}
