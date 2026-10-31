-- ════════════════════════════════════════════════════════════════════
-- E-Invitly — bibliothèque de médias
-- À exécuter une fois dans Supabase (SQL Editor), après les migrations
-- précédentes.
-- ════════════════════════════════════════════════════════════════════

create index if not exists media_assets_collection_idx on public.media_assets (collection, created_at desc);

-- Où un fichier est-il utilisé ? (avant suppression)
-- Réservé à l'équipe : renvoie les invitations et modèles qui contiennent son adresse.
create or replace function public.media_usage(p_url text)
returns table (kind text, id uuid, title text)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_staff() then
    raise exception 'accès refusé' using errcode = '42501';
  end if;
  if p_url is null or length(p_url) < 8 then
    return;
  end if;
  return query
    select distinct u.kind, u.id, u.title from (
      select 'invitation'::text as kind, i.id, i.title::text as title
        from public.invitations i
       where strpos(i.draft_content::text, p_url) > 0
      union all
      select 'invitation', i.id, i.title::text
        from public.invitation_versions v join public.invitations i on i.id = v.invitation_id
       where i.published_version_id = v.id and strpos(v.content::text, p_url) > 0
      union all
      select 'modele', t.id, t.name::text
        from public.templates t
       where t.cover_image = p_url or strpos(t.gallery::text, p_url) > 0
      union all
      select 'modele', t.id, t.name::text
        from public.template_versions tv join public.templates t on t.id = tv.template_id
       where t.current_version_id = tv.id and strpos(tv.definition::text, p_url) > 0
    ) u;
end $$;
revoke all on function public.media_usage(text) from public, anon;
grant execute on function public.media_usage(text) to authenticated, service_role;

-- Compartiments de stockage (sans effet s'ils existent déjà).
do $$
begin
  if exists (select 1 from information_schema.schemata where schema_name = 'storage') then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('media', 'media', true, 15728640,
      array['image/png','image/jpeg','image/webp','image/svg+xml','video/mp4','video/webm','audio/mpeg','audio/mp4','audio/ogg'])
    on conflict (id) do update
      set public = true,
          file_size_limit = excluded.file_size_limit,
          allowed_mime_types = excluded.allowed_mime_types;
  end if;
end $$;
