import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Logo } from "@/components/brand/Logo";
import { getCurrentUser } from "@/lib/auth";
import { env } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { formatShortDate } from "@/lib/time";

export const metadata: Metadata = { title: "Mon espace", robots: { index: false } };

/** Espace des mariés : uniquement LEURS invitations (règles RLS côté base). */
export default async function ClientSpace() {
  const user = await getCurrentUser();
  if (!user) redirect("/connexion?suite=/mon-espace");
  const supabase = (await createClient())!;
  const [{ data: invitations }, { data: stats }] = await Promise.all([
    supabase.from("invitations").select("id, title, slug, status, event_at").neq("status", "archived").order("event_at"),
    supabase.from("rsvp_stats").select("*"),
  ]);
  const byId = new Map((stats ?? []).map((s) => [s.invitation_id, s]));
  const host = env.siteUrl.replace(/^https?:\/\//, "");

  return (
    <div className="min-h-dvh bg-ivory">
      <header className="flex items-center justify-between border-b border-line px-5 py-4">
        <Logo className="h-8" />
        <form action="/auth/deconnexion" method="post">
          <button className="text-sm text-stone hover:text-danger">Déconnexion</button>
        </form>
      </header>
      <main className="mx-auto max-w-3xl px-5 py-12">
        <p className="eyebrow">Espace mariés</p>
        <h1 className="mt-3 font-serif text-4xl">Bonjour</h1>
        <p className="mt-2 text-sm text-stone">Connecté·e avec {user.email}</p>
        {invitations?.length ? (
          <ul className="mt-8 space-y-4">
            {invitations.map((i) => {
              const s = byId.get(i.id);
              const live = i.status === "published";
              return (
                <li key={i.id} className="card p-5">
                  <h2 className="font-serif text-2xl">{i.title}</h2>
                  <p className="text-sm text-stone">{formatShortDate(i.event_at)}</p>
                  <p className="mt-3 text-sm">
                    {live ? (
                      <>Votre lien : <a className="text-forest underline" href={`/${i.slug}`}>{host}/{i.slug}</a></>
                    ) : (
                      "Votre invitation est en cours de préparation : vous recevrez un aperçu avant sa publication."
                    )}
                  </p>
                  <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {[
                      ["Réponses", s?.responses ?? 0],
                      ["Personnes confirmées", s?.confirmed_people ?? 0],
                      ["Accompagnants", s?.companions ?? 0],
                      ["Refus", s?.declined_responses ?? 0],
                    ].map(([k, v]) => (
                      <div key={k as string}>
                        <dt className="text-xs text-stone">{k}</dt>
                        <dd className="font-serif text-2xl lining-nums tabular-nums">{v}</dd>
                      </div>
                    ))}
                  </dl>
                  <Link href={`/mon-espace/${i.id}`} className="btn btn-primary btn-sm mt-5">Voir toutes les réponses</Link>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="card mt-8 p-6 text-sm text-stone">
            Aucune invitation n&apos;est associée à cette adresse pour l&apos;instant.{" "}
            <Link href="/" className="text-forest underline">Retour au site</Link>
          </p>
        )}
      </main>
    </div>
  );
}
