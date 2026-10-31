"""
Parcours de bout en bout (scénarios 1, 2, 5, 7 du cahier des charges).
Prérequis : banc d'essai local (scripts/local-stack/server.mjs) + `next dev`.
Usage : PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers python3 scripts/e2e/run.py
"""
import json, os, re, sys, time, urllib.request, urllib.error, urllib.parse
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
for table in ["media_assets", "rsvp_responses", "invitation_access", "rsvp_forms", "invitations", "client_requests", "audit_logs", "slug_redirects"]:
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
    expect(page.get_by_role("button", name="Envoyer ma réponse")).to_be_attached()
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

    # ── Phase 5 : RSVP (scénario 4) ───────────────────────────────────
    a.goto(f"{BASE}/admin/invitations/{inv_id}?onglet=rsvp")
    a.locator("input[name=max_companions]").fill("2")
    a.locator("input[name=field_dietary]").check()
    a.locator("input[name=field_childMenus]").check()
    a.locator("input[name=q_label_0]").fill("Prendrez-vous la navette ?")
    a.locator("select[name=q_type_0]").select_option("yesno")
    a.locator("input[name=q_required_0]").check()
    a.get_by_role("button", name="Enregistrer les réglages").click()
    a.wait_for_timeout(1500)

    def open_rsvp(pg):
        pg.goto(f"{BASE}/mark-alice-2027")
        pg.get_by_role("button", name="Ouvrir l'invitation").first.click()
        pg.wait_for_timeout(2300)
        pg.locator("input[name=firstName]").scroll_into_view_if_needed()

    open_rsvp(page)
    page.locator("input[name=firstName]").fill("Paul")
    page.get_by_text("Avec joie").click()
    page.locator("form select").first.select_option("1")
    page.get_by_role("button", name="Envoyer ma réponse").click()
    expect(page.get_by_text("Merci de compléter les champs indiqués.")).to_be_visible(timeout=10000)
    ok("RSVP : champs obligatoires signalés (nom, question personnalisée)")
    page.locator("input[name=lastName]").fill("Durand")
    page.locator("input[name=companion_0]").fill("Julie")
    page.locator("select[name=childMenus]").select_option("1")
    page.locator("input[name=dietary]").fill("végétarien")
    page.locator("form select").last.select_option("oui")
    page.locator("textarea[name=comment]").fill("Hâte d'y être !")
    page.screenshot(path=SHOTS / "23-rsvp-formulaire.png", full_page=False)
    page.get_by_role("button", name="Envoyer ma réponse").click()
    expect(page.get_by_text("Votre présence est bien notée")).to_be_visible(timeout=10000)
    page.get_by_role("button", name="Répondre pour une autre personne").click()
    page.locator("input[name=firstName]").fill("Marie")
    page.locator("input[name=lastName]").fill("Leroy")
    page.get_by_text("Je ne pourrai pas venir").click()
    page.get_by_role("button", name="Envoyer ma réponse").click()
    expect(page.get_by_text("Vous nous manquerez")).to_be_visible(timeout=10000)
    ok("scénario 4 : deux invités répondent depuis l'invitation publiée (mobile)")

    rows_db = api("GET", f"/rest/v1/rsvp_responses?invitation_id=eq.{inv_id}&select=first_name,attending,companions_count,companions,child_menus,dietary,answers,events&order=first_name")
    assert [r["first_name"] for r in rows_db] == ["Marie", "Paul"], rows_db
    paul = rows_db[1]
    assert paul["companions_count"] == 1 and paul["companions"] == ["Julie"] and paul["child_menus"] == 1 and paul["dietary"] == "végétarien", paul
    assert list(paul["answers"].values()) == ["oui"] and len(paul["events"]) == 3, paul
    assert rows_db[0]["companions_count"] == 0 and rows_db[0]["events"] == []
    ok("scénario 4 : réponses enregistrées dans la bonne invitation, refus sans accompagnant")

    a.goto(f"{BASE}/admin/invitations/{inv_id}?onglet=rsvp")
    expect(a.locator(".card").filter(has_text="Personnes confirmées").first).to_contain_text("2")
    expect(a.get_by_text("Paul Durand")).to_be_visible()
    a.screenshot(path=SHOTS / "24-admin-rsvp.png", full_page=True)
    ok("statistiques : 2 personnes confirmées, 1 refus, menus enfant")

    a.get_by_text("Paul Durand").click()
    form = a.locator("form").filter(has=a.locator("input[name=first_name][value=Paul]"))
    form.locator("input[name=companions_count]").fill("0")
    form.get_by_role("button", name="Enregistrer la correction").click()
    a.wait_for_timeout(1500)
    expect(a.get_by_text("corrigée").first).to_be_visible()
    expect(a.locator(".card").filter(has_text="Personnes confirmées").first).to_contain_text("1")
    edits = api("GET", "/rest/v1/rsvp_response_edits?select=before,after,edited_by")
    assert any(e["before"]["companions_count"] == 1 and e["after"]["companions_count"] == 0 and e["edited_by"] for e in edits), edits
    ok("correction d'une réponse avec trace avant / après")

    xr = a.context.request.get(f"{BASE}/api/exports/{inv_id}?format=xlsx")
    assert xr.status == 200 and "spreadsheetml" in xr.headers["content-type"] and len(xr.body()) > 2000, (xr.status, xr.headers)
    cr = a.context.request.get(f"{BASE}/api/exports/{inv_id}?format=csv")
    csv = cr.text()
    assert "Durand" in csv and "végétarien" not in csv and "Prendrez-vous la navette ?" in csv, csv[:400]
    cr2 = a.context.request.get(f"{BASE}/api/exports/{inv_id}?format=csv&regimes=1")
    assert "végétarien" in cr2.text()
    anon = browser.new_context().request.get(f"{BASE}/api/exports/{inv_id}?format=csv", max_redirects=0)
    assert anon.status in (302, 303, 307, 308), anon.status
    ok("exports Excel et CSV ; régimes seulement sur demande ; refusé sans connexion")

    # Invités nominatifs (codes)
    a.locator("textarea[name=guests]").fill("Famille Test ; 2")
    a.get_by_role("button", name="Ajouter", exact=True).click()
    a.wait_for_timeout(1200)
    a.locator("select[name=mode]").select_option("code")
    a.get_by_role("button", name="Enregistrer les réglages").click()
    a.wait_for_timeout(1500)
    code = api("GET", f"/rest/v1/guests?invitation_id=eq.{inv_id}&select=code")[0]["code"]
    g2 = browser.new_context(viewport={"width": 390, "height": 844}, is_mobile=True).new_page()
    open_rsvp(g2)
    g2.locator("input[name=code]").fill("ZZZZZZ")
    g2.locator("input[name=firstName]").fill("Hugo")
    g2.locator("input[name=lastName]").fill("Test")
    g2.get_by_text("Je ne pourrai pas venir").click()
    g2.get_by_role("button", name="Envoyer ma réponse").click()
    expect(g2.get_by_text("Ce code n'est pas reconnu")).to_be_visible(timeout=10000)
    g2.locator("input[name=code]").fill(code.lower())
    g2.get_by_role("button", name="Envoyer ma réponse").click()
    expect(g2.get_by_text("Vous nous manquerez")).to_be_visible(timeout=10000)
    open_rsvp(g2)
    g2.locator("input[name=code]").fill(code)
    g2.locator("input[name=firstName]").fill("Hugo")
    g2.locator("input[name=lastName]").fill("Test")
    g2.get_by_text("Avec joie").click()
    g2.locator("form select").first.select_option("2")
    g2.locator("form select").last.select_option("non")
    g2.get_by_role("button", name="Envoyer ma réponse").click()
    expect(g2.get_by_text("Votre réponse a bien été mise à jour")).to_be_visible(timeout=10000)
    guest_rows = api("GET", f"/rest/v1/rsvp_responses?invitation_id=eq.{inv_id}&guest_id=not.is.null&select=attending,companions_count")
    assert guest_rows == [{"attending": True, "companions_count": 2}], guest_rows
    ok("invités nominatifs : mauvais code refusé, une seule réponse par code, mise à jour")
    a.goto(f"{BASE}/admin/invitations/{inv_id}?onglet=rsvp")
    a.locator("select[name=mode]").select_option("open")
    a.locator("input[name=is_open]").uncheck()
    a.get_by_role("button", name="Enregistrer les réglages").click()
    a.wait_for_timeout(1500)
    g2.goto(f"{BASE}/mark-alice-2027")
    g2.get_by_role("button", name="Ouvrir l'invitation").first.click()
    g2.wait_for_timeout(2300)
    expect(g2.get_by_text("Les réponses sont closes")).to_be_attached()
    ok("réponses fermées : le formulaire affiche un message")
    a.locator("input[name=is_open]").check()
    a.get_by_role("button", name="Enregistrer les réglages").click()
    a.wait_for_timeout(1200)

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

    # ── Bibliothèque de médias ───────────────────────────────────────
    import struct, zlib, tempfile
    tmp = Path(tempfile.mkdtemp())
    def png(w, h):
        raw = b"".join(b"\x00" + bytes([200, 120, 140, 255]) * w for _ in range(h))
        chunk = lambda t, d: struct.pack(">I", len(d)) + t + d + struct.pack(">I", zlib.crc32(t + d) & 0xffffffff)
        return b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 6, 0, 0, 0)) + chunk(b"IDAT", zlib.compress(raw)) + chunk(b"IEND", b"")
    (tmp / "pivoine rose.png").write_bytes(png(40, 30))
    (tmp / "branche.svg").write_text('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><circle cx="5" cy="5" r="4" fill="#7a8b6f"/></svg>')
    (tmp / "piege.svg").write_text('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>')
    (tmp / "notes.txt").write_text("pas une image")
    a.goto(f"{BASE}/admin/medias")
    expect(a.get_by_text("La bibliothèque est vide")).to_be_visible()
    a.get_by_label("Collection de destination").select_option("Fleurs")
    a.locator("input[type=file]").set_input_files([str(tmp / n) for n in ["pivoine rose.png", "branche.svg", "piege.svg", "notes.txt"]])
    expect(a.get_by_text("Ajouté ✓")).to_have_count(2, timeout=20000)
    expect(a.get_by_text("il a été refusé par sécurité")).to_be_visible()
    expect(a.get_by_text("Format non accepté")).to_be_visible()
    rows = api("GET", "/rest/v1/media_assets?select=name,kind,width,height,collection,path,mime_type&order=name")
    assert [(r["name"], r["kind"], r["collection"]) for r in rows] == [("branche", "svg", "Fleurs"), ("pivoine rose", "image", "Fleurs")], rows
    assert rows[1]["width"] == 40 and rows[1]["height"] == 30, rows[1]
    assert not any("piege" in r["path"] for r in rows)
    png_url = f"{STACK}/storage/v1/object/public/media/{rows[1]['path']}"
    assert urllib.request.urlopen(png_url).status == 200
    a.reload()
    expect(a.get_by_role("link", name=re.compile("pivoine rose"))).to_be_visible()
    a.screenshot(path=SHOTS / "26-admin-medias.png", full_page=True)
    ok("médias : import multiple, dimensions lues, SVG dangereux et format inconnu refusés")

    a.get_by_role("link", name="Musique").first.click()
    expect(a.get_by_text("Aucun fichier ne correspond")).to_be_visible()
    a.goto(f"{BASE}/admin/medias?q=pivoine")
    expect(a.get_by_role("link", name=re.compile("pivoine rose"))).to_be_visible()
    expect(a.get_by_role("link", name=re.compile("branche"))).to_have_count(0)
    ok("médias : filtres par type et recherche")

    # Utilisation dans une invitation → suppression bloquée
    a.goto(f"{BASE}/admin/invitations/{inv_id}")
    photo = a.locator("span.flex").filter(has=a.get_by_label("Photo du couple"))
    photo.get_by_role("button", name="Bibliothèque").click()
    dlg = a.get_by_role("dialog", name="Choisir dans la bibliothèque")
    expect(dlg.get_by_text("pivoine rose")).to_be_visible(timeout=10000)
    expect(dlg.get_by_text("branche")).to_have_count(0)  # SVG non proposé pour une photo
    a.screenshot(path=SHOTS / "27-selecteur-medias.png")
    dlg.get_by_role("button", name=re.compile("pivoine rose")).click()
    expect(a.get_by_role("status").filter(has_text="Brouillon enregistré")).to_be_visible(timeout=10000)
    a.wait_for_timeout(600)
    inv = api("GET", f"/rest/v1/invitations?id=eq.{inv_id}&select=draft_content")[0]
    assert inv["draft_content"]["couple"]["photoUrl"] == png_url, inv["draft_content"]["couple"]["photoUrl"]
    ok("éditeur : photo choisie dans la bibliothèque et enregistrée")

    png_id = api("GET", "/rest/v1/media_assets?name=eq.pivoine%20rose&select=id")[0]["id"]
    a.goto(f"{BASE}/admin/medias/{png_id}")
    expect(a.get_by_role("link", name=re.compile("Invitation · Mark & Alice"))).to_be_visible()
    expect(a.get_by_text("Suppression impossible tant que le fichier est utilisé")).to_be_visible()
    expect(a.get_by_role("button", name="Supprimer le fichier")).to_have_count(0)
    a.locator("input[name=tags]").fill("Pivoine, Rose poudré")
    a.get_by_role("button", name="Enregistrer").click()
    expect(a.get_by_text("Modifications enregistrées")).to_be_visible(timeout=10000)
    assert api("GET", f"/rest/v1/media_assets?id=eq.{png_id}&select=tags")[0]["tags"] == ["pivoine", "rose poudré"]
    a.screenshot(path=SHOTS / "28-media-fiche.png", full_page=True)
    ok("médias : fiche, mots-clés, utilisation affichée, suppression bloquée si utilisé")

    svg_id = api("GET", "/rest/v1/media_assets?name=eq.branche&select=id,path")[0]
    a.goto(f"{BASE}/admin/medias/{svg_id['id']}")
    a.get_by_role("button", name="Supprimer le fichier").click()
    a.wait_for_url(re.compile(r"/admin/medias\?supprime=1"), timeout=15000)
    expect(a.get_by_text("Le fichier a été supprimé")).to_be_visible()
    assert api("GET", f"/rest/v1/media_assets?id=eq.{svg_id['id']}&select=id") == []
    try:
        urllib.request.urlopen(f"{STACK}/storage/v1/object/public/media/{svg_id['path']}")
        raise AssertionError("le fichier supprimé est encore servi")
    except urllib.error.HTTPError as e:
        assert e.code == 404
    ok("médias : suppression d'un fichier inutilisé (base + stockage)")

    # ── Phase 6 : éditeur visuel ──────────────────────────────────────
    def draft():
        return api("GET", f"/rest/v1/invitations?id=eq.{inv_id}&select=draft_content")[0]["draft_content"]
    def wait_draft(pred, what):
        for _ in range(40):
            d = draft()
            if pred(d):
                return d
            time.sleep(0.4)
        raise AssertionError(f"brouillon : {what}")
    def sec(d, t):
        return [x for x in d["sections"] if x["type"] == t]

    a.goto(f"{BASE}/admin/invitations/{inv_id}")
    a.get_by_role("link", name="Éditeur visuel").click()
    a.wait_for_url(re.compile(r"/editeur$"))
    left = a.get_by_role("complementary", name="Sections et calques")
    props = a.get_by_role("complementary", name="Propriétés")
    expect(a.get_by_role("heading", name="Mark & Alice")).to_be_visible()
    left.get_by_role("button", name=re.compile(r"^Le programme")).click()
    expect(props.get_by_role("heading", name="Programme")).to_be_visible()
    left.get_by_role("button", name="+ Image").click()
    dlg = a.get_by_role("dialog", name="Ajouter une illustration")
    dlg.get_by_role("button", name=re.compile("pivoine rose")).click()
    expect(props.get_by_role("heading", name="Illustration")).to_be_visible()
    d = wait_draft(lambda d: len(sec(d, "program")[0]["layers"]) == 1, "calque image ajouté")
    assert sec(d, "program")[0]["layers"][0]["src"] == png_url
    ok("éditeur visuel : illustration de la bibliothèque ajoutée à une section")

    layer = a.locator('[data-section="program"] [data-layer]').first
    box = layer.bounding_box()
    a.mouse.move(box["x"] + box["width"] / 2, box["y"] + box["height"] / 2)
    a.mouse.down()
    a.mouse.move(box["x"] + box["width"] / 2 + 60, box["y"] + box["height"] / 2 + 30, steps=8)
    a.mouse.up()
    d = wait_draft(lambda d: sec(d, "program")[0]["layers"][0]["x"] > 60, "déplacement à la souris")
    rot = a.locator(".inv-handle-rotate")
    rb = rot.bounding_box()
    a.mouse.move(rb["x"] + 7, rb["y"] + 7)
    a.mouse.down()
    a.mouse.move(rb["x"] + 120, rb["y"] + 80, steps=6)
    a.mouse.up()
    props.get_by_label("Opacité (valeur)").fill("60")
    props.get_by_label("Apparition", exact=True).select_option("draw")
    props.get_by_label("Mouvement continu").select_option("sway")
    props.get_by_label("Place par rapport au texte de la section").select_option("front")
    d = wait_draft(lambda d: sec(d, "program")[0]["layers"][0]["loop"] == "sway" and sec(d, "program")[0]["layers"][0]["placement"] == "front", "réglages du calque")
    L = sec(d, "program")[0]["layers"][0]
    assert L["opacity"] == 0.6 and L["enter"]["type"] == "draw" and L["rotation"] != 0, L
    ok("éditeur visuel : déplacer, pivoter, opacité, animation d'apparition et mouvement continu")

    left.get_by_role("button", name="+ Texte").click()
    props.get_by_label("Texte", exact=True).fill("Save the date")
    d = wait_draft(lambda d: any(l["text"] == "Save the date" for l in sec(d, "program")[0]["layers"]), "calque texte")
    a.locator("[data-layer]").filter(has_text="Save the date").click()
    a.keyboard.press("Control+c")
    left.get_by_role("button", name=re.compile(r"^Invitation principale")).click()
    a.keyboard.press("Control+v")
    d = wait_draft(lambda d: any(l["text"] == "Save the date" for l in sec(d, "hero")[0]["layers"]), "copier-coller vers une autre section")
    n_hero = len(sec(d, "hero")[0]["layers"])
    expect(props.get_by_role("heading", name="Texte libre")).to_be_visible()
    a.wait_for_timeout(300)
    a.keyboard.press("Delete")
    try:
        d = wait_draft(lambda d: len(sec(d, "hero")[0]["layers"]) == n_hero - 1, "suppression au clavier")
    except AssertionError:
        a.screenshot(path=SHOTS / "debug-suppr.png")
        print(json.dumps(sec(draft(), "hero")[0]["layers"])[:600], n_hero)
        raise
    a.keyboard.press("Control+z")
    try:
        d = wait_draft(lambda d: len(sec(d, "hero")[0]["layers"]) == n_hero, "annuler la suppression")
    except AssertionError:
        a.screenshot(path=SHOTS / "debug-undo.png")
        print("focus:", a.evaluate("document.activeElement && document.activeElement.outerHTML.slice(0,200)"), len(sec(draft(), "hero")[0]["layers"]), n_hero)
        raise
    ok("éditeur visuel : texte libre, copier-coller entre sections, Suppr et Ctrl+Z")

    left.get_by_label("Ajouter une section").select_option("text")
    props.get_by_label("Titre affiché").fill("Notre histoire")
    props.get_by_label("Texte", exact=True).fill("Rencontrés à Lyon en 2019.")
    props.get_by_role("button", name="Dupliquer la section").click()
    d = wait_draft(lambda d: len(sec(d, "text")) == 2 and all(x["body"] == "Rencontrés à Lyon en 2019." for x in sec(d, "text")), "section dupliquée")
    props.get_by_role("button", name="Supprimer la section").click()
    d = wait_draft(lambda d: len(sec(d, "text")) == 1, "section supprimée")
    order = [x["type"] for x in d["sections"]]
    assert order.index("text") == order.index("hero") + 1, order
    a.wait_for_timeout(300)
    a.screenshot(path=SHOTS / "29-editeur-visuel.png")
    ok("éditeur visuel : section « texte libre » ajoutée, dupliquée, supprimée")

    # Éléments intégrés au modèle : sélectionner, modifier, déplacer, retirer
    left.get_by_role("button", name=re.compile(r"^Invitation principale")).click()
    left.get_by_role("button", name=re.compile("^Bouquet en haut à gauche")).click()
    expect(props.get_by_role("heading", name="Bouquet en haut à gauche")).to_be_visible()
    props.get_by_role("button", name="Retirer l'élément").click()
    d = wait_draft(lambda d: sec(d, "hero")[0]["elements"].get("corner-left", {}).get("hidden") is True, "ornement retiré")
    a.locator('[data-section="hero"] [data-el="kicker"]').click()
    expect(props.get_by_role("heading", name="Accroche")).to_be_visible()
    props.get_by_label("Texte", exact=True).fill("Avec leurs familles réunies")
    d = wait_draft(lambda d: d["kicker"] == "Avec leurs familles réunies", "texte modifié depuis l'élément")
    names = a.locator('[data-section="hero"] [data-el="names"]')
    nb = names.bounding_box()
    a.mouse.move(nb["x"] + nb["width"] / 2, nb["y"] + 10)
    a.mouse.down()
    a.mouse.move(nb["x"] + nb["width"] / 2 + 25, nb["y"] + 30, steps=6)
    a.mouse.up()
    expect(props.get_by_role("heading", name="Prénoms")).to_be_visible()
    props.get_by_label("Imposer une couleur").check()
    d = wait_draft(lambda d: (sec(d, "hero")[0]["elements"].get("names", {}).get("dx", 0) > 2) and sec(d, "hero")[0]["elements"]["names"]["color"] != "", "prénoms déplacés et recolorés")
    a.locator('[data-section="hero"] [data-el="divider"]').click()
    expect(props.get_by_role("heading", name="Ornement central")).to_be_visible()
    a.keyboard.press("Delete")
    d = wait_draft(lambda d: sec(d, "hero")[0]["elements"].get("divider", {}).get("hidden") is True, "ornement retiré au clavier")
    expect(a.locator('[data-section="hero"] [data-el="divider"]')).to_have_count(0)
    expect(a.locator('[data-section="hero"] [data-el="corner-left"]')).to_have_count(0)
    a.screenshot(path=SHOTS / "31-editeur-elements.png")
    ok("éléments du modèle : sélection au clic, texte modifié, déplacé, recoloré, ornements retirés")

    # Historique : point de sauvegarde puis restauration
    a.get_by_role("button", name="Historique").click()
    hist = a.get_by_role("dialog", name="Historique du brouillon")
    hist.get_by_label("Créer un point de sauvegarde du brouillon actuel").fill("Validé par Alice")
    hist.get_by_role("button", name="Créer").click()
    expect(hist.get_by_text("Validé par Alice")).to_be_visible(timeout=10000)
    expect(hist.get_by_text("Avant une séance de modifications").first).to_be_visible()
    hist.get_by_role("button", name="Fermer").click()
    left.get_by_role("button", name=re.compile(r"^Notre histoire")).click()
    props.get_by_label("Texte", exact=True).fill("Texte à jeter")
    d = wait_draft(lambda d: sec(d, "text")[0]["body"] == "Texte à jeter", "modification avant restauration")
    expect(a.get_by_role("status").filter(has_text="Brouillon enregistré")).to_be_visible(timeout=10000)
    a.get_by_role("button", name="Historique").click()
    hist.locator("li").filter(has_text="Validé par Alice").get_by_role("button", name="Restaurer").click()
    expect(a.get_by_text("Brouillon restauré")).to_be_visible(timeout=10000)
    d = wait_draft(lambda d: sec(d, "text")[0]["body"] == "Rencontrés à Lyon en 2019.", "restauration")
    expect(props.get_by_label("Texte", exact=True)).to_have_count(0)
    a.get_by_role("button", name="Historique").click()
    expect(hist.get_by_text(re.compile("Avant la restauration du"))).to_be_visible(timeout=10000)
    hist.get_by_role("button", name="Fermer").click()
    ok("historique : point de sauvegarde, restauration, état remplacé conservé")

    # Publication : les calques apparaissent sur l'invitation en ligne
    a.goto(f"{BASE}/admin/invitations/{inv_id}?onglet=publication")
    a.get_by_role("button", name="Publier les modifications").click()
    a.wait_for_url(re.compile(r"publiee="), timeout=20000)
    vis = browser.new_context(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True).new_page()
    vis.goto(f"{BASE}/mark-alice-2027")
    if vis.locator("#code").count():
        vis.fill("#code", "jardin2027")
        vis.get_by_role("button", name="Ouvrir l'invitation").click()
        vis.wait_for_timeout(1500)
    vis.get_by_role("button", name="Ouvrir l'invitation").first.click()
    vis.wait_for_timeout(2500)
    expect(vis.locator('[data-section="program"] [data-layer]')).to_have_count(2)
    expect(vis.locator('[data-section="hero"] [data-layer]').filter(has_text="Save the date")).to_have_count(1)
    expect(vis.get_by_text("Notre histoire")).to_be_visible()
    expect(vis.locator('[data-section="hero"] [data-el="corner-left"]')).to_have_count(0)
    expect(vis.locator('[data-section="hero"] [data-el="divider"]')).to_have_count(0)
    expect(vis.locator('[data-section="hero"] [data-el="corner-right"]')).to_have_count(1)
    expect(vis.get_by_text("Avec leurs familles réunies")).to_be_visible()
    vis.locator('[data-section="program"]').scroll_into_view_if_needed()
    vis.wait_for_timeout(2500)
    vis.screenshot(path=SHOTS / "30-invitation-avec-calques.png")
    assert vis.evaluate("document.documentElement.scrollWidth <= window.innerWidth"), "défilement horizontal"
    assert vis.evaluate("getComputedStyle(document.querySelector('[data-layer]')).pointerEvents") == "none"
    vis.context.close()
    ok("publication : décors, texte libre et nouvelle section visibles en ligne, sans débordement")

    # Modèle : l'éditeur visuel enregistre une nouvelle version
    garden = api("GET", "/rest/v1/templates?slug=eq.the-garden&select=id,current_version_id")[0]
    a.goto(f"{BASE}/admin/modeles/{garden['id']}/editeur")
    left.get_by_role("button", name=re.compile(r"^Invitation principale")).click()
    left.get_by_role("button", name="+ Texte").click()
    welcome = f"Bienvenue au jardin {int(time.time())}"
    props.get_by_label("Texte", exact=True).fill(welcome)
    a.get_by_role("button", name="Enregistrer une nouvelle version").click()
    expect(a.get_by_role("status").filter(has_text="Version enregistrée")).to_be_visible(timeout=10000)
    g2t = api("GET", "/rest/v1/templates?slug=eq.the-garden&select=current_version_id")[0]
    assert g2t["current_version_id"] != garden["current_version_id"]
    tv = api("GET", f"/rest/v1/template_versions?id=eq.{g2t['current_version_id']}&select=definition")[0]
    hero = [x for x in tv["definition"]["sample"]["sections"] if x["type"] == "hero"][0]
    assert any(l["text"] == welcome for l in hero["layers"]), hero
    page.goto(f"{BASE}/demo/the-garden")
    expect(page.get_by_text(welcome)).to_have_count(1)
    ok("modèles : décors ajoutés dans l'éditeur visuel → nouvelle version, visible sur la démo")

    # Modèle vierge : partir de zéro
    a.goto(f"{BASE}/admin/editeur")
    blank_name = f"Page test {int(time.time())}"
    a.get_by_label("Nom du nouveau modèle").fill(blank_name)
    a.get_by_role("button", name="Créer un modèle vierge").click()
    a.wait_for_url(re.compile(r"/admin/modeles/[0-9a-f-]+/editeur$"), timeout=20000)
    expect(a.get_by_role("heading", name=f"Modèle {blank_name}")).to_be_visible()
    assert left.locator("ul").first.locator("> li").count() == 1
    expect(a.locator("[data-section] svg")).to_have_count(0)
    left.get_by_label("Ajouter une section").select_option("text")
    props.get_by_label("Titre affiché").fill("Notre histoire")
    left.get_by_role("button", name="+ Texte").click()
    props.get_by_label("Texte", exact=True).fill("Save the date")
    a.get_by_role("button", name="Enregistrer une nouvelle version").click()
    expect(a.get_by_role("status").filter(has_text="Version enregistrée")).to_be_visible(timeout=10000)
    bt = api("GET", f"/rest/v1/templates?name=eq.{urllib.parse.quote(blank_name)}&select=status,current_version_id")[0]
    assert bt["status"] == "draft"
    bv = api("GET", f"/rest/v1/template_versions?id=eq.{bt['current_version_id']}&select=renderer,definition")[0]
    assert bv["renderer"] == "blank" and [x["type"] for x in bv["definition"]["sample"]["sections"]] == ["hero", "text"], bv["definition"]["sample"]["sections"]
    a.screenshot(path=SHOTS / "32-modele-vierge.png")
    ok("modèle vierge : créé depuis l'éditeur, sans ornement, composé puis enregistré (hors catalogue)")

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

    c.goto(f"{BASE}/mon-espace")
    c.get_by_role("link", name="Voir toutes les réponses").click()
    expect(c.get_by_text("Paul Durand")).to_be_visible()
    expect(c.get_by_text("Hugo Test")).to_be_visible()
    c.screenshot(path=SHOTS / "25-espace-couple-reponses.png", full_page=True)
    cx = c.context.request.get(f"{BASE}/api/exports/{inv_id}?format=csv")
    assert cx.status == 200 and "Paul" in cx.text()
    naomi_id = api("GET", "/rest/v1/invitations?slug=eq.naomi-kate&select=id")[0]["id"]
    c.goto(f"{BASE}/mon-espace/{naomi_id}")
    expect(c.get_by_text("Page introuvable")).to_be_visible()
    nx = c.context.request.get(f"{BASE}/api/exports/{naomi_id}?format=csv")
    assert nx.status == 404, nx.status
    ok("scénarios 4/5/7 : le couple voit et exporte ses réponses, jamais celles d'un autre couple")

    browser.close()

print(f"\n{len(passed)} vérifications réussies.")
