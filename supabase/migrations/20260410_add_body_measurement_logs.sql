create table if not exists public.body_measurement_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  measurement_date date not null,
  chest_cm numeric null,
  waist_cm numeric null,
  abdomen_cm numeric null,
  hips_cm numeric null,
  left_arm_cm numeric null,
  right_arm_cm numeric null,
  left_thigh_cm numeric null,
  right_thigh_cm numeric null,
  notes text null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint body_measurement_logs_at_least_one_value_check check (
    chest_cm is not null
    or waist_cm is not null
    or abdomen_cm is not null
    or hips_cm is not null
    or left_arm_cm is not null
    or right_arm_cm is not null
    or left_thigh_cm is not null
    or right_thigh_cm is not null
  ),
  constraint body_measurement_logs_chest_cm_positive_check check (chest_cm is null or chest_cm > 0),
  constraint body_measurement_logs_waist_cm_positive_check check (waist_cm is null or waist_cm > 0),
  constraint body_measurement_logs_abdomen_cm_positive_check check (abdomen_cm is null or abdomen_cm > 0),
  constraint body_measurement_logs_hips_cm_positive_check check (hips_cm is null or hips_cm > 0),
  constraint body_measurement_logs_left_arm_cm_positive_check check (left_arm_cm is null or left_arm_cm > 0),
  constraint body_measurement_logs_right_arm_cm_positive_check check (right_arm_cm is null or right_arm_cm > 0),
  constraint body_measurement_logs_left_thigh_cm_positive_check check (left_thigh_cm is null or left_thigh_cm > 0),
  constraint body_measurement_logs_right_thigh_cm_positive_check check (right_thigh_cm is null or right_thigh_cm > 0)
);

create index if not exists body_measurement_logs_user_date_idx
  on public.body_measurement_logs (user_id, measurement_date desc);

create or replace function public.set_body_measurement_logs_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists set_body_measurement_logs_updated_at on public.body_measurement_logs;

create trigger set_body_measurement_logs_updated_at
before update on public.body_measurement_logs
for each row
execute function public.set_body_measurement_logs_updated_at();

alter table public.body_measurement_logs enable row level security;

create policy "body_measurement_logs_select_own"
on public.body_measurement_logs
for select
to authenticated
using (auth.uid() = user_id);

create policy "body_measurement_logs_insert_own"
on public.body_measurement_logs
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "body_measurement_logs_update_own"
on public.body_measurement_logs
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "body_measurement_logs_delete_own"
on public.body_measurement_logs
for delete
to authenticated
using (auth.uid() = user_id);
