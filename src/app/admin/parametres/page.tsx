import type { ReactNode } from "react";
import { PageHeader } from "@/components/admin/PageHeader";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { requireStaff } from "@/lib/auth";
import { isEmailConfigured } from "@/lib/email";
import { getSettings } from "@/lib/settings";
import { createClient } from "@/lib/supabase/server";
import { saveBrand, saveHome, saveNotifications, savePolicies, setMemberRole } from "./actions";

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
  const { brand, home, policies, notifications } = settings;
  const faq = [...home.faq, { question: "", answer: "" }, { question: "", answer: "" }];
  const disabled = !isAdmin;

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
              <F label="Instagram (lien)"><input name="instagram" defaultValue={brand.instagram} className="field" placeholder="https://instagram.com/…" /></F>
              <F label="Facebook (lien)"><input name="facebook" defaultValue={brand.facebook} className="field" /></F>
              <F label="Pinterest (lien)"><input name="pinterest" defaultValue={brand.pinterest} className="field" /></F>
              <div className="md:col-span-2"><SubmitButton pendingLabel="Enregistrement…">Enregistrer</SubmitButton></div>
            </fieldset>
          </form>
        </Card>

        <Card title="Page d'accueil et FAQ" description="Pour supprimer une question, videz-la. Deux lignes vides permettent d'en ajouter.">
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
                M&apos;envoyer un e-mail à chaque réponse RSVP (phase 5)
              </label>
              <SubmitButton className="btn btn-secondary btn-sm">Enregistrer</SubmitButton>
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
