import Image from "next/image";
import Link from "next/link";
import colombe from "../../../public/decor/colombe.png";
import fleurs from "../../../public/decor/fleurs-aquarelle.png";
import { CornerSpray, Divider, Sprig } from "@/components/ornaments";
import { InteractiveDemo } from "@/components/site/InteractiveDemo";
import { SetupNotice } from "@/components/site/SetupNotice";
import { TemplateCard } from "@/components/site/TemplateCard";
import { getSettings } from "@/lib/settings";
import { listPublishedTemplates, listShowcase } from "@/lib/templates";

const STEPS = [
  { n: "01", title: "Choisissez votre modèle", text: "Parcourez nos collections et ouvrez les démos pour trouver l'univers qui vous ressemble." },
  { n: "02", title: "Transmettez vos informations", text: "Prénoms, date, lieux, programme, dress code : un formulaire guidé, étape par étape." },
  { n: "03", title: "Nous personnalisons votre invitation", text: "L'équipe E-Invitly met en page vos textes et vos détails, puis vous envoie un aperçu à valider." },
  { n: "04", title: "Partagez votre lien", text: "Une adresse unique à envoyer à vos invités — et un espace pour suivre leurs réponses." },
];

const BENEFITS = [
  { title: "Un simple lien", text: "Rien à installer : vos invités ouvrent l'invitation depuis un message ou un e-mail." },
  { title: "Pensée pour le téléphone", text: "Une lecture fluide, des boutons faciles à toucher, un chargement rapide." },
  { title: "Animations élégantes", text: "Ouverture d'enveloppe, apparitions douces, sans jamais alourdir la lecture." },
  { title: "Compte à rebours", text: "Calculé à l'heure du lieu de l'événement, où que soient vos invités." },
  { title: "Informations pratiques", text: "Programme, adresses, itinéraires, stationnement, navettes, hébergements." },
  { title: "RSVP intégré", text: "Présence, accompagnants, régimes alimentaires : tout est recueilli au même endroit." },
  { title: "Suivi des réponses", text: "Un espace personnel sécurisé pour consulter et exporter la liste des réponses." },
  { title: "Aucun compte pour vos invités", text: "Ils répondent en quelques secondes, sans inscription." },
];

export default async function HomePage() {
  const [settings, templates, showcase] = await Promise.all([getSettings(), listPublishedTemplates(), listShowcase(3)]);
  const { home } = settings;
  const featured = templates.data.slice(0, 3);

  return (
    <main>
      {/* ── Hero ── */}
      <section className="relative overflow-hidden paper-texture">
        <CornerSpray className="pointer-events-none absolute -left-8 -top-4 hidden w-64 -scale-y-100 text-sage md:block" stroke="#586C60" fill="#A6B5A2" />
        <div className="mx-auto grid max-w-6xl items-center gap-14 px-5 pb-20 pt-12 md:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] md:pb-28 md:pt-20">
          <div className="animate-rise text-center md:text-left">
            <p className="eyebrow">Invitations digitales</p>
            <h1 className="mt-5 font-serif text-[2.6rem] leading-[1.08] text-charcoal sm:text-5xl md:text-[3.6rem]">
              {home.heroTitle}
            </h1>
            <p className="mx-auto mt-6 max-w-xl text-[1.06rem] leading-relaxed text-stone md:mx-0">{home.heroSubtitle}</p>
            <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row sm:flex-wrap md:justify-start">
              <Link href="/invitations" className="btn btn-primary">
                Découvrir les invitations
              </Link>
              <Link href="#comment-ca-marche" className="btn btn-secondary">
                Comment ça marche
              </Link>
            </div>
            <p className="mt-8 font-script text-2xl text-forest">Touchez le cachet pour ouvrir l&apos;invitation</p>
          </div>

          <div className="relative mx-auto w-full min-w-0 max-w-[460px] animate-[rise_1.1s_cubic-bezier(.2,.7,.2,1)_.25s_both] px-8 py-20 sm:px-16 sm:py-12 md:px-0 lg:px-16">
            {/* Décor : colombes et fleurs aquarelle autour du téléphone, avec un espace autour du cadre */}
            <Image src={colombe} alt="" aria-hidden className="pointer-events-none absolute left-0 top-0 z-10 w-16 animate-[float_7s_ease-in-out_infinite] sm:-left-12 sm:top-2 sm:w-24 md:hidden lg:block lg:-left-16 lg:w-24" sizes="96px" priority />
            <Image src={fleurs} alt="" aria-hidden className="pointer-events-none absolute right-0 top-0 w-11 rotate-[200deg] sm:-right-12 sm:top-2 sm:w-24 md:hidden lg:block lg:-right-16 lg:w-24" sizes="96px" />
            <Image src={fleurs} alt="" aria-hidden className="pointer-events-none absolute bottom-0 left-0 w-11 sm:-left-12 sm:bottom-2 sm:w-24 md:hidden lg:block lg:-left-16 lg:w-24" sizes="96px" />
            <Image src={colombe} alt="" aria-hidden className="pointer-events-none absolute bottom-1 right-0 z-10 w-16 -scale-x-100 animate-[float_8s_ease-in-out_1.5s_infinite] sm:-right-12 sm:bottom-4 sm:w-24 md:hidden lg:block lg:-right-16 lg:w-24" sizes="96px" />
            <div className="relative">
              {showcase.length ? <InteractiveDemo items={showcase} showTabs={false} /> : <SetupNotice what="la démonstration" />}
            </div>
          </div>
        </div>
      </section>

      {/* ── Comment ça marche ── */}
      <section id="comment-ca-marche" className="scroll-mt-24 bg-paper px-5 py-20 md:py-28">
        <div className="mx-auto max-w-6xl">
          <div className="text-center">
            <p className="eyebrow">Comment ça marche</p>
            <h2 className="mt-4 font-serif text-4xl md:text-5xl">Quatre étapes, et nous nous occupons du reste</h2>
            <Divider className="mx-auto mt-6 h-5 w-40 text-sage" />
          </div>
          <ol className="mt-14 grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((s, i) => (
              <li key={s.n} className={`relative ${i === 2 ? "lg:-mt-2" : ""}`}>
                <span className="font-display text-sm tracking-[0.3em] text-sage">{s.n}</span>
                <h3 className="mt-3 font-serif text-2xl leading-snug">{s.title}</h3>
                <p className="mt-3 leading-relaxed text-stone">{s.text}</p>
                {i === 2 ? (
                  <p className="mt-3 inline-block border-b border-sage pb-0.5 text-sm text-forest">Réalisé par notre équipe</p>
                ) : null}
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ── Collections ── */}
      <section className="px-5 py-20 md:py-28">
        <div className="mx-auto max-w-6xl">
          <div className="flex flex-col items-center justify-between gap-6 text-center md:flex-row md:items-end md:text-left">
            <div>
              <p className="eyebrow">Nos collections</p>
              <h2 className="mt-4 font-serif text-4xl md:text-5xl">Des modèles comme de la papeterie fine</h2>
            </div>
            <Link href="/invitations" className="btn btn-ghost">
              Tout le catalogue →
            </Link>
          </div>
          <div className="mt-14">
            {!templates.configured ? (
              <SetupNotice />
            ) : featured.length ? (
              <div className="grid gap-12 sm:grid-cols-2 lg:grid-cols-3">
                {featured.map((t, i) => (
                  <TemplateCard key={t.id} template={t} priority={i === 0} />
                ))}
              </div>
            ) : (
              <p className="text-center text-stone">Les premiers modèles arrivent très bientôt.</p>
            )}
          </div>
        </div>
      </section>

      {/* ── Avantages ── */}
      <section id="avantages" className="scroll-mt-24 border-y border-line bg-white px-5 py-20 md:py-28">
        <div className="mx-auto max-w-6xl">
          <div className="text-center">
            <p className="eyebrow">Les avantages</p>
            <h2 className="mt-4 font-serif text-4xl md:text-5xl">Tout ce que vos invités doivent savoir, au même endroit</h2>
          </div>
          <ul className="mt-14 grid gap-x-10 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
            {BENEFITS.map((b) => (
              <li key={b.title} className="border-t border-line pt-5">
                <h3 className="font-serif text-xl">{b.title}</h3>
                <p className="mt-2 text-[0.95rem] leading-relaxed text-stone">{b.text}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ── Aperçu interactif ── */}
      <section className="relative overflow-hidden px-5 py-20 md:py-28">
        <Sprig className="pointer-events-none absolute -right-4 top-20 hidden h-80 text-sage md:block" stroke="#586C60" fill="#A6B5A2" />
        <div className="mx-auto grid max-w-5xl items-center gap-14 md:grid-cols-2">
          <div className="text-center md:text-left">
            <p className="eyebrow">Aperçu d&apos;une invitation</p>
            <h2 className="mt-4 font-serif text-4xl md:text-5xl">Essayez-la comme vos invités</h2>
            <p className="mt-5 leading-relaxed text-stone">
              Ouvrez l&apos;enveloppe, faites défiler le programme, testez le formulaire de réponse. Chaque modèle
              a sa propre mise en page, ses couleurs et ses animations.
            </p>
            <p className="mt-4 text-sm italic text-stone">Contenu de démonstration — prénoms et lieux fictifs.</p>
          </div>
          {showcase.length ? <InteractiveDemo items={showcase} initial={showcase.length > 1 ? 1 : 0} /> : <SetupNotice what="la démonstration" />}
        </div>
      </section>

      {/* ── FAQ ── */}
      <section id="faq" className="scroll-mt-24 bg-paper px-5 py-20 md:py-28">
        <div className="mx-auto max-w-3xl">
          <div className="text-center">
            <p className="eyebrow">Questions fréquentes</p>
            <h2 className="mt-4 font-serif text-4xl md:text-5xl">Vous vous demandez peut-être…</h2>
          </div>
          <div className="mt-12 divide-y divide-line border-y border-line">
            {home.faq.map((f) => (
              <details key={f.question} className="group py-5">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-6 font-serif text-xl [&::-webkit-details-marker]:hidden">
                  {f.question}
                  <span aria-hidden="true" className="text-2xl font-light text-forest transition-transform group-open:rotate-45">
                    +
                  </span>
                </summary>
                <p className="mt-3 leading-relaxed text-stone">{f.answer}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ── Appel final ── */}
      <section className="px-5 py-20 text-center md:py-24">
        <p className="font-script text-4xl text-forest">Et si on commençait ?</p>
        <p className="mx-auto mt-4 max-w-md text-stone">Choisissez un modèle : nous revenons vers vous avec un aperçu personnalisé.</p>
        <Link href="/invitations" className="btn btn-primary mt-8">
          Découvrir les invitations
        </Link>
      </section>
    </main>
  );
}
