/**
 * Génère supabase/seed.sql à partir des définitions TypeScript des modèles.
 * Usage : node scripts/generate-seed.ts
 */
import { writeFileSync } from "node:fs";
import { PRESETS, TEMPLATE_SEEDS } from "../src/lib/invitation/presets.ts";
import { invitationContentSchema } from "../src/lib/invitation/schema.ts";
import { DEFAULT_SETTINGS } from "../src/lib/settings-defaults.ts";

const q = (s: string) => `'${s.replace(/'/g, "''")}'`;
const arr = (a: string[]) => `array[${a.map(q).join(", ")}]::text[]`;
const json = (v: unknown) => `${q(JSON.stringify(v))}::jsonb`;

let sql = `-- Généré par scripts/generate-seed.ts — ne pas modifier à la main.
-- Modèles de départ (The Garden, Province) et paramètres par défaut.
-- Les contenus « sample » sont des données de DÉMONSTRATION.

`;

for (const t of TEMPLATE_SEEDS) {
  const sample = invitationContentSchema.parse(PRESETS[t.renderer]);
  const definition = { renderer: t.renderer, sample };
  sql += `insert into public.templates (slug, name, short_description, description, category, styles, features, cover_image, status, is_featured, sort_order)
values (${q(t.slug)}, ${q(t.name)}, ${q(t.shortDescription)}, ${q(t.description)}, ${q(t.category)}, ${arr(t.styles)}, ${arr(t.features)}, ${q(t.coverImage)}, 'published', true, ${t.sortOrder})
on conflict (slug) do nothing;

insert into public.template_versions (template_id, version, renderer, definition, note)
select id, 1, ${q(t.renderer)}, ${json(definition)}, 'Version initiale'
from public.templates where slug = ${q(t.slug)}
on conflict (template_id, version) do nothing;

update public.templates t set current_version_id = v.id
from public.template_versions v
where v.template_id = t.id and v.version = 1 and t.slug = ${q(t.slug)} and t.current_version_id is null;

`;
}

for (const [key, { value, isPublic }] of Object.entries(DEFAULT_SETTINGS)) {
  sql += `insert into public.settings (key, value, is_public) values (${q(key)}, ${json(value)}, ${isPublic}) on conflict (key) do nothing;\n`;
}

writeFileSync(new URL("../supabase/seed.sql", import.meta.url), sql);
console.log("supabase/seed.sql écrit");
