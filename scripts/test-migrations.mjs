/**
 * Teste les migrations et les règles de sécurité (RLS) sur un vrai moteur
 * PostgreSQL embarqué (PGlite), avec une imitation minimale du schéma
 * « auth » de Supabase.
 *
 * Usage : npm run test:db
 */
import { PGlite } from "@electric-sql/pglite";
import { citext } from "@electric-sql/pglite/contrib/citext";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { readFileSync, readdirSync } from "node:fs";
import assert from "node:assert/strict";

const db = new PGlite({ extensions: { citext, pgcrypto } });

// ── Imitation du socle Supabase ───────────────────────────────────────
await db.exec(`
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin bypassrls;
  create schema auth;
  create table auth.users (id uuid primary key default gen_random_uuid(), email text, raw_user_meta_data jsonb default '{}'::jsonb);
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema auth to anon, authenticated, service_role;
  grant execute on function auth.uid() to anon, authenticated, service_role;
`);

const migrations = readdirSync("supabase/migrations").filter((f) => f.endsWith(".sql")).sort();
for (const file of migrations) {
  await db.exec(readFileSync(`supabase/migrations/${file}`, "utf8"));
  console.log(`✓ migration ${file}`);
}

// Droits par défaut de Supabase : tout est accordé, RLS filtre.
await db.exec(`
  grant usage on schema public to anon, authenticated, service_role;
  grant all on all tables in schema public to anon, authenticated, service_role;
  grant all on all sequences in schema public to anon, authenticated, service_role;
`);

await db.exec(readFileSync("supabase/seed.sql", "utf8"));
console.log("✓ seed");

// ── Aides ─────────────────────────────────────────────────────────────
async function as(role, userId, fn) {
  await db.exec("reset role");
  await db.query(`select set_config('request.jwt.claim.sub', $1, false)`, [userId ?? ""]);
  await db.exec(`set role ${role}`);
  try {
    return await fn();
  } finally {
    await db.exec("reset role");
  }
}
const rows = async (sql, params = []) => (await db.query(sql, params)).rows;
let passed = 0;
async function test(name, fn) {
  await fn();
  passed++;
  console.log(`✓ ${name}`);
}

// ── Données de test ───────────────────────────────────────────────────
const [admin] = await rows(`insert into auth.users (email) values ('admin@e-invitly.test') returning id`);
await db.query(`update public.profiles set role = 'admin' where id = $1`, [admin.id]);
const [mark] = await rows(`insert into auth.users (email) values ('mark@example.test') returning id`);
const [stranger] = await rows(`insert into auth.users (email) values ('curieux@example.test') returning id`);

const [tpl] = await rows(`select id, current_version_id from public.templates where slug = 'the-garden'`);

async function makeInvitation(slug, title, email) {
  const [inv] = await rows(
    `insert into public.invitations (template_id, template_version_id, renderer, slug, title, client_email, draft_content)
     values ($1, $2, 'the-garden', $3, $4, $5, '{"v":"draft"}') returning id`,
    [tpl.id, tpl.current_version_id, slug, title, email],
  );
  const [ver] = await rows(
    `insert into public.invitation_versions (invitation_id, version, content) values ($1, 1, $2) returning id`,
    [inv.id, JSON.stringify({ couple: title, time: "15:30" })],
  );
  await db.query(
    `update public.invitations set status = 'published', published_version_id = $2, published_at = now() where id = $1`,
    [inv.id, ver.id],
  );
  await db.query(`insert into public.invitation_access (invitation_id, email) values ($1, $2)`, [inv.id, email]);
  return inv.id;
}

const markAlice = await makeInvitation("mark-alice", "Mark & Alice", "mark@example.test");
const naomiKate = await makeInvitation("naomi-kate", "Naomi & Kate", "naomi@example.test");
// Naomi crée son compte APRÈS l'attribution de l'accès : il doit être rattaché.
const [naomi] = await rows(`insert into auth.users (email) values ('naomi@example.test') returning id`);

for (const [inv, who, attending, companions] of [
  [markAlice, "Paul", true, 1],
  [markAlice, "Julie", false, 0],
  [naomiKate, "Omar", true, 2],
]) {
  await db.query(
    `insert into public.rsvp_responses (invitation_id, first_name, attending, companions_count, idempotency_key)
     values ($1, $2, $3, $4, gen_random_uuid()::text)`,
    [inv, who, attending, companions],
  );
}

// ── Tests ─────────────────────────────────────────────────────────────
await test("le seed crée The Garden et Province avec leur version courante", async () => {
  const t = await rows(`select slug, current_version_id from public.templates order by sort_order`);
  assert.deepEqual(t.map((r) => r.slug), ["the-garden", "province"]);
  assert.ok(t.every((r) => r.current_version_id));
});

await test("un visiteur anonyme voit uniquement les modèles publiés", async () => {
  await db.query(`update public.templates set status = 'draft' where slug = 'province'`);
  const t = await as("anon", null, () => rows(`select slug from public.templates`));
  assert.deepEqual(t.map((r) => r.slug), ["the-garden"]);
  await db.query(`update public.templates set status = 'published' where slug = 'province'`);
});

await test("un visiteur anonyme ne lit ni n'écrit les demandes", async () => {
  const r = await as("anon", null, () => rows(`select * from public.client_requests`));
  assert.equal(r.length, 0);
  await assert.rejects(
    as("anon", null, () =>
      rows(`insert into public.client_requests (contact_first_name, contact_last_name, email, consent_at) values ('a','b','c@d.e', now())`),
    ),
  );
});

await test("une demande reçoit une référence EI-AAAA-NNNN (insertion serveur)", async () => {
  const [r] = await as("service_role", null, () =>
    rows(
      `insert into public.client_requests (template_id, contact_first_name, contact_last_name, email, consent_at)
       values ($1, 'Mark', 'Doe', 'mark@example.test', now()) returning reference`,
      [tpl.id],
    ),
  );
  assert.match(r.reference, /^EI-\d{4}-\d{4}$/);
});

await test("l'administratrice lit les demandes ; un client non", async () => {
  assert.equal((await as("authenticated", admin.id, () => rows(`select id from public.client_requests`))).length, 1);
  assert.equal((await as("authenticated", mark.id, () => rows(`select id from public.client_requests`))).length, 0);
});

await test("l'accès de Naomi, accordé avant son inscription, est rattaché à son compte", async () => {
  const [a] = await rows(`select user_id from public.invitation_access where email = 'naomi@example.test'`);
  assert.equal(a.user_id, naomi.id);
});

await test("l'accès accordé à un compte déjà existant est rattaché immédiatement", async () => {
  const [a] = await rows(`select user_id from public.invitation_access where email = 'mark@example.test'`);
  assert.equal(a.user_id, mark.id);
});

await test("scénario 5/7 : chaque couple ne voit que sa propre invitation et ses RSVP", async () => {
  const markInv = await as("authenticated", mark.id, () => rows(`select slug from public.invitations`));
  assert.deepEqual(markInv.map((r) => r.slug), ["mark-alice"]);
  const markRsvp = await as("authenticated", mark.id, () => rows(`select first_name from public.rsvp_responses order by first_name`));
  assert.deepEqual(markRsvp.map((r) => r.first_name), ["Julie", "Paul"]);
  // Tentative directe sur l'identifiant de l'autre couple
  const sneaky = await as("authenticated", mark.id, () =>
    rows(`select * from public.rsvp_responses where invitation_id = $1`, [naomiKate]),
  );
  assert.equal(sneaky.length, 0);
  const naomiRsvp = await as("authenticated", naomi.id, () => rows(`select first_name from public.rsvp_responses`));
  assert.deepEqual(naomiRsvp.map((r) => r.first_name), ["Omar"]);
  const nothing = await as("authenticated", stranger.id, () => rows(`select * from public.rsvp_responses`));
  assert.equal(nothing.length, 0);
});

await test("un couple ne peut pas modifier ses RSVP ni son invitation", async () => {
  const updated = await as("authenticated", mark.id, () =>
    rows(`update public.rsvp_responses set attending = true returning id`),
  );
  assert.equal(updated.length, 0);
  const inv = await as("authenticated", mark.id, () => rows(`update public.invitations set slug = 'hack' returning id`));
  assert.equal(inv.length, 0);
});

await test("les statistiques distinguent réponses et personnes", async () => {
  const [s] = await as("authenticated", mark.id, () => rows(`select * from public.rsvp_stats`));
  assert.equal(Number(s.responses), 2);
  assert.equal(Number(s.attending_responses), 1);
  assert.equal(Number(s.declined_responses), 1);
  assert.equal(Number(s.companions), 1);
  assert.equal(Number(s.confirmed_people), 2);
  const all = await as("authenticated", mark.id, () => rows(`select * from public.rsvp_stats`));
  assert.equal(all.length, 1);
  assert.equal(Number(s.child_menus), 0);
});

await test("un invité nominatif n'a qu'une réponse ; codes invités uniques sans tenir compte de la casse", async () => {
  const [g] = await rows(`insert into public.guests (invitation_id, display_name, code) values ($1, 'Famille Martin', 'ABC123') returning id`, [markAlice]);
  await assert.rejects(db.query(`insert into public.guests (invitation_id, display_name, code) values ($1, 'Autre', 'abc123')`, [markAlice]));
  await db.query(`insert into public.rsvp_responses (invitation_id, guest_id, first_name, attending, idempotency_key) values ($1, $2, 'A', true, 'g1')`, [markAlice, g.id]);
  await assert.rejects(db.query(`insert into public.rsvp_responses (invitation_id, guest_id, first_name, attending, idempotency_key) values ($1, $2, 'B', true, 'g2')`, [markAlice, g.id]));
  await db.query(`delete from public.rsvp_responses where guest_id = $1`, [g.id]);
  await db.query(`delete from public.guests where id = $1`, [g.id]);
});

await test("le couple lit l'historique des corrections de ses réponses, pas celles des autres", async () => {
  const [mine] = await rows(`select id from public.rsvp_responses where invitation_id = $1 limit 1`, [markAlice]);
  const [theirs] = await rows(`select id from public.rsvp_responses where invitation_id = $1 limit 1`, [naomiKate]);
  await db.query(`insert into public.rsvp_response_edits (response_id, before, after) values ($1, '{}', '{}'), ($2, '{}', '{}')`, [mine.id, theirs.id]);
  const seen = await as("authenticated", mark.id, () => rows(`select response_id from public.rsvp_response_edits`));
  assert.deepEqual(seen.map((r) => r.response_id), [mine.id]);
  await assert.rejects(as("authenticated", mark.id, () => rows(`insert into public.rsvp_response_edits (response_id, before, after) values ($1, '{}', '{}')`, [mine.id])));
});

await test("impossible de refuser l'invitation tout en déclarant des accompagnants", async () => {
  await assert.rejects(
    db.query(
      `insert into public.rsvp_responses (invitation_id, first_name, attending, companions_count, idempotency_key) values ($1, 'X', false, 2, 'k')`,
      [markAlice],
    ),
  );
});

await test("une même clé d'idempotence n'enregistre qu'une réponse", async () => {
  const ins = () =>
    db.query(
      `insert into public.rsvp_responses (invitation_id, first_name, attending, idempotency_key) values ($1, 'Z', true, 'same-key')`,
      [markAlice],
    );
  await ins();
  await assert.rejects(ins());
});

await test("scénario 3 : la page publique lit la version publiée, jamais le brouillon", async () => {
  const [r] = await as("anon", null, () => rows(`select * from public.get_published_invitation('mark-alice')`));
  assert.equal(r.content.time, "15:30");
  assert.equal(r.slug, "mark-alice");
  assert.equal("client_email" in r, false);
});

await test("scénario 6 : modifier le brouillon ne change pas la version publique ; republier oui", async () => {
  await db.query(`update public.invitations set draft_content = '{"couple":"Mark & Alice","time":"16:00"}' where id = $1`, [markAlice]);
  let [r] = await as("anon", null, () => rows(`select content from public.get_published_invitation('mark-alice')`));
  assert.equal(r.content.time, "15:30");
  const [v2] = await rows(
    `insert into public.invitation_versions (invitation_id, version, content) select id, 2, draft_content from public.invitations where id = $1 returning id`,
    [markAlice],
  );
  await db.query(`update public.invitations set published_version_id = $2 where id = $1`, [markAlice, v2.id]);
  [r] = await as("anon", null, () => rows(`select content, version from public.get_published_invitation('mark-alice')`));
  assert.equal(r.content.time, "16:00");
  assert.equal(r.version, 2);
});

await test("scénario 8 : dépubliée ou archivée = inaccessible", async () => {
  for (const status of ["unpublished", "archived", "draft"]) {
    await db.query(`update public.invitations set status = $2 where id = $1`, [naomiKate, status]);
    const r = await as("anon", null, () => rows(`select * from public.get_published_invitation('naomi-kate')`));
    assert.equal(r.length, 0, status);
  }
  await db.query(`update public.invitations set status = 'published' where id = $1`, [naomiKate]);
});

await test("un ancien slug redirige vers le nouveau", async () => {
  await db.query(`update public.invitations set slug = 'naomi-et-kate' where id = $1`, [naomiKate]);
  await db.query(`insert into public.slug_redirects (old_slug, invitation_id) values ('naomi-kate', $1)`, [naomiKate]);
  const [r] = await as("anon", null, () => rows(`select redirect_to from public.get_published_invitation('naomi-kate')`));
  assert.equal(r.redirect_to, "naomi-et-kate");
});

await test("code d'accès : sans le bon code, aucun contenu n'est renvoyé", async () => {
  await db.query(`update public.invitations set access_code_hash = 'hash-secret-123' where id = $1`, [markAlice]);
  const [locked] = await as("anon", null, () => rows(`select * from public.get_published_invitation('mark-alice')`));
  assert.equal(locked.requires_code, true);
  assert.equal(locked.unlocked, false);
  assert.equal(locked.content, null);
  assert.equal(locked.noindex, true);
  const [wrong] = await as("anon", null, () => rows(`select content from public.get_published_invitation('mark-alice', 'mauvais')`));
  assert.equal(wrong.content, null);
  const [ok] = await as("anon", null, () => rows(`select content, unlocked from public.get_published_invitation('mark-alice', 'hash-secret-123')`));
  assert.equal(ok.unlocked, true);
  assert.equal(ok.content.time, "16:00");
  await db.query(`update public.invitations set access_code_hash = null where id = $1`, [markAlice]);
});

await test("un visiteur ne peut pas lire directement les versions ni le brouillon", async () => {
  const v = await as("anon", null, () => rows(`select * from public.invitation_versions`));
  assert.equal(v.length, 0);
  const i = await as("anon", null, () => rows(`select * from public.invitations`));
  assert.equal(i.length, 0);
});

await test("deux invitations ne peuvent pas partager un slug (insensible à la casse)", async () => {
  await assert.rejects(
    db.query(
      `insert into public.invitations (renderer, slug, title) values ('the-garden', 'mark-alice', 'Doublon')`,
    ),
  );
});

await test("la limitation de débit est réservée au serveur et fonctionne", async () => {
  await assert.rejects(as("anon", null, () => rows(`select public.check_rate_limit('x', 2, 60)`)));
  const results = [];
  for (let i = 0; i < 3; i++) {
    const [r] = await as("service_role", null, () => rows(`select public.check_rate_limit('ip:abc', 2, 3600) as ok`));
    results.push(r.ok);
  }
  assert.deepEqual(results, [true, true, false]);
});

await test("seul un admin change les rôles", async () => {
  const r = await as("authenticated", mark.id, () => rows(`update public.profiles set role = 'admin' where id = $1 returning id`, [mark.id]));
  assert.equal(r.length, 0);
  const [p] = await rows(`select role from public.profiles where id = $1`, [mark.id]);
  assert.equal(p.role, "client");
});

console.log(`\n${passed} tests de base de données réussis.`);
