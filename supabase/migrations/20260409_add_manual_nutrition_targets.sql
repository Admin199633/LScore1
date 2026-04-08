alter table public.profiles
  add column if not exists nutrition_target_mode text not null default 'auto',
  add column if not exists manual_daily_calories integer,
  add column if not exists manual_daily_protein integer;

update public.profiles
set nutrition_target_mode = 'auto'
where nutrition_target_mode is null;

alter table public.profiles
  drop constraint if exists profiles_nutrition_target_mode_check;

alter table public.profiles
  add constraint profiles_nutrition_target_mode_check
  check (nutrition_target_mode in ('auto', 'manual'));
