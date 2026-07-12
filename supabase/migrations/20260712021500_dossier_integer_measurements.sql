alter table public.lc_dm_dossiers
  drop constraint if exists lc_dm_dossiers_height_cm_check,
  drop constraint if exists lc_dm_dossiers_weight_kg_check;

alter table public.lc_dm_dossiers
  add constraint lc_dm_dossiers_height_cm_check
    check (height_cm is null or height_cm between 100 and 250),
  add constraint lc_dm_dossiers_weight_kg_check
    check (
      weight_kg is null
      or (weight_kg between 30 and 300 and weight_kg = trunc(weight_kg))
    );
