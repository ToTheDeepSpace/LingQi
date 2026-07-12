-- Track who supplied each dossier field so DM-owned values can be locked independently.

alter table if exists public.lc_dm_dossiers
  add column if not exists field_provenance jsonb not null default '{}'::jsonb;

alter table if exists public.lc_dm_dossiers
  drop constraint if exists lc_dm_dossiers_field_provenance_object_check;

alter table if exists public.lc_dm_dossiers
  add constraint lc_dm_dossiers_field_provenance_object_check
  check (jsonb_typeof(field_provenance) = 'object');

update public.lc_dm_dossiers d
set field_provenance = coalesce(d.field_provenance, '{}'::jsonb)
  || case when nullif(btrim(d.dm_name), '') is not null then jsonb_build_object('dm_name', jsonb_build_object('source', 'community', 'updated_at', d.updated_at)) else '{}'::jsonb end
  || case when nullif(btrim(d.city), '') is not null then jsonb_build_object('city', jsonb_build_object('source', 'community', 'updated_at', d.updated_at)) else '{}'::jsonb end
  || case when nullif(btrim(d.profile_url), '') is not null then jsonb_build_object('profile_url', jsonb_build_object('source', 'community', 'updated_at', d.updated_at)) else '{}'::jsonb end
  || case when nullif(btrim(d.photo_url), '') is not null then jsonb_build_object('photo_url', jsonb_build_object('source', 'community', 'updated_at', d.updated_at)) else '{}'::jsonb end
  || case when jsonb_array_length(coalesce(d.photo_files, '[]'::jsonb)) > 0 then jsonb_build_object('photo_files', jsonb_build_object('source', 'community', 'updated_at', d.updated_at)) else '{}'::jsonb end
  || case when nullif(btrim(d.note), '') is not null then jsonb_build_object('note', jsonb_build_object('source', 'community', 'updated_at', d.updated_at)) else '{}'::jsonb end
  || case when cardinality(coalesce(d.tags, '{}'::text[])) > 0 then jsonb_build_object('tags', jsonb_build_object('source', 'community', 'updated_at', d.updated_at)) else '{}'::jsonb end
  || case when d.dm_started_month is not null then jsonb_build_object('dm_started_month', jsonb_build_object('source', 'community', 'updated_at', d.updated_at)) else '{}'::jsonb end
  || case when d.birth_year is not null then jsonb_build_object('birth_year', jsonb_build_object('source', 'community', 'updated_at', d.updated_at)) else '{}'::jsonb end
  || case when d.height_cm is not null then jsonb_build_object('height_cm', jsonb_build_object('source', 'community', 'updated_at', d.updated_at)) else '{}'::jsonb end
  || case when d.weight_kg is not null then jsonb_build_object('weight_kg', jsonb_build_object('source', 'community', 'updated_at', d.updated_at)) else '{}'::jsonb end
  || case when nullif(btrim(d.mbti), '') is not null then jsonb_build_object('mbti', jsonb_build_object('source', 'community', 'updated_at', d.updated_at)) else '{}'::jsonb end
  || case when nullif(btrim(d.zodiac), '') is not null then jsonb_build_object('zodiac', jsonb_build_object('source', 'community', 'updated_at', d.updated_at)) else '{}'::jsonb end
  || case when nullif(btrim(d.bio), '') is not null then jsonb_build_object('bio', jsonb_build_object('source', 'community', 'updated_at', d.updated_at)) else '{}'::jsonb end
  || case when jsonb_array_length(coalesce(d.common_scripts, '[]'::jsonb)) > 0 then jsonb_build_object('common_scripts', jsonb_build_object('source', 'community', 'updated_at', d.updated_at)) else '{}'::jsonb end
  || case when jsonb_array_length(coalesce(d.career_history, '[]'::jsonb)) > 0 then jsonb_build_object('career_history', jsonb_build_object('source', 'community', 'updated_at', d.updated_at)) else '{}'::jsonb end
  || case when jsonb_array_length(coalesce(d.related_profiles, '[]'::jsonb)) > 0 then jsonb_build_object('related_profiles', jsonb_build_object('source', 'community', 'updated_at', d.updated_at)) else '{}'::jsonb end
  || case when jsonb_array_length(coalesce(d.related_stores, '[]'::jsonb)) > 0 then jsonb_build_object('related_stores', jsonb_build_object('source', 'community', 'updated_at', d.updated_at)) else '{}'::jsonb end;

with owner_fields as (
  select
    r.payload ->> 'dossier_id' as dossier_id,
    field.value as field_name,
    coalesce(r.reviewed_at, r.updated_at, r.created_at) as source_updated_at,
    r.profile_id as actor_id
  from public.lc_public_reviews r
  cross join lateral jsonb_array_elements_text(
    coalesce(r.payload -> 'submitted_changed_fields', r.payload -> 'changed_fields', '[]'::jsonb)
  ) field(value)
  where r.target_type = 'dossier_update'
    and coalesce((r.payload ->> 'submitter_is_owner')::boolean, false)
    and (r.status = 'approved' or jsonb_array_length(coalesce(r.payload -> 'applied_immediate_fields', '[]'::jsonb)) > 0)
), latest_owner_fields as (
  select distinct on (dossier_id, field_name)
    dossier_id,
    field_name,
    source_updated_at,
    actor_id
  from owner_fields
  where dossier_id is not null
  order by dossier_id, field_name, source_updated_at desc
), owner_provenance as (
  select
    dossier_id,
    jsonb_object_agg(
      field_name,
      jsonb_build_object('source', 'owner', 'updated_at', source_updated_at, 'actor_id', actor_id)
    ) as fields
  from latest_owner_fields
  group by dossier_id
)
update public.lc_dm_dossiers d
set field_provenance = d.field_provenance || owner_provenance.fields
from owner_provenance
where d.id::text = owner_provenance.dossier_id;
