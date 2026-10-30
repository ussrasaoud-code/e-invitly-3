import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** Déconnexion (POST uniquement, pour éviter une déconnexion par simple lien). */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  await supabase?.auth.signOut();
  return NextResponse.redirect(new URL("/connexion", request.nextUrl.origin), { status: 303 });
}
