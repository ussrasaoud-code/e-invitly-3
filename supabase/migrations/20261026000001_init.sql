-- ════════════════════════════════════════════════════════════════════
-- E-Invitly — schéma initial
-- Toutes les tables ont Row Level Security activé.
-- Les écritures publiques (demandes, RSVP) passent par le serveur Next.js
-- avec la clé service_role, après validation et anti-spam.
-- ════════════════════════════════════════════════════════════════════

create extension if not exists pgcrypto;
create extension if not exists citext;

-- ── Types ────────────────────────────────────────────────────────────
create type public.user_role as enum ('admin', 'collaborator', 'client');
create type public.template_status as enum ('draft', 'published', 'archived');
create type public.request_status as enum (
  'new', 'in_progress', 'missing_info', 'accepted', 'rejected', 'converted'
);
create type public.invitation_status as enum (
  'draft', 'customizing', 'pending_review', 'ready', 'published', 'unpublished', 'archived'
);
create type public.access_role as enum ('owner', 'viewer');
create type public.rsvp_mode as enum ('open', 'code');

-- ── Utilitaires ─────────────────────────────────────────────────────
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ── Profils ─────────────────────────────────────────────────────────
create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  email       citext not null unique,
  full_name   text,
  role        public.user_role not null default 'client',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();

-- Crée automatiquement un profil « client » à la création d'un compte.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data ->> 'full_name', null))
  on conflict (id) do nothing;
  -- Rattache les accès invitations accordés à cet e-mail avant l'inscription.
  update public.invitation_access
     set user_id = new.id
   where user_id is null and lower(email::text) = lower(new.email);
  return new;
end $$;

-- Fonctions de rôle (security definer : lisent profiles sans boucle RLS)
create or replace function public.current_role_name()
returns public.user_role language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid()
$$;

create or replace function public.is_staff()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select role in ('admin', 'collaborator') from public.profiles where id = auth.uid()), false)
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select role = 'admin' from public.profiles where id = auth.uid()), false)
$$;

-- ── Paramètres (clé → valeur) ───────────────────────────────────────
create table public.settings (
  key         text primary key,
  value       jsonb not null,
  is_public   boolean not null default false,
  updated_at  timestamptz not null default now(),
  updated_by  uuid references public.profiles (id) on delete set null
);
create trigger settings_touch before update on public.settings
  for each row execute function public.touch_updated_at();

-- ── Modèles ─────────────────────────────────────────────────────────
create table public.templates (
  id                  uuid primary key default gen_random_uuid(),
  slug                citext not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name                text not null check (char_length(name) between 1 and 80),
  description         text not null default '',
  short_description   text not null default '',
  category            text not null default 'mariage',
  styles              text[] not null default '{}',
  features            text[] not null default '{}',
  cover_image         text,
  gallery             jsonb not null default '[]'::jsonb,
  price_label         text,
  status              public.template_status not null default 'draft',
  is_featured         boolean not null default false,
  sort_order          integer not null default 100,
  current_version_id  uuid,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create trigger templates_touch before update on public.templates
  for each row execute function public.touch_updated_at();
create index templates_catalog_idx on public.templates (status, sort_order);

create table public.template_versions (
  id           uuid primary key default gen_random_uuid(),
  template_id  uuid not null references public.templates (id) on delete cascade,
  version      integer not null check (version > 0),
  renderer     text not null,
  definition   jsonb not null,
  note         text,
  created_at   timestamptz not null default now(),
  created_by   uuid references public.profiles (id) on delete set null,
  unique (template_id, version)
);
alter table public.templates
  add constraint templates_current_version_fk
  foreign key (current_version_id) references public.template_versions (id) on delete set null;

-- ── Demandes clients ───────────────────────────────────────────────
create sequence public.request_reference_seq;

create table public.client_requests (
  id                  uuid primary key default gen_random_uuid(),
  reference           text not null unique,
  template_id         uuid references public.templates (id) on delete set null,
  contact_first_name  text not null,
  contact_last_name   text not null,
  email               citext not null,
  phone               text,
  country             text,
  language            text not null default 'fr' check (language in ('fr', 'en', 'ar')),
  partner_one         text,
  partner_two         text,
  event_date          date,
  form_data           jsonb not null default '{}'::jsonb,
  status              public.request_status not null default 'new',
  internal_notes      text not null default '',
  invitation_id       uuid,
  consent_at          timestamptz not null,
  ip_hash             text,
  submitted_at        timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  archived_at         timestamptz
);
create trigger client_requests_touch before update on public.client_requests
  for each row execute function public.touch_updated_at();
create index client_requests_status_idx on public.client_requests (status, submitted_at desc);

-- Référence lisible : EI-2026-0001
create or replace function public.assign_request_reference()
returns trigger language plpgsql as $$
begin
  if new.reference is null or new.reference = '' then
    new.reference := 'EI-' || to_char(now(), 'YYYY') || '-' ||
                     lpad(nextval('public.request_reference_seq')::text, 4, '0');
  end if;
  return new;
end $$;
create trigger client_requests_reference before insert on public.client_requests
  for each row execute function public.assign_request_reference();

-- ── Invitations ─────────────────────────────────────────────────────
create table public.invitations (
  id                    uuid primary key default gen_random_uuid(),
  request_id            uuid references public.client_requests (id) on delete set null,
  template_id           uuid references public.templates (id) on delete set null,
  template_version_id   uuid references public.template_versions (id) on delete set null,
  renderer              text not null,
  slug                  citext not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug::text) <= 80),
  title                 text not null,
  partner_one           text,
  partner_two           text,
  client_email          citext,
  status                public.invitation_status not null default 'draft',
  event_at              timestamptz,
  timezone              text not null default 'Europe/Paris',
  language              text not null default 'fr' check (language in ('fr', 'en', 'ar')),
  draft_content         jsonb not null default '{}'::jsonb,
  draft_updated_at      timestamptz not null default now(),
  published_version_id  uuid,
  published_at          timestamptz,
  noindex               boolean not null default true,
  access_code_hash      text,
  internal_notes        text not null default '',
  created_by            uuid references public.profiles (id) on delete set null,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  archived_at           timestamptz
);
create trigger invitations_touch before update on public.invitations
  for each row execute function public.touch_updated_at();
create index invitations_status_idx on public.invitations (status, event_at);

alter table public.client_requests
  add constraint client_requests_invitation_fk
  foreign key (invitation_id) references public.invitations (id) on delete set null;

create table public.invitation_versions (
  id             uuid primary key default gen_random_uuid(),
  invitation_id  uuid not null references public.invitations (id) on delete cascade,
  version        integer not null check (version > 0),
  content        jsonb not null,
  note           text,
  published_at   timestamptz not null default now(),
  published_by   uuid references public.profiles (id) on delete set null,
  unique (invitation_id, version)
);
alter table public.invitations
  add constraint invitations_published_version_fk
  foreign key (published_version_id) references public.invitation_versions (id) on delete set null;

create table public.slug_redirects (
  old_slug       citext primary key,
  invitation_id  uuid not null references public.invitations (id) on delete cascade,
  created_at     timestamptz not null default now()
);

create table public.preview_tokens (
  token_hash     text primary key,
  invitation_id  uuid not null references public.invitations (id) on delete cascade,
  expires_at     timestamptz not null,
  created_by     uuid references public.profiles (id) on delete set null,
  created_at     timestamptz not null default now()
);

-- ── Accès des couples ───────────────────────────────────────────────
create table public.invitation_access (
  id             uuid primary key default gen_random_uuid(),
  invitation_id  uuid not null references public.invitations (id) on delete cascade,
  email          citext not null,
  user_id        uuid references public.profiles (id) on delete cascade,
  role           public.access_role not null default 'owner',
  granted_by     uuid references public.profiles (id) on delete set null,
  created_at     timestamptz not null default now(),
  unique (invitation_id, email)
);
create index invitation_access_user_idx on public.invitation_access (user_id);

-- Si le couple a déjà un compte, l'accès est rattaché immédiatement
-- (sinon il le sera à la création du compte, via handle_new_user).
create or replace function public.link_access_to_existing_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.user_id is null then
    select id into new.user_id from public.profiles where email = new.email;
  end if;
  return new;
end $$;
create trigger invitation_access_link before insert or update of email on public.invitation_access
  for each row execute function public.link_access_to_existing_user();

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.has_invitation_access(target uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_staff() or exists (
    select 1 from public.invitation_access a
     where a.invitation_id = target and a.user_id = auth.uid()
  )
$$;

-- ── RSVP ────────────────────────────────────────────────────────────
create table public.rsvp_forms (
  id                uuid primary key default gen_random_uuid(),
  invitation_id     uuid not null unique references public.invitations (id) on delete cascade,
  fields            jsonb not null default '{}'::jsonb,
  custom_questions  jsonb not null default '[]'::jsonb,
  deadline          timestamptz,
  is_open           boolean not null default true,
  mode              public.rsvp_mode not null default 'open',
  max_companions    integer not null default 1 check (max_companions between 0 and 20),
  updated_at        timestamptz not null default now()
);
create trigger rsvp_forms_touch before update on public.rsvp_forms
  for each row execute function public.touch_updated_at();

create table public.guests (
  id              uuid primary key default gen_random_uuid(),
  invitation_id   uuid not null references public.invitations (id) on delete cascade,
  display_name    text not null,
  code            text not null,
  max_companions  integer not null default 0 check (max_companions between 0 and 20),
  created_at      timestamptz not null default now(),
  unique (invitation_id, code)
);

create table public.rsvp_responses (
  id                uuid primary key default gen_random_uuid(),
  invitation_id     uuid not null references public.invitations (id) on delete cascade,
  form_id           uuid references public.rsvp_forms (id) on delete set null,
  guest_id          uuid references public.guests (id) on delete set null,
  first_name        text not null,
  last_name         text not null default '',
  attending         boolean not null,
  companions_count  integer not null default 0 check (companions_count between 0 and 20),
  companions        jsonb not null default '[]'::jsonb,
  events            jsonb not null default '[]'::jsonb,
  dietary           text,
  answers           jsonb not null default '{}'::jsonb,
  comment           text,
  idempotency_key   text not null,
  ip_hash           text,
  submitted_at      timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (invitation_id, idempotency_key),
  -- Garde-fou : on ne peut pas venir accompagné si on décline.
  check (attending or companions_count = 0)
);
create trigger rsvp_responses_touch before update on public.rsvp_responses
  for each row execute function public.touch_updated_at();
create index rsvp_responses_invitation_idx on public.rsvp_responses (invitation_id, submitted_at desc);

create table public.rsvp_response_edits (
  id           uuid primary key default gen_random_uuid(),
  response_id  uuid not null references public.rsvp_responses (id) on delete cascade,
  before       jsonb not null,
  after        jsonb not null,
  edited_by    uuid references public.profiles (id) on delete set null,
  edited_at    timestamptz not null default now()
);

-- Statistiques fiables (personnes ≠ formulaires)
create view public.rsvp_stats with (security_invoker = true) as
select
  i.id as invitation_id,
  count(r.id)                                                   as responses,
  count(r.id) filter (where r.attending)                        as attending_responses,
  count(r.id) filter (where not r.attending)                    as declined_responses,
  coalesce(sum(r.companions_count) filter (where r.attending), 0) as companions,
  count(r.id) filter (where r.attending)
    + coalesce(sum(r.companions_count) filter (where r.attending), 0) as confirmed_people,
  max(r.submitted_at)                                           as last_response_at
from public.invitations i
left join public.rsvp_responses r on r.invitation_id = i.id
group by i.id;

-- ── Médias ──────────────────────────────────────────────────────────
create table public.media_assets (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  kind          text not null check (kind in ('image', 'svg', 'video', 'audio')),
  bucket        text not null default 'media',
  path          text not null,
  mime_type     text not null,
  size_bytes    bigint not null check (size_bytes > 0),
  width         integer,
  height        integer,
  collection    text not null default 'general',
  tags          text[] not null default '{}',
  license_note  text,
  uploaded_by   uuid references public.profiles (id) on delete set null,
  created_at    timestamptz not null default now(),
  unique (bucket, path)
);

-- ── Journal ─────────────────────────────────────────────────────────
create table public.audit_logs (
  id             bigint generated always as identity primary key,
  actor_id       uuid references public.profiles (id) on delete set null,
  action         text not null,
  resource_type  text not null,
  resource_id    text,
  summary        text,
  details        jsonb not null default '{}'::jsonb,
  created_at     timestamptz not null default now()
);
create index audit_logs_created_idx on public.audit_logs (created_at desc);

-- ── Limitation de débit (anti-abus) ─────────────────────────────────
create table public.rate_limits (
  bucket        text not null,
  window_start  timestamptz not null,
  hits          integer not null default 0,
  primary key (bucket, window_start)
);

-- Renvoie true si l'appel est autorisé. Appelée uniquement par le serveur.
create or replace function public.check_rate_limit(p_bucket text, p_limit integer, p_window_seconds integer)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  w timestamptz := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  n integer;
begin
  insert into public.rate_limits as rl (bucket, window_start, hits)
  values (p_bucket, w, 1)
  on conflict (bucket, window_start) do update set hits = rl.hits + 1
  returning hits into n;
  delete from public.rate_limits where window_start < now() - interval '2 days';
  return n <= p_limit;
end $$;
revoke all on function public.check_rate_limit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.check_rate_limit(text, integer, integer) to service_role;

-- ── Lecture publique d'une invitation ───────────────────────────────
-- Renvoie uniquement la version PUBLIÉE (jamais le brouillon ni les
-- coordonnées du client). Gère aussi les anciennes URL redirigées.
create or replace function public.get_published_invitation(p_slug text)
returns table (
  invitation_id uuid,
  slug text,
  renderer text,
  language text,
  event_at timestamptz,
  timezone text,
  noindex boolean,
  requires_code boolean,
  content jsonb,
  version integer,
  redirect_to text
)
language plpgsql stable security definer set search_path = public as $$
declare
  inv public.invitations%rowtype;
  target_slug text;
begin
  select * into inv from public.invitations where invitations.slug = p_slug::citext;
  if not found then
    select i.slug::text into target_slug
      from public.slug_redirects r join public.invitations i on i.id = r.invitation_id
     where r.old_slug = p_slug::citext and i.status = 'published';
    if target_slug is not null then
      return query select null::uuid, null::text, null::text, null::text, null::timestamptz,
        null::text, true, false, null::jsonb, null::integer, target_slug;
    end if;
    return;
  end if;
  if inv.status <> 'published' or inv.published_version_id is null then
    return;
  end if;
  return query
    select inv.id, inv.slug::text, inv.renderer, inv.language, inv.event_at, inv.timezone,
           inv.noindex, inv.access_code_hash is not null, v.content, v.version, null::text
      from public.invitation_versions v
     where v.id = inv.published_version_id;
end $$;
grant execute on function public.get_published_invitation(text) to anon, authenticated;

-- ── Row Level Security ──────────────────────────────────────────────
alter table public.profiles            enable row level security;
alter table public.settings            enable row level security;
alter table public.templates           enable row level security;
alter table public.template_versions   enable row level security;
alter table public.client_requests     enable row level security;
alter table public.invitations         enable row level security;
alter table public.invitation_versions enable row level security;
alter table public.slug_redirects      enable row level security;
alter table public.preview_tokens      enable row level security;
alter table public.invitation_access   enable row level security;
alter table public.rsvp_forms          enable row level security;
alter table public.guests              enable row level security;
alter table public.rsvp_responses      enable row level security;
alter table public.rsvp_response_edits enable row level security;
alter table public.media_assets        enable row level security;
alter table public.audit_logs          enable row level security;
alter table public.rate_limits         enable row level security;

-- Profils : chacun lit le sien ; le staff lit tout ; seul un admin change les rôles.
create policy profiles_self_read on public.profiles for select
  using (id = auth.uid() or public.is_staff());
create policy profiles_admin_write on public.profiles for update
  using (public.is_admin()) with check (public.is_admin());

-- Paramètres : publics si marqués, sinon staff ; écriture admin.
create policy settings_read on public.settings for select
  using (is_public or public.is_staff());
create policy settings_admin_write on public.settings for all
  using (public.is_admin()) with check (public.is_admin());

-- Modèles : catalogue public = statut publié.
create policy templates_public_read on public.templates for select
  using (status = 'published' or public.is_staff());
create policy templates_staff_write on public.templates for all
  using (public.is_staff()) with check (public.is_staff());

create policy template_versions_read on public.template_versions for select
  using (
    public.is_staff() or exists (
      select 1 from public.templates t
       where t.id = template_id and t.status = 'published' and t.current_version_id = template_versions.id
    )
  );
create policy template_versions_staff_write on public.template_versions for all
  using (public.is_staff()) with check (public.is_staff());

-- Demandes : staff uniquement (l'insertion publique passe par le serveur).
create policy client_requests_staff on public.client_requests for all
  using (public.is_staff()) with check (public.is_staff());

-- Invitations : staff, ou couple autorisé en lecture.
create policy invitations_staff on public.invitations for all
  using (public.is_staff()) with check (public.is_staff());
create policy invitations_client_read on public.invitations for select
  using (public.has_invitation_access(id));

create policy invitation_versions_staff on public.invitation_versions for all
  using (public.is_staff()) with check (public.is_staff());
create policy invitation_versions_client_read on public.invitation_versions for select
  using (public.has_invitation_access(invitation_id));

create policy slug_redirects_staff on public.slug_redirects for all
  using (public.is_staff()) with check (public.is_staff());
create policy preview_tokens_staff on public.preview_tokens for all
  using (public.is_staff()) with check (public.is_staff());

create policy invitation_access_staff on public.invitation_access for all
  using (public.is_staff()) with check (public.is_staff());
create policy invitation_access_self_read on public.invitation_access for select
  using (user_id = auth.uid());

create policy rsvp_forms_staff on public.rsvp_forms for all
  using (public.is_staff()) with check (public.is_staff());
create policy rsvp_forms_client_read on public.rsvp_forms for select
  using (public.has_invitation_access(invitation_id));

create policy guests_staff on public.guests for all
  using (public.is_staff()) with check (public.is_staff());
create policy guests_client_read on public.guests for select
  using (public.has_invitation_access(invitation_id));

create policy rsvp_responses_staff on public.rsvp_responses for all
  using (public.is_staff()) with check (public.is_staff());
create policy rsvp_responses_client_read on public.rsvp_responses for select
  using (public.has_invitation_access(invitation_id));

create policy rsvp_response_edits_staff on public.rsvp_response_edits for all
  using (public.is_staff()) with check (public.is_staff());

create policy media_assets_staff on public.media_assets for all
  using (public.is_staff()) with check (public.is_staff());

create policy audit_logs_staff_read on public.audit_logs for select
  using (public.is_staff());
-- (rate_limits : aucune politique → inaccessible hors service_role)

-- ── Storage ─────────────────────────────────────────────────────────
-- Exécuté seulement si le schéma storage existe (projet Supabase).
do $$
begin
  if exists (select 1 from information_schema.schemata where schema_name = 'storage') then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values
      ('media', 'media', true, 15728640,
        array['image/png','image/jpeg','image/webp','image/svg+xml','video/mp4','video/webm','audio/mpeg','audio/mp4','audio/ogg']),
      ('uploads', 'uploads', false, 10485760,
        array['image/png','image/jpeg','image/webp'])
    on conflict (id) do nothing;

    execute $p$create policy "media public read" on storage.objects for select using (bucket_id = 'media')$p$;
    execute $p$create policy "media staff write" on storage.objects for insert with check (bucket_id = 'media' and public.is_staff())$p$;
    execute $p$create policy "media staff update" on storage.objects for update using (bucket_id = 'media' and public.is_staff())$p$;
    execute $p$create policy "media staff delete" on storage.objects for delete using (bucket_id = 'media' and public.is_staff())$p$;
    execute $p$create policy "uploads staff all" on storage.objects for all using (bucket_id = 'uploads' and public.is_staff()) with check (bucket_id = 'uploads' and public.is_staff())$p$;
  end if;
end $$;
