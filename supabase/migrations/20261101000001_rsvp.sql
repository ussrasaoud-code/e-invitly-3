-- ════════════════════════════════════════════════════════════════════
-- E-Invitly — phase 5 : réponses RSVP
-- À exécuter une fois dans Supabase (SQL Editor), après les migrations
-- précédentes.
-- ════════════════════════════════════════════════════════════════════

-- Nombre de menus enfant demandés dans une réponse (le reste = menus adulte).
alter table public.rsvp_responses
  add column if not exists child_menus integer not null default 0
  check (child_menus between 0 and 21);

-- Un invité nominatif (mode « code ») n'a qu'une seule réponse : il la met à jour.
create unique index if not exists rsvp_responses_one_per_guest
  on public.rsvp_responses (guest_id) where guest_id is not null;

-- Les codes invités sont comparés sans tenir compte des majuscules.
create unique index if not exists guests_code_ci
  on public.guests (invitation_id, upper(code));

-- Statistiques : + menus enfant, + date de dernière réponse déjà présente.
create or replace view public.rsvp_stats with (security_invoker = true) as
select
  i.id as invitation_id,
  count(r.id)                                                     as responses,
  count(r.id) filter (where r.attending)                          as attending_responses,
  count(r.id) filter (where not r.attending)                      as declined_responses,
  coalesce(sum(r.companions_count) filter (where r.attending), 0) as companions,
  count(r.id) filter (where r.attending)
    + coalesce(sum(r.companions_count) filter (where r.attending), 0) as confirmed_people,
  max(r.submitted_at)                                             as last_response_at,
  coalesce(sum(r.child_menus) filter (where r.attending), 0)      as child_menus
from public.invitations i
left join public.rsvp_responses r on r.invitation_id = i.id
group by i.id;

-- Le couple peut lire l'historique des corrections de SES réponses.
drop policy if exists rsvp_response_edits_client_read on public.rsvp_response_edits;
create policy rsvp_response_edits_client_read on public.rsvp_response_edits for select
  using (exists (
    select 1 from public.rsvp_responses r
     where r.id = response_id and public.has_invitation_access(r.invitation_id)
  ));
