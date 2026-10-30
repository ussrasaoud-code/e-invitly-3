-- ════════════════════════════════════════════════════════════════════
-- E-Invitly — phase 4 : publication
-- Lecture publique d'une invitation, avec code d'accès facultatif.
-- À exécuter une fois dans Supabase (SQL Editor) après la migration initiale.
-- ════════════════════════════════════════════════════════════════════

-- L'ancienne version (un seul paramètre) est remplacée.
drop function if exists public.get_published_invitation(text);

-- Renvoie uniquement la version PUBLIÉE (jamais le brouillon ni les
-- coordonnées du client).
-- Si l'invitation est protégée par un code, le contenu n'est renvoyé que
-- si p_code_hash correspond. Ce hachage est calculé par le serveur avec
-- un secret que le navigateur ne connaît pas : appeler cette fonction
-- directement ne permet pas de deviner le code.
create or replace function public.get_published_invitation(p_slug text, p_code_hash text default null)
returns table (
  invitation_id uuid,
  slug text,
  renderer text,
  language text,
  event_at timestamptz,
  timezone text,
  noindex boolean,
  requires_code boolean,
  unlocked boolean,
  content jsonb,
  version integer,
  redirect_to text
)
language plpgsql stable security definer set search_path = public as $$
declare
  inv public.invitations%rowtype;
  target_slug text;
  is_unlocked boolean;
begin
  select * into inv from public.invitations where invitations.slug = p_slug::citext;
  if not found then
    select i.slug::text into target_slug
      from public.slug_redirects r join public.invitations i on i.id = r.invitation_id
     where r.old_slug = p_slug::citext and i.status = 'published';
    if target_slug is not null then
      return query select null::uuid, null::text, null::text, null::text, null::timestamptz,
        null::text, true, false, false, null::jsonb, null::integer, target_slug;
    end if;
    return;
  end if;
  if inv.status <> 'published' or inv.published_version_id is null then
    return;
  end if;
  is_unlocked := inv.access_code_hash is null
    or (p_code_hash is not null and p_code_hash = inv.access_code_hash);
  return query
    select inv.id, inv.slug::text, inv.renderer, inv.language, inv.event_at, inv.timezone,
           inv.noindex or not is_unlocked, inv.access_code_hash is not null, is_unlocked,
           case when is_unlocked then v.content else null end,
           case when is_unlocked then v.version else null end,
           null::text
      from public.invitation_versions v
     where v.id = inv.published_version_id;
end $$;

revoke all on function public.get_published_invitation(text, text) from public;
grant execute on function public.get_published_invitation(text, text) to anon, authenticated, service_role;
