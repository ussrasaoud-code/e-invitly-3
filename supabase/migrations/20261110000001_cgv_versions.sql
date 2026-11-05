-- Versions des CGV acceptées lors des commandes en ligne.
-- Chaque commande garde l'empreinte (hash) de la version acceptée ; le texte
-- exact est conservé ici une seule fois par version, pour pouvoir le prouver.

create table if not exists public.terms_versions (
  hash        text primary key check (char_length(hash) between 8 and 64),
  body        text not null,
  created_at  timestamptz not null default now()
);

alter table public.terms_versions enable row level security;

-- Lecture et écriture réservées à l'équipe ; les commandes l'alimentent côté serveur (clé secrète).
drop policy if exists terms_versions_staff on public.terms_versions;
create policy terms_versions_staff on public.terms_versions for all
  using (public.is_staff()) with check (public.is_staff());

notify pgrst, 'reload schema';
