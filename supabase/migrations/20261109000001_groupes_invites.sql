-- Groupes d'invités : un lien privé par groupe (ex. « Famille proche » pour la mairie,
-- « Henné » pour le henné…), en plus du lien principal ouvert à tous.
-- private_links = { "<id du groupe>": "<jeton>" } ; lisible uniquement par l'équipe et le couple.
alter table public.invitations
  add column if not exists private_links jsonb not null default '{}'::jsonb;

-- Réponse arrivée par le lien principal (« all ») ou par le lien d'un groupe (son identifiant).
alter table public.rsvp_responses
  add column if not exists audience text not null default 'all';
alter table public.rsvp_responses drop constraint if exists rsvp_responses_audience_check;
do $$ begin
  alter table public.rsvp_responses add constraint rsvp_responses_audience_check check (audience ~ '^[a-z0-9-]{1,40}$');
exception when duplicate_object then null; end $$;

notify pgrst, 'reload schema';
