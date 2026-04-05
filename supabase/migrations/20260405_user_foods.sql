-- user_foods: per-user custom food entries that override the JSON food database
-- during nutrition parsing. Matching order: user_foods first, then proteinFoods JSON.

create table if not exists public.user_foods (
  id                    uuid        primary key default gen_random_uuid(),
  user_id               uuid        not null references auth.users(id) on delete cascade,
  name                  text        not null,
  aliases               text[]      not null default '{}',
  calories              numeric     not null,
  protein               numeric     not null,
  carbs                 numeric     not null,
  fat                   numeric     not null,
  unit_type             text        not null default 'weight',  -- 'weight' | 'unit'
  unit_label            text        not null default '100g',    -- e.g. '100g', 'יחידה', 'כף'
  unit_grams            numeric     null,                       -- grams per unit (for weight units)
  source_unresolved_text text       null,                       -- original unresolved text that spawned this entry
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

-- RLS
alter table public.user_foods enable row level security;

create policy "users_select_own_foods"
  on public.user_foods for select
  using (auth.uid() = user_id);

create policy "users_insert_own_foods"
  on public.user_foods for insert
  with check (auth.uid() = user_id);

create policy "users_update_own_foods"
  on public.user_foods for update
  using (auth.uid() = user_id);

create policy "users_delete_own_foods"
  on public.user_foods for delete
  using (auth.uid() = user_id);

-- Index for fast per-user lookups
create index if not exists user_foods_user_id_idx on public.user_foods (user_id);
