-- ════════════════════════════════════════════════════════════════════
-- E-Invitly — brouillon automatique des modèles
-- Chaque modification d'un modèle est enregistrée automatiquement dans ce
-- brouillon ; « Enregistrer une nouvelle version » le transforme en version.
-- À exécuter une fois dans Supabase (SQL Editor).
-- ════════════════════════════════════════════════════════════════════
create table if not exists public.template_drafts (
  template_id uuid primary key references public.templates (id) on delete cascade,
  definition  jsonb not null,
  updated_by  uuid references public.profiles (id) on delete set null,
  updated_at  timestamptz not null default now()
);

alter table public.template_drafts enable row level security;
drop policy if exists template_drafts_staff on public.template_drafts;
create policy template_drafts_staff on public.template_drafts for all
  using (public.is_staff()) with check (public.is_staff());
