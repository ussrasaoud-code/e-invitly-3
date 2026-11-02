-- Phase 7 : site et invitations en 7 langues.

-- 1. Langues acceptées pour les invitations et les demandes
alter table public.invitations drop constraint if exists invitations_language_check;
alter table public.invitations add constraint invitations_language_check
  check (language in ('fr', 'en', 'ar', 'es', 'it', 'de', 'nl'));
alter table public.client_requests drop constraint if exists client_requests_language_check;
alter table public.client_requests add constraint client_requests_language_check
  check (language in ('fr', 'en', 'ar', 'es', 'it', 'de', 'nl'));

-- 2. Fiche catalogue traduite : { "en": { "name": "…", "short_description": "…", "description": "…", "price_label": "…" }, … }
alter table public.templates add column if not exists translations jsonb not null default '{}'::jsonb;

-- 3. Langues ouvertes sur le site (le français toujours ; les autres s'activent dans Paramètres)
insert into public.settings (key, value, is_public)
values ('languages', '{"enabled":["fr"]}'::jsonb, true)
on conflict (key) do nothing;

notify pgrst, 'reload schema';

-- 4. Langues disponibles pour chaque modèle (mises à jour à chaque nouvelle version)
alter table public.templates add column if not exists languages text[] not null default '{fr}';

notify pgrst, 'reload schema';
