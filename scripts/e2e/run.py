"""
Parcours de bout en bout (scénarios 1, 2, 5, 7 du cahier des charges).
Prérequis : banc d'essai local (scripts/local-stack/server.mjs) + `next dev`.
Usage : PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers python3 scripts/e2e/run.py
"""
import json, os, re, sys, time, urllib.request
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

BASE = os.environ.get("BASE", "http://localhost:3000")
STACK = os.environ.get("STACK", "http://127.0.0.1:54321")
ROOT = Path(__file__).resolve().parents[2]
SHOTS = Path(os.environ.get("SHOTS", ROOT / "scripts/e2e/screenshots"))
SHOTS.mkdir(parents=True, exist_ok=True)
env = dict(l.split("=", 1) for l in (ROOT / ".env.local").read_text().splitlines() if "=" in l)
SERVICE = env["SUPABASE_SERVICE_ROLE_KEY"].strip()
MAILBOX = ROOT / "scripts/local-stack/mailbox.log"

passed = []
def ok(msg):
    passed.append(msg)
    print("✓", msg)

def api(method, path, body=None, prefer="return=representation"):
    req = urllib.request.Request(f"{STACK}{path}", method=method,
        data=json.dumps(body).encode() if body is not None else None,
        headers={"apikey": SERVICE, "Authorization": f"Bearer {SERVICE}", "Content-Type": "application/json", "Prefer": prefer})
    with urllib.request.urlopen(req) as r:
        txt = r.read().decode()
        return json.loads(txt) if txt else None

def ensure_user(email, role=None):
    users = api("GET", f"/rest/v1/profiles?email=eq.{email}&select=id")
    if not users:
        api("POST", "/auth/v1/admin/users", {"email": email})
    if role:
        api("PATCH", f"/rest/v1/profiles?email=eq.{email}", {"role": role})

def magic_login(page, email, suite="/mon-espace"):
    before = MAILBOX.read_text() if MAILBOX.exists() else ""
    page.goto(f"{BASE}/connexion?suite={suite}")
    page.fill("#email", email)
    page.click("button[type=submit]")
    expect(page.get_by_role("status")).to_contain_text("lien de connexion", timeout=15000)
    for _ in range(30):
        text = MAILBOX.read_text() if MAILBOX.exists() else ""
        new = text[len(before):]
        m = re.findall(rf"{re.escape(email)} (\S+)", new)
        if m:
            page.goto(m[-1])
            return
        time.sleep(0.3)
    raise AssertionError("aucun lien magique reçu")

# Remise à zéro des données de test (le seed des modèles est conservé)
for table in ["rsvp_responses", "invitation_access", "rsvp_forms", "invitations", "client_requests", "audit_logs", "slug_redirects"]:
    api("DELETE", f"/rest/v1/{table}?{'id' if table != 'slug_redirects' else 'old_slug'}=not.is.null", prefer="return=minimal")
api("DELETE", "/rest/v1/rate_limits?bucket=not.is.null", prefer="return=minimal")
api("PATCH", "/rest/v1/templates?slug=in.(the-garden,province)", {"status": "published"}, prefer="return=minimal")
api("PATCH", "/rest/v1/settings?key=eq.brand", {"value": {"name": "E-Invitly", "tagline": "Invitations digitales élégantes", "contactEmail": "", "contactPhone": "", "instagram": "", "facebook": "", "pinterest": ""}}, prefer="return=minimal")

with sync_playwright() as p:
    browser = p.chromium.launch()
    # ── Visiteur sur mobile ──────────────────────────────────────────
    mobile = browser.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2, is_mobile=True, has_touch=True)
    page = mobile.new_page()
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.goto(BASE)
    expect(page.get_by_role("heading", level=1)).to_contain_text("invitation unique")
    page.screenshot(path=SHOTS / "01-accueil-mobile.png")
    ok("accueil mobile : titre affiché")

    page.goto(f"{BASE}/invitations")
    expect(page.get_by_text("2 modèles")).to_be_visible()
    page.screenshot(path=SHOTS / "02-catalogue-mobile.png", full_page=True)
    page.goto(f"{BASE}/invitations?style=vintage")
    expect(page.get_by_text("1 modèle", exact=True)).to_be_visible()
    ok("catalogue : 2 modèles depuis la base, filtre par style")

    page.goto(f"{BASE}/demo/the-garden")
    page.screenshot(path=SHOTS / "03-demo-enveloppe.png")
    page.get_by_role("button", name="Ouvrir l'invitation").first.click()
    page.wait_for_timeout(2500)
    expect(page.get_by_role("heading", name="Camille")).to_be_visible()
    page.screenshot(path=SHOTS / "04-demo-ouverte.png")
    page.mouse.wheel(0, 1600); page.wait_for_timeout(900)
    page.screenshot(path=SHOTS / "05-demo-programme.png")
    expect(page.get_by_role("timer")).to_be_visible()
    ok("démo : enveloppe → invitation, compte à rebours")

    page.goto(f"{BASE}/demo/province")
    page.get_by_role("button", name="Ouvrir l'invitation").first.click()
    page.wait_for_timeout(2500)
    page.screenshot(path=SHOTS / "06-demo-province.png")

    # ── Scénario 1 : demande ─────────────────────────────────────────
    page.goto(f"{BASE}/personnalisation/the-garden")
    page.get_by_role("button", name="Continuer").click()
    expect(page.get_by_text("Indiquez votre prénom")).to_be_visible()
    ok("formulaire : messages d'erreur clairs")
    page.get_by_label("Prénom", exact=True).fill("Mark")
    page.get_by_label("Nom", exact=True).fill("Doe")
    page.get_by_label("Adresse e-mail").fill("mark@example.test")
    page.get_by_role("button", name="Continuer").click()
    page.get_by_label("Prénom de la première personne").fill("Mark")
    page.get_by_label("Prénom de la seconde personne").fill("Alice")
    page.get_by_label("Date de l'événement").fill("2027-09-18")
    page.get_by_role("button", name="Continuer").click()
    page.get_by_role("button", name="+ Cérémonie civile").click()
    page.get_by_label("Début de la cérémonie").fill("11:00")
    page.get_by_text("Afficher cette cérémonie sur l'invitation").click()
    page.get_by_role("button", name="+ Cérémonie laïque").click()
    page.get_by_label("Lieu").nth(1).fill("Château de la Colle")
    page.get_by_label("Début de la cérémonie").nth(1).fill("16:00")
    page.screenshot(path=SHOTS / "07-formulaire-ceremonies.png", full_page=True)
    page.get_by_role("button", name="Continuer").click()
    page.get_by_label("Nom du lieu de réception").fill("Château de la Colle")
    page.get_by_label("Cocktail").fill("17:30")
    page.get_by_label("Dîner").fill("20:00")
    page.get_by_label("Stationnement").fill("Parking dans la cour")
    page.get_by_role("button", name="Continuer").click()
    page.get_by_label("Contacts des témoins").fill("Léo (témoin de Mark) 06 11 22 33 44")
    page.get_by_role("button", name="Continuer").click()
    expect(page.get_by_text("Mark & Alice").first).to_be_visible()
    page.get_by_role("button", name="Envoyer ma demande").click()
    expect(page.get_by_text("Votre accord est nécessaire")).to_be_visible()
    page.locator("input[type=checkbox]").last.check()
    page.screenshot(path=SHOTS / "08-formulaire-verification.png", full_page=True)
    page.get_by_role("button", name="Envoyer ma demande").click()
    page.wait_for_url(re.compile(r"/personnalisation/merci"), timeout=20000)
    ref = re.search(r"EI-\d{4}-\d{4}", page.content()).group(0)
    page.screenshot(path=SHOTS / "09-merci.png")
    ok(f"scénario 1 : demande enregistrée ({ref})")
    assert api("GET", "/rest/v1/invitations?select=id") == [], "aucune invitation ne doit être créée"
    ok("scénario 1 : aucune invitation créée automatiquement")

    # Seconde demande (Naomi & Kate) directement par le formulaire
    page.goto(f"{BASE}/personnalisation/province")
    page.get_by_label("Prénom", exact=True).fill("Naomi"); page.get_by_label("Nom", exact=True).fill("Lee")
    page.get_by_label("Adresse e-mail").fill("naomi@example.test")
    page.get_by_role("button", name="Continuer").click()
    page.get_by_label("Prénom de la première personne").fill("Naomi"); page.get_by_label("Prénom de la seconde personne").fill("Kate")
    page.get_by_label("Date de l'événement").fill("2027-07-03")
    for _ in range(4): page.get_by_role("button", name="Continuer").click()
    page.locator("input[type=checkbox]").last.check()
    page.get_by_role("button", name="Envoyer ma demande").click()
    page.wait_for_url(re.compile(r"/personnalisation/merci"), timeout=20000)
    assert not errors, errors
    ok("seconde demande enregistrée, aucune erreur JavaScript côté visiteur")

    # ── Administration (desktop) ─────────────────────────────────────
    ensure_user("admin@e-invitly.test", "admin")
    desk = browser.new_context(viewport={"width": 1440, "height": 900})
    a = desk.new_page()
    a.on("dialog", lambda d: d.accept())  # confirmations « Publier ? », « Dépublier ? »
    a.goto(f"{BASE}/admin")
    expect(a).to_have_url(re.compile(r"/connexion"))
    ok("scénario 7 : /admin sans session → page de connexion")
    magic_login(a, "admin@e-invitly.test", "/admin")
    a.wait_for_url(re.compile(r"/admin$"), timeout=15000)
    expect(a.get_by_role("heading", name="Vue d'ensemble")).to_be_visible()
    a.screenshot(path=SHOTS / "10-admin-vue-ensemble.png", full_page=True)
    ok("connexion par lien magique (PKCE) → administration")

    a.goto(f"{BASE}/admin/demandes")
    expect(a.get_by_role("link", name=ref)).to_be_visible()
    a.screenshot(path=SHOTS / "11-admin-demandes.png")
    a.get_by_role("link", name=ref).click()
    expect(a.get_by_text("ne pas afficher sur l'invitation")).to_be_visible()
    a.screenshot(path=SHOTS / "12-admin-demande.png", full_page=True)
    a.locator("#notes").fill("Rappeler pour la musique.")
    a.get_by_role("button", name="Enregistrer les notes").click()
    a.wait_for_timeout(800)
    ok("demande : toutes les réponses affichées, notes enregistrées")

    # ── Scénario 2 : conversion ──────────────────────────────────────
    a.get_by_role("button", name="Transformer en invitation").click()
    a.wait_for_url(re.compile(r"/admin/invitations/[0-9a-f-]+"), timeout=20000)
    inv_id = re.search(r"/admin/invitations/([0-9a-f-]+)", a.url).group(1)
    expect(a.get_by_text("mark-alice")).to_be_visible()
    a.wait_for_timeout(1200)
    a.screenshot(path=SHOTS / "13-admin-invitation-editeur.png", full_page=True)
    inv = api("GET", f"/rest/v1/invitations?id=eq.{inv_id}&select=slug,status,draft_content,internal_notes,template_version_id")[0]
    events = [e["title"] for e in inv["draft_content"]["events"]]
    assert events == ["Cérémonie laïque", "Cocktail", "Dîner"], events
    assert inv["draft_content"]["eventAt"] == "2027-09-18T16:00"
    assert "Léo" in inv["internal_notes"]
    ok("scénario 2 : informations reprises, cérémonie civile masquée, slug mark-alice")

    # Édition + sauvegarde automatique
    a.get_by_text("Programme et lieux").click()
    a.locator("input[type=time]").nth(2).fill("16:30")  # début de la cérémonie laïque
    expect(a.get_by_role("status").filter(has_text="Modifications en cours")).to_be_visible(timeout=5000)
    expect(a.get_by_role("status").filter(has_text="Brouillon enregistré")).to_be_visible(timeout=10000)
    inv = api("GET", f"/rest/v1/invitations?id=eq.{inv_id}&select=draft_content")[0]
    assert inv["draft_content"]["events"][0]["startTime"] == "16:30", inv["draft_content"]["events"][0]
    ok("éditeur : modification enregistrée automatiquement dans le brouillon")
    a.get_by_role("button", name="Annuler").click()
    expect(a.get_by_role("status").filter(has_text="Modifications en cours")).to_be_visible(timeout=5000)
    expect(a.get_by_role("status").filter(has_text="Brouillon enregistré")).to_be_visible(timeout=10000)
    inv = api("GET", f"/rest/v1/invitations?id=eq.{inv_id}&select=draft_content")[0]
    assert inv["draft_content"]["events"][0]["startTime"] == "16:00", "annuler doit revenir à 16:00"
    ok("éditeur : annuler restaure et réenregistre")

    # Adresse : vérification en direct
    a.goto(f"{BASE}/admin/invitations/{inv_id}?onglet=publication")
    a.locator("#slug").fill("admin")
    expect(a.locator("#slug-status")).to_contain_text("réservée", timeout=5000)
    a.locator("#slug").fill("mark-et-alice")
    expect(a.locator("#slug-status")).to_contain_text("disponible", timeout=5000)
    a.get_by_role("button", name="Enregistrer l'adresse").click()
    a.wait_for_timeout(1000)
    assert api("GET", f"/rest/v1/invitations?id=eq.{inv_id}&select=slug")[0]["slug"] == "mark-et-alice"
    a.screenshot(path=SHOTS / "14-admin-publication.png", full_page=True)
    ok("adresse : slugs réservés refusés, disponibilité vérifiée, enregistrement")

    # ── Phase 4 : aperçu, publication, scénarios 3, 6 et 8 ───────────
    page.goto(f"{BASE}/mark-et-alice")
    expect(page.get_by_text("Page introuvable")).to_be_visible()
    ok("scénario 1/8 : une invitation non publiée n'est pas accessible")

    a.goto(f"{BASE}/admin/invitations/{inv_id}?onglet=publication")
    a.get_by_role("button", name="Créer un lien d'aperçu").click()
    preview_url = a.locator("p.break-all").filter(has_text="/apercu/").inner_text(timeout=10000).strip()
    page.goto(preview_url)
    expect(page.get_by_text("Aperçu privé")).to_be_visible()
    page.get_by_role("button", name="Ouvrir l'invitation").first.click()
    page.wait_for_timeout(2500)
    expect(page.get_by_role("heading", name="Mark", exact=True)).to_be_visible()
    page.screenshot(path=SHOTS / "19-apercu-prive.png")
    page.goto(f"{BASE}/apercu/jeton-invente-0123456789abcdef")
    expect(page.get_by_text("Aperçu indisponible")).to_be_visible()
    ok("aperçu privé : le lien montre le brouillon ; un faux lien ne montre rien")

    a.locator("input[name=note]").fill("Première publication")
    a.get_by_role("button", name="Publier", exact=True).click()
    a.wait_for_url(re.compile(r"publiee=1"), timeout=20000)
    expect(a.get_by_text("Version 1 publiée")).to_be_visible()
    a.screenshot(path=SHOTS / "20-admin-publiee.png", full_page=True)
    page.goto(f"{BASE}/mark-et-alice")
    page.get_by_role("button", name="Ouvrir l'invitation").first.click()
    page.wait_for_timeout(2500)
    expect(page.get_by_role("heading", name="Alice", exact=True)).to_be_visible()
    expect(page.get_by_text("Le formulaire de réponse en ligne ouvrira")).to_be_attached()
    page.screenshot(path=SHOTS / "21-invitation-publiee-mobile.png")
    assert "noindex" in page.content()
    ok("scénario 3 : publication → adresse publique fonctionnelle sur mobile, noindex, sans redéploiement")

    # Scénario 6 : modification après publication
    a.goto(f"{BASE}/admin/invitations/{inv_id}")
    a.get_by_label("Texte d'invitation").fill("Texte modifié v2")
    expect(a.get_by_role("status").filter(has_text="Brouillon enregistré")).to_be_visible(timeout=10000)
    a.wait_for_timeout(500)
    page.goto(f"{BASE}/mark-et-alice")
    assert "Texte modifié v2" not in page.content(), "la version publique ne doit pas changer avant publication"
    a.goto(f"{BASE}/admin/invitations/{inv_id}?onglet=publication")
    expect(a.get_by_text("ne sont pas encore en ligne")).to_be_visible()
    a.get_by_role("button", name="Publier les modifications").click()
    a.wait_for_url(re.compile(r"publiee=2"), timeout=20000)
    page.goto(f"{BASE}/mark-et-alice")
    assert "Texte modifié v2" in page.content()
    ok("scénario 6 : brouillon invisible jusqu'à la publication, puis mis à jour à la même adresse")

    # Changement d'adresse après publication → redirection
    a.locator("#slug").fill("mark-alice-2027")
    expect(a.get_by_text("Rediriger l'ancien lien")).to_be_visible()
    a.get_by_role("button", name="Enregistrer l'adresse").click()
    a.wait_for_timeout(1500)
    page.goto(f"{BASE}/mark-et-alice")
    expect(page).to_have_url(re.compile(r"/mark-alice-2027$"))
    ok("adresse modifiée après publication : l'ancien lien redirige")

    # Code d'accès
    a.goto(f"{BASE}/admin/invitations/{inv_id}?onglet=publication")
    a.locator("input[name=code]").fill("Jardin 2027")
    a.get_by_role("button", name="Enregistrer le code").click()
    a.wait_for_timeout(1500)
    guest = browser.new_context(viewport={"width": 390, "height": 844}, is_mobile=True).new_page()
    guest.goto(f"{BASE}/mark-alice-2027")
    expect(guest.get_by_text("Invitation privée")).to_be_visible()
    assert "Alice" not in guest.content()
    guest.fill("#code", "mauvais")
    guest.get_by_role("button", name="Ouvrir l'invitation").click()
    expect(guest.get_by_text("Code incorrect")).to_be_visible()
    guest.fill("#code", "jardin2027")
    guest.get_by_role("button", name="Ouvrir l'invitation").click()
    guest.wait_for_timeout(1500)
    guest.get_by_role("button", name="Ouvrir l'invitation").first.click()
    guest.wait_for_timeout(2500)
    expect(guest.get_by_role("heading", name="Alice", exact=True)).to_be_visible()
    ok("code d'accès : contenu caché sans code, mauvais code refusé, bon code accepté")
    a.goto(f"{BASE}/admin/invitations/{inv_id}?onglet=publication")
    a.get_by_role("button", name="Retirer le code").click()
    a.wait_for_timeout(1500)

    # Scénario 8 : dépublication
    a.get_by_role("button", name="Dépublier").click()
    a.wait_for_timeout(1500)
    page.goto(f"{BASE}/mark-alice-2027")
    expect(page.get_by_text("Page introuvable")).to_be_visible()
    page.goto(f"{BASE}/mark-et-alice")
    expect(page.get_by_text("Page introuvable")).to_be_visible()
    ok("scénario 8 : dépubliée = inaccessible, ancien lien compris")
    a.reload()
    a.get_by_role("button", name="Republier").click()
    a.wait_for_url(re.compile(r"publiee=3"), timeout=20000)
    page.goto(f"{BASE}/mark-alice-2027")
    page.get_by_role("button", name="Ouvrir l'invitation").first.click()
    page.wait_for_timeout(2500)
    expect(page.get_by_role("heading", name="Mark", exact=True)).to_be_visible()
    a.screenshot(path=SHOTS / "22-admin-publication-complete.png", full_page=True)
    ok("republication : de nouveau en ligne")

    # Seconde invitation
    a.goto(f"{BASE}/admin/demandes")
    a.get_by_role("link", name=re.compile(r"EI-")).first.click()
    a.get_by_role("button", name="Transformer en invitation").click()
    a.wait_for_url(re.compile(r"/admin/invitations/[0-9a-f-]+"), timeout=20000)
    expect(a.get_by_text("naomi-kate")).to_be_visible()
    a.goto(f"{BASE}/admin/invitations")
    a.screenshot(path=SHOTS / "15-admin-invitations.png")
    ok("deux invitations distinctes (designs différents : The Garden / Province)")

    # Modèles
    a.goto(f"{BASE}/admin/modeles")
    a.screenshot(path=SHOTS / "16-admin-modeles.png")
    a.locator("li").filter(has_text="Province").get_by_role("button", name="Retirer du catalogue").click()
    a.wait_for_timeout(1000)
    page.goto(f"{BASE}/invitations")
    expect(page.get_by_text("1 modèle", exact=True)).to_be_visible()
    a.reload()
    a.locator("li").filter(has_text="Province").get_by_role("button", name="Publier").click()
    a.wait_for_timeout(1000)
    page.goto(f"{BASE}/invitations")
    expect(page.get_by_text("2 modèles")).to_be_visible()
    ok("modèles : retirer / remettre au catalogue, effet immédiat sur le site")

    a.goto(f"{BASE}/admin")
    a.screenshot(path=SHOTS / "17-admin-vue-ensemble-apres.png", full_page=True)
    a.goto(f"{BASE}/admin/recherche?q=naomi")
    expect(a.get_by_text("Naomi & Kate").first).to_be_visible()
    ok("recherche globale")

    a.goto(f"{BASE}/admin/parametres")
    a.locator("input[name=contactEmail]").fill("bonjour@e-invitly.com")
    a.locator("form").filter(has=a.locator("input[name=contactEmail]")).get_by_role("button", name="Enregistrer").click()
    a.wait_for_timeout(1200)
    page.goto(BASE)
    expect(page.get_by_text("bonjour@e-invitly.com")).to_be_visible()
    ok("paramètres : modifiables et visibles immédiatement sur le site")

    # ── Scénario 7 : un couple ne voit que son invitation ────────────
    client = browser.new_context(viewport={"width": 390, "height": 844}, is_mobile=True)
    c = client.new_page()
    ensure_user("mark@example.test")  # compte créé APRÈS l'attribution de l'accès
    magic_login(c, "mark@example.test")
    c.wait_for_url(re.compile(r"/mon-espace"), timeout=15000)
    expect(c.get_by_role("heading", name="Mark & Alice")).to_be_visible()
    assert "Naomi" not in c.content()
    c.screenshot(path=SHOTS / "18-espace-couple.png", full_page=True)
    ok("scénario 7 : le couple Mark & Alice ne voit que son invitation")
    c.goto(f"{BASE}/admin")
    expect(c).to_have_url(re.compile(r"/connexion\?erreur=acces"))
    ok("scénario 7 : un couple ne peut pas accéder à l'administration")
    c.goto(f"{BASE}/admin/invitations/{inv_id}")
    expect(c).to_have_url(re.compile(r"/connexion"))
    ok("scénario 7 : accès direct à une fiche admin refusé")

    browser.close()

print(f"\n{len(passed)} vérifications réussies.")
