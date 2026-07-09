-- Persist per-exercise notes entered during a workout session.
-- Optional free-text field; NULL means no note was recorded for that exercise.
alter table public.workout_session_exercises
  add column if not exists notes text;
