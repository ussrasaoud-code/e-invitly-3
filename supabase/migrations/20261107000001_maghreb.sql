-- Mariage maghrébin : formulaire dédié, plusieurs jours, invités du henné.

-- Chaque modèle ouvre le formulaire adapté à sa culture.
alter table public.templates
  add column if not exists culture text not null default 'europeen';
do $$ begin
  alter table public.templates add constraint templates_culture_check check (culture in ('europeen', 'maghrebin'));
exception when duplicate_object then null; end $$;

-- Lien privé « henné + soirée » : e-invitly.com/<adresse>?h=<jeton>
-- (le lien normal ne montre que la soirée). Lisible uniquement par l'équipe et le couple.
alter table public.invitations
  add column if not exists henna_token text unique check (henna_token is null or char_length(henna_token) >= 12);

-- Réponse arrivée par le lien normal (« all ») ou par le lien du henné (« henna »).
alter table public.rsvp_responses
  add column if not exists audience text not null default 'all';
do $$ begin
  alter table public.rsvp_responses add constraint rsvp_responses_audience_check check (audience in ('all', 'henna'));
exception when duplicate_object then null; end $$;

notify pgrst, 'reload schema';
