-- ════════════════════════════════════════════════════════════════════
-- E-Invitly — éditeur visuel : historique des brouillons
-- À exécuter une fois dans Supabase (SQL Editor), après les migrations
-- précédentes.
-- ════════════════════════════════════════════════════════════════════

-- Points de restauration du brouillon d'une invitation :
--   auto    : état avant une nouvelle séance de modifications
--   manual  : point créé à la main (« Créer un point de sauvegarde »)
--   restore : état remplacé par une restauration
create table if not exists public.invitation_draft_history (
  id            uuid primary key default gen_random_uuid(),
  invitation_id uuid not null references public.invitations (id) on delete cascade,
  content       jsonb not null,
  kind          text not null default 'auto' check (kind in ('auto', 'manual', 'restore')),
  label         text check (char_length(label) <= 120),
  created_by    uuid references public.profiles (id) on delete set null,
  created_at    timestamptz not null default now()
);
create index if not exists invitation_draft_history_inv_idx
  on public.invitation_draft_history (invitation_id, created_at desc);

alter table public.invitation_draft_history enable row level security;
drop policy if exists invitation_draft_history_staff on public.invitation_draft_history;
create policy invitation_draft_history_staff on public.invitation_draft_history for all
  using (public.is_staff()) with check (public.is_staff());

-- On garde les 60 derniers points par invitation.
create or replace function public.prune_draft_history()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  delete from public.invitation_draft_history h
   where h.invitation_id = new.invitation_id
     and h.id in (
       select id from public.invitation_draft_history
        where invitation_id = new.invitation_id
        order by created_at desc
        offset 60
     );
  return null;
end $$;
revoke all on function public.prune_draft_history() from public, anon, authenticated;

drop trigger if exists invitation_draft_history_prune on public.invitation_draft_history;
create trigger invitation_draft_history_prune
  after insert on public.invitation_draft_history
  for each row execute function public.prune_draft_history();
