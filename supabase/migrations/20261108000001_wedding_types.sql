-- Un modèle peut proposer plusieurs types de mariage ; la cliente choisit le sien
-- au début du formulaire : français / européen, maghrébin, ou franco-maghrébin (mixte).

alter table public.templates
  add column if not exists cultures text[] not null default '{europeen}';
do $$ begin
  alter table public.templates add constraint templates_cultures_check
    check (cardinality(cultures) between 1 and 3 and cultures <@ array['europeen', 'maghrebin', 'mixte']::text[]);
exception when duplicate_object then null; end $$;

-- Reprend le réglage précédent (colonne « culture » de la migration 20261107000001), s'il existe
do $$ begin
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'templates' and column_name = 'culture') then
    update public.templates set cultures = array[culture] where culture is not null and cultures = '{europeen}' and culture <> 'europeen';
  end if;
end $$;

notify pgrst, 'reload schema';
