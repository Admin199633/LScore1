alter table public.profiles add column if not exists email text;
alter table public.profiles add column if not exists auth_provider text;
alter table public.profiles add column if not exists full_name text;
alter table public.profiles add column if not exists avatar_url text;
alter table public.profiles add column if not exists created_at timestamptz not null default timezone('utc', now());
alter table public.profiles add column if not exists updated_at timestamptz not null default timezone('utc', now());

update public.profiles
set email = nullif(lower(trim(email)), '')
where email is distinct from nullif(lower(trim(email)), '');

create table if not exists public.profiles_dedup_backup (like public.profiles including all);
alter table public.profiles_dedup_backup add column if not exists backup_reason text;
alter table public.profiles_dedup_backup add column if not exists backed_up_at timestamptz not null default timezone('utc', now());

with invalid_profiles as (
  select p.*
  from public.profiles p
  where
    nullif(trim(p.id::text), '') is null
    or p.id::text !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    or (
      p.id::text ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      and not exists (
        select 1
        from auth.users u
        where u.id = (p.id::text)::uuid
      )
    )
)
insert into public.profiles_dedup_backup
select invalid_profiles.*, 'invalid_or_orphaned_profile', timezone('utc', now())
from invalid_profiles;

with invalid_ctids as (
  select p.ctid
  from public.profiles p
  where
    nullif(trim(p.id::text), '') is null
    or p.id::text !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    or (
      p.id::text ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      and not exists (
        select 1
        from auth.users u
        where u.id = (p.id::text)::uuid
      )
    )
)
delete from public.profiles p
using invalid_ctids
where p.ctid = invalid_ctids.ctid;

with ranked_by_id as (
  select
    p.ctid,
    row_number() over (
      partition by p.id::text
      order by
        (
          case when nullif(trim(coalesce(to_jsonb(p)->>'email', '')), '') is not null then 2 else 0 end +
          case when nullif(trim(coalesce(to_jsonb(p)->>'full_name', '')), '') is not null then 1 else 0 end +
          case when nullif(trim(coalesce(to_jsonb(p)->>'avatar_url', '')), '') is not null then 1 else 0 end +
          case when nullif(trim(coalesce(to_jsonb(p)->>'age', '')), '') is not null then 2 else 0 end +
          case when nullif(trim(coalesce(to_jsonb(p)->>'height', '')), '') is not null then 2 else 0 end +
          case when nullif(trim(coalesce(to_jsonb(p)->>'experience', '')), '') is not null then 2 else 0 end +
          case when nullif(trim(coalesce(to_jsonb(p)->>'goal', '')), '') is not null then 2 else 0 end +
          case when coalesce(jsonb_array_length(coalesce(to_jsonb(p)->'focus_areas', '[]'::jsonb)), 0) > 0 then 2 else 0 end +
          case when nullif(trim(coalesce(to_jsonb(p)->>'training_days_per_week', '')), '') is not null then 1 else 0 end +
          case when nullif(trim(coalesce(to_jsonb(p)->>'gender', '')), '') is not null then 1 else 0 end
        ) desc,
        nullif(coalesce(to_jsonb(p)->>'updated_at', ''), '')::timestamptz desc nulls last,
        nullif(coalesce(to_jsonb(p)->>'created_at', ''), '')::timestamptz desc nulls last,
        p.ctid desc
    ) as rn
  from public.profiles p
),
duplicate_rows as (
  select p.*
  from public.profiles p
  join ranked_by_id ranked on ranked.ctid = p.ctid
  where ranked.rn > 1
)
insert into public.profiles_dedup_backup
select duplicate_rows.*, 'duplicate_profile_id', timezone('utc', now())
from duplicate_rows;

with ranked_by_id as (
  select
    p.ctid,
    row_number() over (
      partition by p.id::text
      order by
        (
          case when nullif(trim(coalesce(to_jsonb(p)->>'email', '')), '') is not null then 2 else 0 end +
          case when nullif(trim(coalesce(to_jsonb(p)->>'full_name', '')), '') is not null then 1 else 0 end +
          case when nullif(trim(coalesce(to_jsonb(p)->>'avatar_url', '')), '') is not null then 1 else 0 end +
          case when nullif(trim(coalesce(to_jsonb(p)->>'age', '')), '') is not null then 2 else 0 end +
          case when nullif(trim(coalesce(to_jsonb(p)->>'height', '')), '') is not null then 2 else 0 end +
          case when nullif(trim(coalesce(to_jsonb(p)->>'experience', '')), '') is not null then 2 else 0 end +
          case when nullif(trim(coalesce(to_jsonb(p)->>'goal', '')), '') is not null then 2 else 0 end +
          case when coalesce(jsonb_array_length(coalesce(to_jsonb(p)->'focus_areas', '[]'::jsonb)), 0) > 0 then 2 else 0 end +
          case when nullif(trim(coalesce(to_jsonb(p)->>'training_days_per_week', '')), '') is not null then 1 else 0 end +
          case when nullif(trim(coalesce(to_jsonb(p)->>'gender', '')), '') is not null then 1 else 0 end
        ) desc,
        nullif(coalesce(to_jsonb(p)->>'updated_at', ''), '')::timestamptz desc nulls last,
        nullif(coalesce(to_jsonb(p)->>'created_at', ''), '')::timestamptz desc nulls last,
        p.ctid desc
    ) as rn
  from public.profiles p
),
duplicate_ctids as (
  select ctid
  from ranked_by_id
  where rn > 1
)
delete from public.profiles p
using duplicate_ctids
where p.ctid = duplicate_ctids.ctid;

with ranked_by_email as (
  select
    p.ctid,
    row_number() over (
      partition by lower(trim(p.email))
      order by
        (
          case when nullif(trim(coalesce(to_jsonb(p)->>'email', '')), '') is not null then 2 else 0 end +
          case when nullif(trim(coalesce(to_jsonb(p)->>'full_name', '')), '') is not null then 1 else 0 end +
          case when nullif(trim(coalesce(to_jsonb(p)->>'avatar_url', '')), '') is not null then 1 else 0 end +
          case when nullif(trim(coalesce(to_jsonb(p)->>'age', '')), '') is not null then 2 else 0 end +
          case when nullif(trim(coalesce(to_jsonb(p)->>'height', '')), '') is not null then 2 else 0 end +
          case when nullif(trim(coalesce(to_jsonb(p)->>'experience', '')), '') is not null then 2 else 0 end +
          case when nullif(trim(coalesce(to_jsonb(p)->>'goal', '')), '') is not null then 2 else 0 end +
          case when coalesce(jsonb_array_length(coalesce(to_jsonb(p)->'focus_areas', '[]'::jsonb)), 0) > 0 then 2 else 0 end +
          case when nullif(trim(coalesce(to_jsonb(p)->>'training_days_per_week', '')), '') is not null then 1 else 0 end +
          case when nullif(trim(coalesce(to_jsonb(p)->>'gender', '')), '') is not null then 1 else 0 end
        ) desc,
        nullif(coalesce(to_jsonb(p)->>'updated_at', ''), '')::timestamptz desc nulls last,
        nullif(coalesce(to_jsonb(p)->>'created_at', ''), '')::timestamptz desc nulls last,
        p.ctid desc
    ) as rn
  from public.profiles p
  where nullif(trim(p.email), '') is not null
),
duplicate_email_rows as (
  select p.*
  from public.profiles p
  join ranked_by_email ranked on ranked.ctid = p.ctid
  where ranked.rn > 1
)
insert into public.profiles_dedup_backup
select duplicate_email_rows.*, 'duplicate_profile_email', timezone('utc', now())
from duplicate_email_rows;

with ranked_by_email as (
  select
    p.ctid,
    row_number() over (
      partition by lower(trim(p.email))
      order by
        (
          case when nullif(trim(coalesce(to_jsonb(p)->>'email', '')), '') is not null then 2 else 0 end +
          case when nullif(trim(coalesce(to_jsonb(p)->>'full_name', '')), '') is not null then 1 else 0 end +
          case when nullif(trim(coalesce(to_jsonb(p)->>'avatar_url', '')), '') is not null then 1 else 0 end +
          case when nullif(trim(coalesce(to_jsonb(p)->>'age', '')), '') is not null then 2 else 0 end +
          case when nullif(trim(coalesce(to_jsonb(p)->>'height', '')), '') is not null then 2 else 0 end +
          case when nullif(trim(coalesce(to_jsonb(p)->>'experience', '')), '') is not null then 2 else 0 end +
          case when nullif(trim(coalesce(to_jsonb(p)->>'goal', '')), '') is not null then 2 else 0 end +
          case when coalesce(jsonb_array_length(coalesce(to_jsonb(p)->'focus_areas', '[]'::jsonb)), 0) > 0 then 2 else 0 end +
          case when nullif(trim(coalesce(to_jsonb(p)->>'training_days_per_week', '')), '') is not null then 1 else 0 end +
          case when nullif(trim(coalesce(to_jsonb(p)->>'gender', '')), '') is not null then 1 else 0 end
        ) desc,
        nullif(coalesce(to_jsonb(p)->>'updated_at', ''), '')::timestamptz desc nulls last,
        nullif(coalesce(to_jsonb(p)->>'created_at', ''), '')::timestamptz desc nulls last,
        p.ctid desc
    ) as rn
  from public.profiles p
  where nullif(trim(p.email), '') is not null
),
duplicate_email_ctids as (
  select ctid
  from ranked_by_email
  where rn > 1
)
delete from public.profiles p
using duplicate_email_ctids
where p.ctid = duplicate_email_ctids.ctid;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name = 'id'
      and udt_name <> 'uuid'
  ) then
    execute 'alter table public.profiles alter column id type uuid using (id::text::uuid)';
  end if;
end $$;

alter table public.profiles alter column id set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.profiles'::regclass
      and contype = 'p'
  ) then
    alter table public.profiles add constraint profiles_pkey primary key (id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.profiles'::regclass
      and conname = 'profiles_id_fkey'
  ) then
    alter table public.profiles
      add constraint profiles_id_fkey
      foreign key (id)
      references auth.users(id)
      on delete cascade;
  end if;
end $$;

create unique index if not exists profiles_email_unique_idx
  on public.profiles (lower(email))
  where email is not null and trim(email) <> '';

create or replace function public.set_profiles_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists set_profiles_updated_at on public.profiles;

create trigger set_profiles_updated_at
before update on public.profiles
for each row
execute function public.set_profiles_updated_at();

create or replace function public.sync_profile_from_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  normalized_email text;
  resolved_provider text;
  resolved_full_name text;
  resolved_avatar_url text;
begin
  normalized_email := nullif(lower(trim(new.email)), '');
  resolved_provider := coalesce(new.raw_app_meta_data->>'provider', 'email');
  resolved_full_name := coalesce(
    nullif(trim(new.raw_user_meta_data->>'full_name'), ''),
    nullif(trim(new.raw_user_meta_data->>'name'), ''),
    nullif(trim(new.raw_user_meta_data->>'user_name'), '')
  );
  resolved_avatar_url := nullif(trim(new.raw_user_meta_data->>'avatar_url'), '');

  insert into public.profiles (
    id,
    email,
    auth_provider,
    full_name,
    avatar_url
  )
  values (
    new.id,
    normalized_email,
    resolved_provider,
    resolved_full_name,
    resolved_avatar_url
  )
  on conflict (id) do update
    set email = excluded.email,
        auth_provider = coalesce(excluded.auth_provider, public.profiles.auth_provider),
        full_name = coalesce(excluded.full_name, public.profiles.full_name),
        avatar_url = coalesce(excluded.avatar_url, public.profiles.avatar_url),
        updated_at = timezone('utc', now());

  return new;
exception
  when unique_violation then
    raise exception
      using message = 'PROFILE_EMAIL_ALREADY_LINKED',
            detail = coalesce(normalized_email, '');
end;
$$;

drop trigger if exists sync_profile_from_auth_user on auth.users;

create trigger sync_profile_from_auth_user
after insert or update of email, raw_app_meta_data, raw_user_meta_data
on auth.users
for each row
execute function public.sync_profile_from_auth_user();

with canonical_auth_users as (
  select distinct on (coalesce(nullif(lower(trim(email)), ''), id::text))
    id,
    nullif(lower(trim(email)), '') as email,
    coalesce(raw_app_meta_data->>'provider', 'email') as auth_provider,
    coalesce(
      nullif(trim(raw_user_meta_data->>'full_name'), ''),
      nullif(trim(raw_user_meta_data->>'name'), ''),
      nullif(trim(raw_user_meta_data->>'user_name'), '')
    ) as full_name,
    nullif(trim(raw_user_meta_data->>'avatar_url'), '') as avatar_url
  from auth.users
  order by
    coalesce(nullif(lower(trim(email)), ''), id::text),
    last_sign_in_at desc nulls last,
    created_at desc nulls last,
    id desc
)
insert into public.profiles (
  id,
  email,
  auth_provider,
  full_name,
  avatar_url
)
select
  id,
  email,
  auth_provider,
  full_name,
  avatar_url
from canonical_auth_users
on conflict (id) do update
  set email = excluded.email,
      auth_provider = coalesce(excluded.auth_provider, public.profiles.auth_provider),
      full_name = coalesce(excluded.full_name, public.profiles.full_name),
      avatar_url = coalesce(excluded.avatar_url, public.profiles.avatar_url),
      updated_at = timezone('utc', now());
