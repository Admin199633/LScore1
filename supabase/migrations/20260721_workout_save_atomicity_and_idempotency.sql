-- ============================================================================
-- 20260721 — Workout save atomicity & idempotency
-- ----------------------------------------------------------------------------
-- Context: completed workouts are persisted from the client through the
-- existing `create_workout_session(...)` RPC. That RPC is atomic for a single
-- workout, but the client historically:
--   * had no idempotency key, so a commit whose HTTP response was lost could be
--     re-sent and either duplicated or blocked; and
--   * performed "overwrite" as a client-side DELETE followed by a separate
--     save, so a failure between the two could delete an existing workout
--     without persisting its replacement (data loss).
--
-- This migration is ADDITIVE and BACKWARD-COMPATIBLE. It does not modify or
-- delete any existing user data, and it does not weaken RLS.
--
--   1. Adds a nullable `client_workout_id uuid` column to `workout_sessions`.
--   2. Adds a UNIQUE partial index on (user_id, client_workout_id) so the same
--      client-generated key can never create two sessions for one user.
--   3. Adds `save_workout_session(...)`: an idempotent, single-transaction
--      wrapper that dedupes by client_workout_id, performs overwrite
--      in-transaction (delete-then-insert together, so it commits fully or
--      rolls back fully), and DELEGATES the actual insert to the proven
--      `create_workout_session(...)`. Delegating means this migration never has
--      to reference columns it cannot see (e.g. the program-id column lives
--      inside create_workout_session), which keeps it safe to apply.
--
-- The client prefers save_workout_session and automatically falls back to
-- create_workout_session if this migration has not been applied, so deploying
-- the client without the migration (or vice-versa) never breaks saving.
--
-- Rollback:
--   drop function if exists public.save_workout_session(
--     uuid, boolean, date, uuid, text, uuid, text,
--     timestamptz, timestamptz, integer, text, jsonb);
--   drop index if exists public.workout_sessions_client_workout_id_uidx;
--   alter table public.workout_sessions drop column if exists client_workout_id;
-- Rolling back is data-safe: the column is nullable and only ever additive.
-- ============================================================================

-- 1) Idempotency key column ---------------------------------------------------
alter table public.workout_sessions
  add column if not exists client_workout_id uuid;

-- 2) Uniqueness guard: one session per (user, client_workout_id) --------------
create unique index if not exists workout_sessions_client_workout_id_uidx
  on public.workout_sessions (user_id, client_workout_id)
  where client_workout_id is not null;

-- 3) Atomic + idempotent save wrapper ----------------------------------------
create or replace function public.save_workout_session(
  p_client_workout_id uuid,
  p_overwrite boolean,
  p_session_date date,
  p_day_id uuid,
  p_day_name text,
  p_program_id uuid,
  p_status text,
  p_started_at timestamptz,
  p_ended_at timestamptz,
  p_duration_seconds integer,
  p_energy_level text,
  p_exercises jsonb
)
returns uuid
language plpgsql
-- SECURITY INVOKER (default): all statements below run under the caller's
-- identity and are constrained by the existing RLS policies. RLS is NOT
-- weakened by this function.
as $$
declare
  v_user uuid := auth.uid();
  v_existing_id uuid;
  v_new_id uuid;
begin
  if v_user is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;

  -- Idempotent replay: if this exact client_workout_id was already persisted
  -- for this user, return it unchanged. This makes "retry after the server
  -- committed but the client lost the response" a safe no-op (no duplicate).
  if p_client_workout_id is not null then
    select id
      into v_existing_id
      from public.workout_sessions
     where user_id = v_user
       and client_workout_id = p_client_workout_id
     limit 1;

    if v_existing_id is not null then
      return v_existing_id;
    end if;
  end if;

  -- Atomic overwrite: delete the existing same-day session for this workout day
  -- in the SAME transaction as the insert below. If the insert fails, this
  -- delete is rolled back, so an existing workout is never lost.
  if p_overwrite then
    delete from public.workout_sessions
     where user_id = v_user
       and session_date = p_session_date
       and (
         (p_day_id is not null
           and (workout_program_day_id = p_day_id or day_id::text = p_day_id::text))
         or ((p_day_id is null) and p_day_name is not null and day_name = p_day_name)
       );
  end if;

  -- Delegate the real insert (session + exercises + sets) to the proven,
  -- schema-aware function. Runs inside this function's transaction, so the
  -- whole workout commits together or not at all.
  perform public.create_workout_session(
    p_session_date      => p_session_date,
    p_day_id            => p_day_id,
    p_day_name          => p_day_name,
    p_program_id        => p_program_id,
    p_status            => p_status,
    p_started_at        => p_started_at,
    p_ended_at          => p_ended_at,
    p_duration_seconds  => p_duration_seconds,
    p_energy_level      => p_energy_level,
    p_exercises         => p_exercises
  );

  -- Identify the row just created and stamp the idempotency key on it so future
  -- retries dedupe. Matching by (user, date, day) + newest created_at is safe
  -- because create_workout_session raises WORKOUT_SESSION_ALREADY_EXISTS when a
  -- same-day session already exists, so at most one un-keyed row can match.
  select id
    into v_new_id
    from public.workout_sessions
   where user_id = v_user
     and session_date = p_session_date
     and (
       (p_day_id is not null
         and (workout_program_day_id = p_day_id or day_id::text = p_day_id::text))
       or day_name = p_day_name
     )
   order by created_at desc nulls last
   limit 1;

  if v_new_id is not null and p_client_workout_id is not null then
    update public.workout_sessions
       set client_workout_id = p_client_workout_id
     where id = v_new_id
       and client_workout_id is null;
  end if;

  return v_new_id;
end;
$$;

grant execute on function public.save_workout_session(
  uuid, boolean, date, uuid, text, uuid, text,
  timestamptz, timestamptz, integer, text, jsonb
) to authenticated;
