import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** Lien de connexion envoyé par e-mail : vérifie le jeton (usage unique), ouvre la session, redirige. */
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const tokenHash = url.searchParams.get("token_hash");
  const suite = url.searchParams.get("suite") ?? "/mon-espace";
  const next = /^\/(?!\/)[\w\-/]*$/.test(suite) ? suite : "/mon-espace";
  const supabase = await createClient();
  if (tokenHash && supabase) {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: "magiclink" });
    if (!error) {
      const { data } = await supabase.auth.getUser();
      if (data.user && next === "/mon-espace") {
        const { data: profile } = await supabase.from("profiles").select("role").eq("id", data.user.id).maybeSingle();
        if (profile?.role === "admin" || profile?.role === "collaborator") return NextResponse.redirect(new URL("/admin", url.origin));
      }
      return NextResponse.redirect(new URL(next, url.origin));
    }
  }
  return NextResponse.redirect(new URL("/connexion?erreur=lien", url.origin));
}
