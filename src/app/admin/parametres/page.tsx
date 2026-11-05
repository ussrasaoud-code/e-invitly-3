import type { ReactNode } from "react";
import { PageHeader } from "@/components/admin/PageHeader";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { requireStaff } from "@/lib/auth";
import { isEmailConfigured } from "@/lib/email";
import { getSettings } from "@/lib/settings";
import { loadConnection } from "@/lib/instagram-feed";
import { formatDateTime } from "@/lib/time";
import { createClient } from "@/lib/supabase/server";
import { LANG_META, SITE_LANGS, localePath } from "@/lib/i18n/config";
import { LANGUAGE_LABELS } from "@/lib/invitation/schema";
import { connectInstagram, disconnectInstagram, saveAnalytics, saveBrand, saveHome, saveLanguages, saveNotifications, savePolicies, saveProtection, setMemberRole } from "./actions";

export const metadata = { title: "Paramètres" };

function Card({ title, description, children }: { title: string; description?: ReactNode; children: ReactNode }) {
  return (
    <section className="card p-5">
      <h2 className="font-serif text-2xl">{title}</h2>
      {description ? <p className="mt-1 text-sm text-stone">{description}</p> : null}
      <div className="mt-5">{children}</div>
    </section>
  );
}

function F({ label, children, className = "" }: { label: string; children: ReactNode; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="field-label !text-xs">{label}</span>
      {children}
    </label>
  );
}

export default async function SettingsPage() {
  const user = await requireStaff();
  const isAdmin = user.role === "admin";
  const settings = await getSettings();
  const supabase = (await createClient())!;
  const { data: team } = await supabase.from("profiles").select("email, full_name, role").in("role", ["admin", "collaborator"]).order("email");
  const { brand, home, policies, notifications, languages, protection, analytics } = settings;
  const enabledLangs = new Set(["fr", ...(languages.enabled ?? [])]);
  const faq = [...home.faq, { question: "", answer: "" }, { question: "", answer: "" }];
  const disabled = !isAdmin;
  const ig = await loadConnection();

  return (
    <>
      <PageHeader title="Paramètres" description={isAdmin ? "Modifiables sans toucher au code. Les changements sont visibles immédiatement sur le site." : "Lecture seule : seuls les administrateurs peuvent modifier les paramètres."} />
      <div className="grid max-w-5xl gap-6">
        <Card title="Marque et contact">
          <form action={saveBrand} className="grid gap-4 md:grid-cols-2">
            <fieldset disabled={disabled} className="contents">
              <F label="Nom de la marque"><input name="name" defaultValue={brand.name} className="field" required /></F>
              <F label="Signature (pied de page)"><input name="tagline" defaultValue={brand.tagline} className="field" /></F>
              <F label="E-mail de contact"><input name="contactEmail" type="email" defaultValue={brand.contactEmail} className="field" /></F>
              <F label="Téléphone de contact"><input name="contactPhone" defaultValue={brand.contactPhone} className="field" /></F>
              <F label="WhatsApp Business (format international, ex. +33 6 12 34 56 78)"><input name="whatsapp" type="tel" defaultValue={brand.whatsapp} className="field" placeholder="+33 6 12 34 56 78" /></F>
              <F label="Instagram (@compte ou lien)"><input name="instagram" defaultValue={brand.instagram} className="field" placeholder="@e.invitly" /></F>
              <F label="Facebook (lien)"><input name="facebook" defaultValue={brand.facebook} className="field" /></F>
              <F label="Pinterest (lien)"><input name="pinterest" defaultValue={brand.pinterest} className="field" /></F>
              <div className="md:col-span-2"><SubmitButton pendingLabel="Enregistrement…">Enregistrer</SubmitButton></div>
            </fieldset>
          </form>
        </Card>

        <Card
          title="Langues du site"
          description="Le site vitrine existe en 7 langues. Ouvrez une langue aux visiteurs après avoir relu ses textes : tant qu'elle est fermée, seule l'équipe connectée peut la voir (lien « Relire »). Les visiteurs ne voient dans le sélecteur que les langues ouvertes."
        >
          <form action={saveLanguages} className="space-y-3">
            <fieldset disabled={disabled} className="contents">
              <ul className="divide-y divide-line border-y border-line">
                {SITE_LANGS.map((l) => (
                  <li key={l} className="flex flex-wrap items-center justify-between gap-3 py-2.5">
                    <label className="flex items-center gap-3 text-sm">
                      <input
                        type="checkbox"
                        name={`lang_${l}`}
                        defaultChecked={enabledLangs.has(l)}
                        disabled={l === "fr"}
                        className="h-4 w-4 accent-forest"
                      />
                      <span>
                        {LANGUAGE_LABELS[l]} <span className="text-stone" lang={l}>· {LANG_META[l].native}</span>
                        {l === "fr" ? <span className="text-stone"> · toujours ouverte</span> : null}
                      </span>
                    </label>
                    <a href={localePath(l, "/")} target="_blank" rel="noopener" className="text-sm text-forest underline underline-offset-4">
                      Relire ↗
                    </a>
                  </li>
                ))}
              </ul>
              <div className="flex flex-wrap items-center gap-4">
                <SubmitButton pendingLabel="Enregistrement…">Enregistrer les langues</SubmitButton>
                <a href="/admin/traductions" className="text-sm text-forest underline underline-offset-4">Relire tous les textes traduits</a>
              </div>
            </fieldset>
          </form>
        </Card>

        <Card title="Page d'accueil et FAQ" description="Version française. Pour supprimer une question, videz-la. Deux lignes vides permettent d'en ajouter. Les autres langues affichent des textes traduits par défaut.">
          <form action={saveHome} className="space-y-4">
            <fieldset disabled={disabled} className="space-y-4">
              <F label="Titre principal"><input name="heroTitle" defaultValue={home.heroTitle} className="field" required /></F>
              <F label="Sous-titre"><textarea name="heroSubtitle" defaultValue={home.heroSubtitle} rows={2} className="field" /></F>
              {faq.map((f, i) => (
                <div key={i} className="grid gap-2 rounded-sm border border-line p-3 md:grid-cols-[1fr_1.4fr]">
                  <F label={`Question ${i + 1}`}><input name="faq_q" defaultValue={f.question} className="field text-sm" /></F>
                  <F label="Réponse"><textarea name="faq_a" defaultValue={f.answer} rows={2} className="field text-sm" /></F>
                </div>
              ))}
              <SubmitButton pendingLabel="Enregistrement…">Enregistrer</SubmitButton>
            </fieldset>
          </form>
        </Card>

        <Card
          title="Politiques et pages légales"
          description="Séparez les paragraphes par une ligne vide ; une ligne commençant par « ## » devient un intertitre. Faites valider ces textes par un professionnel."
        >
          <form action={savePolicies} className="grid gap-4 md:grid-cols-2">
            <fieldset disabled={disabled} className="contents">
              <F label="Mentions légales" className="md:col-span-2"><textarea name="legalNotice" defaultValue={policies.legalNotice} rows={6} className="field text-sm" /></F>
              <F label="Politique de confidentialité" className="md:col-span-2"><textarea name="privacyPolicy" defaultValue={policies.privacyPolicy} rows={8} className="field text-sm" /></F>
              <F label="Conditions générales de vente (lien masqué tant que vide)" className="md:col-span-2"><textarea name="termsOfSale" defaultValue={policies.termsOfSale} rows={6} className="field text-sm" /></F>
              <F label="Durée de mise en ligne par défaut"><input name="publicationDuration" defaultValue={policies.publicationDuration} className="field" placeholder="ex. 12 mois après l'événement" /></F>
              <F label="Délai de création (affiché sur les fiches des modèles)"><input name="creationDelay" defaultValue={policies.creationDelay ?? ""} maxLength={80} className="field" placeholder="ex. 7 à 14 jours après réception de vos informations" /></F>
              <F label="Conservation des réponses RSVP après l'événement (mois)"><input name="rsvpRetentionMonths" type="number" min={1} max={120} defaultValue={policies.rsvpRetentionMonths} className="field" /></F>
              <div className="md:col-span-2"><SubmitButton pendingLabel="Enregistrement…">Enregistrer</SubmitButton></div>
            </fieldset>
          </form>
        </Card>

        <Card
          title="Notifications"
          description={
            isEmailConfigured()
              ? "Le service d'e-mails est configuré."
              : "Service d'e-mails non configuré (variable RESEND_API_KEY) : aucune notification ne part pour l'instant, les demandes restent bien enregistrées."
          }
        >
          <form action={saveNotifications} className="space-y-3">
            <fieldset disabled={disabled} className="space-y-3">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="notifyOnNewRequest" defaultChecked={notifications.notifyOnNewRequest} className="h-4 w-4 accent-forest" />
                M&apos;envoyer un e-mail à chaque nouvelle demande
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="notifyOnNewRsvp" defaultChecked={notifications.notifyOnNewRsvp} className="h-4 w-4 accent-forest" />
                M&apos;envoyer un e-mail à chaque réponse RSVP
              </label>
              <SubmitButton className="btn btn-secondary btn-sm">Enregistrer</SubmitButton>
            </fieldset>
          </form>
        </Card>

        <Card
          title="Protection des aperçus et des démos"
          description="Empêche qu'un lien d'aperçu serve d'invitation avant le paiement. Aucun site ne peut bloquer totalement une capture d'écran ou un enregistrement vidéo du téléphone : le filigrane et la durée limitée rendent ces copies inutilisables."
        >
          <form action={saveProtection} className="space-y-3">
            <fieldset disabled={disabled} className="space-y-3">
              <label className="flex flex-wrap items-center gap-2 text-sm">
                Un lien d&apos;aperçu expire après
                <input type="number" name="previewHours" min={1} max={720} defaultValue={protection.previewHours} className="field min-h-9 w-20 py-1 text-sm" />
                heures
                <span className="text-xs text-stone">(48 h conseillé ; s&apos;applique aux nouveaux liens)</span>
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="previewWatermark" defaultChecked={protection.previewWatermark} className="h-4 w-4 accent-forest" />
                Filigrane sur les aperçus envoyés aux couples
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="demoWatermark" defaultChecked={protection.demoWatermark} className="h-4 w-4 accent-forest" />
                Filigrane sur les démos du catalogue
              </label>
              <label className="flex flex-wrap items-center gap-2 text-sm">
                Texte du filigrane
                <input name="watermarkText" maxLength={40} defaultValue={protection.watermarkText} placeholder="APERÇU · E-INVITLY" className="field min-h-9 w-64 py-1 text-sm" />
              </label>
              <label className="flex items-start gap-2 text-sm">
                <input type="checkbox" name="deterrents" defaultChecked={protection.deterrents} className="mt-0.5 h-4 w-4 accent-forest" />
                <span>
                  Gêner la copie sur les aperçus et démos
                  <span className="block text-xs text-stone">Clic droit, sélection du texte, enregistrement des images, impression et raccourcis d&apos;enregistrement désactivés ; le contenu se floute quand la page perd le focus (outil de capture sur ordinateur).</span>
                </span>
              </label>
              <SubmitButton className="btn btn-secondary btn-sm">Enregistrer</SubmitButton>
            </fieldset>
          </form>
        </Card>

        <Card
          title="Instagram — derniers posts sur le site"
          description="Affiche une bande « Suivez-nous sur Instagram » en bas du site vitrine avec vos derniers posts (mise à jour toutes les heures). Nécessite un compte Instagram professionnel (Créateur ou Entreprise). Les images passent par votre site : aucun cookie Instagram n'est déposé chez vos visiteurs."
        >
          {ig ? (
            <div className="space-y-3 text-sm">
              <p>
                <span className="text-forest">●</span> Connecté au compte <strong className="font-medium">@{ig.username}</strong> depuis le {formatDateTime(ig.savedAt)}. {ig.kind === "facebook" ? "Jeton d'utilisateur système (sans expiration)." : <>Le jeton est renouvelé automatiquement (dernier renouvellement : {formatDateTime(ig.refreshedAt)}).</>}
              </p>
              {ig.lastError ? (
                <p role="alert" className="border border-warning/40 bg-[#fbf3e2] px-3 py-2">
                  Problème avec Instagram : {ig.lastError}. Si les posts n&apos;apparaissent plus, générez un nouveau jeton et collez-le ci-dessous.
                </p>
              ) : null}
              <form action={disconnectInstagram}>
                <fieldset disabled={disabled}>
                  <SubmitButton className="btn btn-ghost btn-sm text-danger" confirm="Retirer la bande Instagram du site ?">Déconnecter Instagram</SubmitButton>
                </fieldset>
              </form>
            </div>
          ) : null}
          <form action={connectInstagram} className="mt-4 space-y-3">
            <fieldset disabled={disabled} className="space-y-3">
              <F label={ig ? "Remplacer le jeton d'accès" : "Jeton d'accès Instagram"}>
                <input name="igToken" type="password" autoComplete="off" placeholder="IGAA… ou EAA…" className="field" />
              </F>
              <F label="Identifiant du compte Instagram (seulement pour un jeton EAA…, si demandé)">
                <input name="igUserId" inputMode="numeric" autoComplete="off" placeholder="17841400000000000" maxLength={30} className="field" />
              </F>
              <p className="text-xs text-stone">
                À générer dans developers.facebook.com → votre application → Instagram → « Générer des jetons d&apos;accès ». C&apos;est une donnée secrète : ne la partagez avec personne.
              </p>
              <SubmitButton className="btn btn-secondary btn-sm" pendingLabel="Vérification…">{ig ? "Remplacer" : "Connecter Instagram"}</SubmitButton>
            </fieldset>
          </form>
        </Card>

        <Card
          title="Mesure d'audience et cookies"
          description="Laissez vide pour n'utiliser aucun outil : le site n'a alors besoin d'aucun bandeau cookies. Dès qu'un identifiant est renseigné, un bandeau demande l'accord des visiteurs (Tout accepter / Tout refuser / Personnaliser) et l'outil n'est chargé qu'après leur accord. Uniquement sur le site vitrine : jamais sur les invitations des couples, l'espace mariés ou l'administration."
        >
          <form action={saveAnalytics} className="grid gap-4 md:grid-cols-2">
            <fieldset disabled={disabled} className="contents">
              <F label="Google Analytics 4 — identifiant de mesure (G-…)">
                <input name="gaId" defaultValue={analytics.gaId} placeholder="G-ABC123XYZ" maxLength={24} className="field" />
              </F>
              <F label="Pixel Meta (Facebook / Instagram) — identifiant">
                <input name="metaPixelId" defaultValue={analytics.metaPixelId} placeholder="123456789012345" maxLength={20} inputMode="numeric" className="field" />
              </F>
              <p className="text-xs text-stone md:col-span-2">Pensez à mettre à jour votre politique de confidentialité (outils utilisés, finalités, durée de conservation du choix : 6 mois).</p>
              <div className="md:col-span-2"><SubmitButton className="btn btn-secondary btn-sm">Enregistrer</SubmitButton></div>
            </fieldset>
          </form>
        </Card>

        <Card title="Équipe" description="Comptes ayant accès à l'administration. Créez d'abord le compte dans Supabase (Authentication → Add user), puis attribuez-lui un rôle ici.">
          <ul className="divide-y divide-line text-sm">
            {team?.map((m) => (
              <li key={m.email} className="flex justify-between py-2">
                <span>{m.email}</span>
                <span className="text-stone">{m.role === "admin" ? "Administratrice / administrateur" : "Collaborateur·rice"}</span>
              </li>
            ))}
          </ul>
          {isAdmin ? (
            <form action={setMemberRole} className="mt-4 grid gap-2 sm:grid-cols-[1fr_180px_auto] sm:items-end">
              <F label="E-mail du compte"><input name="email" type="email" required className="field min-h-10 text-sm" /></F>
              <F label="Rôle">
                <select name="role" className="field min-h-10 text-sm">
                  <option value="collaborator">Collaborateur·rice</option>
                  <option value="admin">Administrateur·rice</option>
                  <option value="client">Retirer l&apos;accès admin</option>
                </select>
              </F>
              <SubmitButton className="btn btn-secondary btn-sm">Appliquer</SubmitButton>
            </form>
          ) : null}
          <p className="mt-4 text-xs text-stone">Les accès des couples se gèrent invitation par invitation (onglet Publication).</p>
        </Card>
      </div>
    </>
  );
}
