import type { Metadata } from "next";
import Link from "next/link";
import { InvitationView } from "@/components/invitation/InvitationView";
import { Sprig } from "@/components/ornaments";
import { invitationContentSchema, type RendererKey } from "@/lib/invitation/schema";
import { hashPreviewToken } from "@/lib/publication";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata: Metadata = { title: "Aperçu privé", robots: { index: false, follow: false } };

/**
 * Aperçu privé du BROUILLON, par lien temporaire (pour la validation du couple).
 * Le jeton n'est stocké qu'haché ; un jeton expiré ou inconnu ne montre rien.
 */
function Unavailable() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-ivory px-5 text-center">
      <Sprig className="h-24 w-14 text-forest" fill="#A6B5A2" />
      <h1 className="mt-6 font-serif text-3xl">Aperçu indisponible</h1>
      <p className="mt-3 max-w-sm text-sm leading-relaxed text-stone">
        Ce lien d&apos;aperçu a expiré ou n&apos;est plus valable. Demandez un nouveau lien à E-Invitly.
      </p>
      <Link href="/" className="btn btn-secondary mt-8">Découvrir E-Invitly</Link>
    </main>
  );
}

export default async function PreviewPage({ params }: { params: Promise<{ jeton: string }> }) {
  const { jeton } = await params;
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(jeton)) return <Unavailable />;
  const db = createAdminClient();
  if (!db) return <Unavailable />;

  const { data: token } = await db
    .from("preview_tokens")
    .select("invitation_id, expires_at")
    .eq("token_hash", hashPreviewToken(jeton))
    .maybeSingle();
  if (!token || new Date(token.expires_at).getTime() < Date.now()) return <Unavailable />;

  const { data: inv } = await db
    .from("invitations")
    .select("renderer, draft_content, status")
    .eq("id", token.invitation_id)
    .maybeSingle();
  if (!inv || inv.status === "archived") return <Unavailable />;
  const parsed = invitationContentSchema.safeParse(inv.draft_content);
  if (!parsed.success) return <Unavailable />;

  const expires = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris" }).format(new Date(token.expires_at));
  return (
    <>
      <div className="fixed inset-x-0 top-0 z-50 bg-charcoal/85 px-4 py-2 text-center text-[0.72rem] text-ivory backdrop-blur">
        <strong className="font-normal uppercase tracking-[0.2em]">Aperçu privé</strong> · version en préparation, non publiée · lien valable jusqu&apos;au {expires}
      </div>
      <div className="pt-9">
        <InvitationView content={parsed.data} renderer={inv.renderer as RendererKey} mode="preview" />
      </div>
    </>
  );
}
