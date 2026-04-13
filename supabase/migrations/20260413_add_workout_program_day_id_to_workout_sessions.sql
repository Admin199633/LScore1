alter table public.workout_sessions
  add column if not exists workout_program_day_id uuid;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'workout_sessions'
      and column_name = 'day_id'
  ) then
    execute $sql$
      update public.workout_sessions
      set workout_program_day_id = case
        when day_id is null then null
        when day_id::text ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
          then day_id::text::uuid
        else workout_program_day_id
      end
      where workout_program_day_id is null
    $sql$;
  end if;
end;
$$;

create or replace function public.sync_workout_sessions_program_day_id()
returns trigger
language plpgsql
as $$
begin
  if new.day_id is not null
     and new.day_id::text ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    new.workout_program_day_id := new.day_id::text::uuid;
  end if;

  return new;
end;
$$;

drop trigger if exists set_workout_sessions_program_day_id on public.workout_sessions;

create trigger set_workout_sessions_program_day_id
before insert or update on public.workout_sessions
for each row
execute function public.sync_workout_sessions_program_day_id();

create index if not exists workout_sessions_user_program_day_idx
  on public.workout_sessions (user_id, workout_program_day_id, session_date desc);
