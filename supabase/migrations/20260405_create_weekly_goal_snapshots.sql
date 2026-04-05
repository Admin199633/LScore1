create table if not exists public.weekly_goal_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  week_start_date date not null,
  week_end_date date not null,
  goal_type text not null,
  template_id text null,
  title text not null,
  body text not null,
  focus_area text null,
  primary_metric text null,
  targets jsonb not null default '{}'::jsonb,
  actuals jsonb not null default '{}'::jsonb,
  outcomes jsonb not null default '{}'::jsonb,
  confidence text not null default 'low',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  finalized_at timestamptz null,
  constraint weekly_goal_snapshots_user_week_unique unique (user_id, week_start_date),
  constraint weekly_goal_snapshots_week_order_check check (week_end_date >= week_start_date),
  constraint weekly_goal_snapshots_goal_type_check check (
    goal_type in ('training_focus', 'nutrition_focus', 'consistency_focus', 'weight_focus', 'fallback')
  ),
  constraint weekly_goal_snapshots_confidence_check check (
    confidence in ('high', 'medium', 'low')
  )
);

create index if not exists weekly_goal_snapshots_user_week_idx
  on public.weekly_goal_snapshots (user_id, week_start_date desc);

create index if not exists weekly_goal_snapshots_unfinalized_idx
  on public.weekly_goal_snapshots (user_id, finalized_at, week_start_date desc);

create or replace function public.set_weekly_goal_snapshots_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists set_weekly_goal_snapshots_updated_at on public.weekly_goal_snapshots;

create trigger set_weekly_goal_snapshots_updated_at
before update on public.weekly_goal_snapshots
for each row
execute function public.set_weekly_goal_snapshots_updated_at();

alter table public.weekly_goal_snapshots enable row level security;

create policy "weekly_goal_snapshots_select_own"
on public.weekly_goal_snapshots
for select
to authenticated
using (auth.uid() = user_id);

create policy "weekly_goal_snapshots_insert_own"
on public.weekly_goal_snapshots
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "weekly_goal_snapshots_update_own"
on public.weekly_goal_snapshots
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
