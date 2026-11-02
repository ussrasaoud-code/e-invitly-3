# E-Invitly

Plateforme d'invitations digitales : site vitrine, catalogue de modèles, formulaire de demande,
administration, et (phases suivantes) publication des invitations et RSVP.

Une seule application **Next.js** hébergée sur **Netlify**, avec **Supabase** (base de données,
connexion, fichiers) et **Resend** (e-mails). Ajouter un couple ne demande jamais de toucher au code,
au DNS ou au déploiement.

---

## 1. Où en est le projet

| Phase | Contenu | État |
| --- | --- | --- |
| 1 — Fondations | Projet, design system, base de données + sécurité RLS, connexion par lien magique, rôles | ✅ fait et testé |
| 2 — Site vitrine | Accueil, catalogue filtrable, fiches modèles, démos, formulaire en 6 étapes, pages légales | ✅ fait et testé |
| 3 — Administration | Vue d'ensemble, demandes, conversion en invitation, éditeur par sections avec aperçu, modèles et versions, paramètres, recherche | ✅ fait et testé |
| 3b — Médias | Import multiple (glisser-déposer), collections, filtres, recherche, fiche et mots-clés, choix depuis l'éditeur et les modèles, SVG contrôlés, suppression bloquée si le fichier est utilisé | ✅ fait et testé |
| 4 — Publication | Page publique `/[adresse]`, aperçu privé (7 jours), publier / dépublier, historique, redirections, code d'accès, noindex | ✅ fait et testé |
| 5 — RSVP | Formulaire réel dans l'invitation, réglages par invitation, questions personnalisées, invités nominatifs avec codes, statistiques par moment, corrections tracées, exports Excel/CSV, espace couple, notifications | ✅ fait et testé |
| 6 — Éditeur visuel | Éditeur 3 colonnes (invitations et modèles) : éléments du modèle sélectionnables (titres, prénoms, ornements : modifier, déplacer, recolorer, retirer), calques d'illustrations et de textes libres déplaçables, redimensionnables, pivotables, opacité, miroir, devant/derrière, teinte, verrouillage, copier-coller ; animations par élément ; sections texte libre et bande décorative, dupliquer / supprimer ; historique du brouillon avec restauration ; modèle vierge « page blanche » ; 12 polices au choix par texte ; sections agrandies à la souris ; éléments dégroupables (prénoms, listes) et calques groupables ; formes (cadres, arches, cercles, lignes…) avec 18 formats prêts à l'emploi | ✅ fait et testé |
| 7b — Paiement | Lien de paiement par commande (au prix du modèle) envoyé après validation de l'aperçu ; page de paiement en 7 langues ; carte bancaire, Apple Pay et Google Pay (Stripe Checkout) et PayPal ; montant toujours fixé par le serveur et vérifié à l'encaissement ; webhook Stripe signé ; confirmation par e-mail au client et à l'équipe ; « Marquer comme payé » (virement, espèces) ; première publication bloquée tant que la commande n'est pas payée (sauf « Publier sans paiement ») | ✅ fait et testé (mode test) |
| 7 — Langues et finalisation | Site vitrine et invitations en 7 langues (FR, EN, AR, ES, IT, DE, NL), adresses /en /ar…, sélecteur, suggestion selon le téléphone et le pays, langues ouvertes une à une (Paramètres → Langues), page de relecture des traductions ; versions par langue des modèles (un design, des textes traduits, synchronisation du design), fiche catalogue traduite, prix traduits, démo multilingue, langue choisie dans la demande et reprise à la conversion ; audit d'accessibilité (axe, WCAG 2.1 AA) ; plan du site et hreflang | ✅ fait et testé — reste la liste de mise en ligne ci-dessous |

Les fonctions pas encore disponibles sont signalées comme telles dans l'administration : aucun bouton
factice.

**Tests réalisés** : 29 tests de sécurité de la base, 52 tests unitaires (paiements, signature Stripe, langues, versions par langue, prix, adresses, fuseaux horaires,
conversion demande → invitation, règles RSVP, médias, calques, formes, alignement, programme v2), 69 vérifications de bout en bout dans un vrai
navigateur (demande, connexion, conversion, éditeur, aperçu, publication, code d'accès, réponses RSVP,
codes invités, corrections, exports, espace couple, médias, éditeur visuel, historique, accès refusés).

### Espace mariés et e-mails de connexion

- À la conversion d'une demande, le compte du client est créé et il reçoit un **e-mail de bienvenue**
  (dans la langue de son invitation) avec un lien de connexion à son espace.
- *Invitation → Publication → Espace mariés* : renvoyer l'accès, **ajouter une personne** (le conjoint),
  retirer un accès.
- Les liens de connexion partent par **Resend** (pas par le service d'e-mails de Supabase, limité à quelques
  envois par heure). Indispensable : `RESEND_API_KEY` et `EMAIL_FROM` (domaine vérifié) dans Netlify.
- L'espace mariés existe dans les 7 langues (sélecteur en haut de page).

### Paiements en ligne (PayPal et carte bancaire)

**Fonctionnement** : demande → aperçu validé → *Invitation → onglet Publication → Paiement →
« Créer le lien de paiement »* (montant = prix du modèle) → « Envoyer au client par e-mail » (ou copier
le lien) → le client paie par carte ou PayPal → vous recevez un e-mail → vous publiez.

**PayPal**
1. Créez un compte **PayPal Business** (gratuit) sur paypal.com.
2. Sur [developer.paypal.com](https://developer.paypal.com) → *Apps & Credentials* → onglet **Sandbox** (test)
   → *Create App*. Copiez le **Client ID** et le **Secret**.
3. Dans Netlify → *Site configuration → Environment variables* :
   `NEXT_PUBLIC_PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET` (laissez `PAYPAL_ENV` vide = mode test).
4. Testez avec un compte acheteur de test (*Sandbox → Accounts*).
5. Pour les vrais paiements : onglet **Live** → nouvelle app → remplacez les deux clés et ajoutez
   `PAYPAL_ENV=live`, puis redéployez.

**Carte bancaire, Apple Pay, Google Pay (Stripe)**
1. Créez un compte sur [stripe.com](https://stripe.com) (gratuit, commission par paiement).
2. *Développeurs → Clés API* (mode test) : copiez la **clé secrète** `sk_test_…` → `STRIPE_SECRET_KEY` dans Netlify.
3. *Développeurs → Webhooks → Ajouter un point de terminaison* :
   `https://e-invitly.com/api/stripe/webhook`, événement `checkout.session.completed`.
   Copiez la **clé secrète de signature** `whsec_…` → `STRIPE_WEBHOOK_SECRET`.
4. *Paramètres → Moyens de paiement* : activez Apple Pay, Google Pay (et Bancontact, iDEAL… si vous le souhaitez).
5. Pour les vrais paiements : activez le compte (identité, IBAN), puis remplacez par les clés `sk_live_…`
   et le webhook du mode réel.

Tant qu'aucune clé n'est renseignée, la page de paiement indique au client de vous contacter.
⚠️ Les clés secrètes vont uniquement dans Netlify, jamais dans le code ni par message.

### Liste de mise en ligne (phase 7)

- [ ] **Supabase** : exécuter `20261105000001_languages.sql` puis `20261106000001_payments.sql`.
- [ ] **Paiements** : comptes PayPal Business et Stripe, clés dans Netlify (voir ci-dessus), un paiement de test complet.
- [ ] **Langues** : relire chaque langue dans *Admin → Paramètres → Relire tous les textes traduits*
      (idéalement par un locuteur natif), puis l'ouvrir dans *Paramètres → Langues*.
- [ ] **Modèles** : pour chaque modèle, *Éditeur visuel → + Langue*, traduire les textes de démo,
      puis *Enregistrer une nouvelle version* ; traduire la fiche (*onglet Fiche catalogue*).
- [ ] **Netlify** : `NEXT_PUBLIC_SITE_URL=https://e-invitly.com` (sert au plan du site et aux liens des e-mails).
- [ ] **Supabase → Authentication → URL Configuration** : *Site URL* `https://e-invitly.com` et
      *Redirect URL* `https://e-invitly.com/auth/callback`.
- [ ] **Resend** : domaine `e-invitly.com` vérifié (enregistrements DNS), puis `EMAIL_FROM`
      (ex. `E-Invitly <bonjour@e-invitly.com>`) et `RESEND_API_KEY` dans Netlify.
- [ ] **Pages légales** : remplir mentions légales, confidentialité et CGV dans *Paramètres*
      (version française, qui fait foi ; les autres langues l'indiquent).
- [ ] **Google Search Console** : ajouter `e-invitly.com` et soumettre `https://e-invitly.com/sitemap.xml`.
- [ ] **Sauvegardes Supabase** : vérifier qu'elles sont actives (offre payante pour les sauvegardes quotidiennes).
- [ ] **Dernier passage sur téléphone** : accueil, catalogue, démo, formulaire, une invitation publiée et son RSVP,
      en français puis dans chaque langue ouverte.

---

## 2. Mise en ligne, pas à pas

Comptez environ une heure. Vous aurez besoin de quatre comptes gratuits : **GitHub**, **Supabase**,
**Netlify** et **Resend** (déjà créé).

> Les menus des services évoluent : si un intitulé diffère légèrement, cherchez l'équivalent.

### Étape A — Supabase (base de données)

1. Sur [supabase.com](https://supabase.com), créez un projet nommé `e-invitly`, **région Europe**
   (ex. Paris ou Francfort). Notez le mot de passe de la base dans un gestionnaire de mots de passe.
2. Ouvrez **SQL Editor** → *New query*. Copiez-collez tout le contenu du fichier
   `supabase/migrations/20261026000001_init.sql`, puis cliquez sur **Run**. Faites de même, dans
   l'ordre, avec chaque fichier suivant du dossier `supabase/migrations`
   (`20261031000001_publication.sql`, `20261101000001_rsvp.sql`, `20261102000001_media.sql`, `20261103000001_editor.sql`, `20261104000001_template_drafts.sql`, `20261105000001_languages.sql`, `20261106000001_payments.sql`…). Chaque fichier ne s'exécute qu'une seule fois.
3. Nouvelle requête : copiez-collez `supabase/seed.sql`, puis **Run**. Les modèles *The Garden* et
   *Province* sont créés.
4. **Authentication → Sign In / Providers** : laissez *Email* activé et **désactivez « Allow new
   users to sign up »** (seule l'administration crée des comptes).
5. **Authentication → URL Configuration** :
   - *Site URL* : l'adresse Netlify de préproduction (étape C), puis `https://e-invitly.com`.
   - *Redirect URLs* : ajoutez `https://VOTRE-SITE.netlify.app/auth/callback`,
     `https://e-invitly.com/auth/callback` et `http://localhost:3000/auth/callback`.
6. **Votre compte administratrice** : *Authentication → Users → Add user → Create new user*
   avec votre e-mail. Puis dans **SQL Editor** :
   ```sql
   update public.profiles set role = 'admin' where email = 'votre@email.fr';
   ```
7. **Project Settings → API** (ou *API Keys*) : notez l'**URL du projet**, la clé **publique**
   (`anon` / *publishable*) et la clé **secrète** (`service_role` / *secret*).
   ⚠️ La clé secrète ne doit jamais être publiée ni envoyée par message.

### Étape B — GitHub (le code)

1. Créez un dépôt **privé** `e-invitly` sur [github.com](https://github.com).
2. Envoyez-y ce dossier (bouton *uploading an existing file*, ou GitHub Desktop).
   Le fichier `.gitignore` empêche l'envoi des secrets (`.env.local`).

### Étape C — Netlify (l'hébergement)

1. Sur [netlify.com](https://netlify.com) : **Add new site → Import an existing project → GitHub**,
   choisissez `e-invitly`. Netlify détecte Next.js tout seul (fichier `netlify.toml` fourni).
2. Avant de déployer, **Site configuration → Environment variables**, ajoutez :

   | Variable | Valeur |
   | --- | --- |
   | `NEXT_PUBLIC_SUPABASE_URL` | URL du projet Supabase |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | clé publique Supabase |
   | `SUPABASE_SERVICE_ROLE_KEY` | clé secrète Supabase (cochez *Contains secret values*) |
   | `NEXT_PUBLIC_SITE_URL` | `https://VOTRE-SITE.netlify.app` (puis `https://e-invitly.com`) |
   | `IP_HASH_SALT` | une longue suite de caractères au hasard |
   | `RESEND_API_KEY` | clé API Resend (étape D) |
   | `EMAIL_FROM` | `E-Invitly <bonjour@e-invitly.com>` |
   | `ADMIN_NOTIFICATION_EMAIL` | l'adresse qui reçoit les nouvelles demandes |

3. **Deploy**. Votre préproduction est en ligne sur `https://VOTRE-SITE.netlify.app`.
   Testez : catalogue, démo, envoi d'une demande, connexion sur `/connexion` avec votre e-mail.
4. Chaque modification envoyée sur GitHub redéploie automatiquement. Les invitations, elles, ne
   demandent jamais de redéploiement.

> Après tout changement d'une variable commençant par `NEXT_PUBLIC_`, relancez un déploiement
> (*Deploys → Trigger deploy*).

### Étape D — Resend (les e-mails)

1. Dans Resend : **Domains → Add domain** → `e-invitly.com`. Resend affiche des enregistrements DNS
   (SPF, DKIM, éventuellement MX et DMARC).
2. Dans Wix : **Domaines → e-invitly.com → Gérer les enregistrements DNS**, ajoutez chacun d'eux
   exactement comme indiqué. Revenez dans Resend et cliquez sur **Verify** (quelques minutes à
   quelques heures).
3. **API Keys → Create API key** (droit *Sending access*), copiez-la dans `RESEND_API_KEY` sur Netlify.
4. **Recommandé** — faire partir aussi les liens de connexion par Resend : dans Supabase,
   *Authentication → Emails → SMTP Settings* : hôte `smtp.resend.com`, port `465`, utilisateur
   `resend`, mot de passe = votre clé API, expéditeur `bonjour@e-invitly.com`. Sans cela, Supabase
   n'envoie qu'un très petit nombre d'e-mails par heure.

Sans clé Resend, le site fonctionne : les demandes sont enregistrées, seuls les e-mails ne partent pas
(l'administration l'indique dans *Paramètres → Notifications*).

### Étape E — Brancher e-invitly.com (Wix → Netlify)

1. Netlify : **Domain management → Add a domain** → `e-invitly.com`. Netlify ajoute aussi
   `www.e-invitly.com` et affiche les valeurs exactes à utiliser.
2. Wix : **Gérer les enregistrements DNS** du domaine :
   - enregistrement **A**, hôte `@` (ou vide) → `75.2.60.5` (supprimez l'ancien enregistrement A de Wix) ;
   - enregistrement **CNAME**, hôte `www` → `VOTRE-SITE.netlify.app`.
3. Patientez (jusqu'à 24 h). Netlify active ensuite **HTTPS automatiquement** (certificat gratuit).
4. Mettez à jour `NEXT_PUBLIC_SITE_URL` = `https://e-invitly.com` sur Netlify (puis redéployez) et la
   *Site URL* dans Supabase.

Le domaine reste enregistré chez Wix : seules ces deux lignes DNS pointent vers Netlify. Votre site Wix
n'est plus utilisé.

### Après la mise en ligne

- **Sauvegardes** : vérifiez celles incluses dans votre formule Supabase (*Database → Backups*).
  Pour une activité commerciale, la formule payante (sauvegardes quotidiennes) est conseillée.
- **Journaux d'erreurs** : Netlify → *Logs → Functions* ; Supabase → *Logs*.
- **Contrôles** : envoyer une demande test, la retrouver dans `/admin/demandes`, la transformer en
  invitation, modifier un horaire et vérifier l'enregistrement automatique.
- **Juridique** : complétez mentions légales, politique de confidentialité et CGV dans
  *Administration → Paramètres*, et faites-les relire par un professionnel. L'application aide à
  respecter le RGPD (données séparées par invitation, IP non conservées, durée de conservation
  paramétrable) mais ne remplace pas cette vérification.

---

## 3. Utilisation au quotidien

1. Une demande arrive → **Administration → Demandes**.
2. Ouvrez-la, notez, changez son statut, écrivez au client.
3. **Transformer en invitation** : toutes les réponses sont reprises, l'adresse (`mark-alice`) est
   proposée, les points à vérifier sont listés dans *Notes internes*.
4. Onglet **Informations et design** : ajustez textes, horaires, sections, couleurs, polices,
   enveloppe et musique, avec l'aperçu téléphone à côté. L'enregistrement est automatique.
5. Onglet **RSVP** : réglez le formulaire (champs, date limite, accompagnants, questions), suivez
   les réponses, corrigez-les si besoin et exportez la liste (Excel ou CSV).
6. Onglet **Publication** : *Créer un lien d'aperçu* pour la validation du couple, puis **Publier**,
   **Copier le lien** et envoyez-le. Après une modification, **Publier les modifications** : le lien
   ne change pas. **Dépublier** retire l'invitation du site sans rien effacer.
7. **Modèles** : chaque modification enregistre une nouvelle version ; les invitations existantes
   gardent la leur.

---

## 4. Pour un·e développeur·se

```bash
npm install
npm run test        # tests unitaires (Vitest)
npm run test:db     # migrations + règles RLS sur PostgreSQL embarqué
npm run build       # compilation de production
```

**Tester sans compte Supabase** — un banc d'essai local imite l'API Supabase (REST + Auth) sur
PostgreSQL embarqué, avec les vraies migrations et règles RLS :

```bash
node scripts/local-stack/server.mjs          # affiche les clés à mettre dans .env.local
# .env.local : NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 + clés affichées
npm run dev
# liens de connexion : scripts/local-stack/mailbox.log
PLAYWRIGHT_BROWSERS_PATH=… python3 scripts/e2e/run.py   # parcours de bout en bout
```

Si vous modifiez `src/lib/invitation/presets.ts`, régénérez le seed : `node scripts/generate-seed.ts`.

### Organisation du code

```
src/app/(site)/          site public : accueil, catalogue, demande, connexion, pages légales
src/app/demo/[modele]    démonstration plein écran d'un modèle
src/app/admin/           administration (chaque page et action vérifie le rôle côté serveur)
src/app/mon-espace/      espace des couples
src/components/invitation/  moteur de rendu des invitations (enveloppe, sections, thèmes)
src/lib/invitation/      contrat de données des invitations, modèles de départ, conversion
src/lib/slug.ts          génération et validation des adresses
supabase/migrations/     schéma, fonctions et règles de sécurité (RLS)
proxy.ts                 rafraîchit la session, protège /admin et /mon-espace
```

### Choix techniques

- **Contenu versionné en JSON** : brouillon (`invitations.draft_content`) et versions publiées
  (`invitation_versions`) sont indépendants ; les événements y vivent avec un identifiant stable.
- **Lecture publique par fonction SQL** `get_published_invitation(slug)` : ne renvoie jamais le
  brouillon ni les coordonnées du client.
- **Écritures publiques côté serveur uniquement** (demandes, RSVP), après validation Zod, champ piège
  et limitation de débit.
- **Clé secrète Supabase** importée uniquement via `server-only`.
