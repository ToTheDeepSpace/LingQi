-- Preserve user-selected crop focus while keeping original images unchanged.

alter table if exists public.lc_dm_dossiers
  add column if not exists photo_focus_x real not null default 50,
  add column if not exists photo_focus_y real not null default 25;

alter table if exists public.lc_profiles
  add column if not exists avatar_focus_x real not null default 50,
  add column if not exists avatar_focus_y real not null default 25;

alter table if exists public.lc_dm_dossiers
  drop constraint if exists lc_dm_dossiers_photo_focus_x_check,
  drop constraint if exists lc_dm_dossiers_photo_focus_y_check,
  add constraint lc_dm_dossiers_photo_focus_x_check check (photo_focus_x between 0 and 100),
  add constraint lc_dm_dossiers_photo_focus_y_check check (photo_focus_y between 0 and 100);

alter table if exists public.lc_profiles
  drop constraint if exists lc_profiles_avatar_focus_x_check,
  drop constraint if exists lc_profiles_avatar_focus_y_check,
  add constraint lc_profiles_avatar_focus_x_check check (avatar_focus_x between 0 and 100),
  add constraint lc_profiles_avatar_focus_y_check check (avatar_focus_y between 0 and 100);
