import { webSupabase } from '@/lib/supabase/browser';
import { fetchActiveProgramRecord } from '@/lib/repositories/programRepository';

const normalizeSet = (row: { weight?: number | string; reps?: number | string; difficulty?: string | null }) => ({
  weight: String(row.weight ?? ''),
  reps: String(row.reps ?? ''),
  difficulty: row.difficulty || 'good',
});

export type SavedWorkoutSession = {
  id: string;
  date: string;
  dayId: string;
  dayName: string;
  startedAt: string;
  endedAt: string;
  durationSeconds: number;
  energyLevel: string;
  reorderCount: number;
  exercises: Array<{
    exerciseId: string;
    exerciseName: string;
    plannedSets: string;
    plannedReps: string;
    plannedWeight: string;
    completed: boolean;
    durationSeconds?: number | null;
    sets: Array<{ weight: string; reps: string; difficulty: string }>;
  }>;
};

const isStableIdSchemaMismatch = (error: { message?: string; details?: string; hint?: string }) => {
  const combined = `${error?.message || ''} ${error?.details || ''} ${error?.hint || ''}`.toLowerCase();
  return (
    combined.includes('p_day_id') ||
    combined.includes('day_id') ||
    combined.includes('exercise_id') ||
    combined.includes('could not find the function') ||
    combined.includes('no function matches')
  );
};

const normalizeWorkoutInput = (session: {
  date: string;
  dayId?: string;
  dayName: string;
  startedAt?: string;
  endedAt?: string;
  durationSeconds?: number;
  energyLevel?: string;
  exercises: Array<{
    exerciseId?: string;
    exerciseName: string;
    plannedSets?: string;
    plannedReps?: string;
    plannedWeight?: string;
    completed?: boolean;
    durationSeconds?: number;
    sets: Array<{ weight: string | number; reps: string | number; difficulty?: string }>;
  }>;
}) => ({
  date: String(session?.date || '').trim(),
  dayId: String(session?.dayId || '').trim(),
  dayName: String(session?.dayName || '').trim(),
  startedAt: String(session?.startedAt || '').trim(),
  endedAt: String(session?.endedAt || '').trim(),
  durationSeconds: Number(session?.durationSeconds || 0),
  energyLevel: ['low', 'normal', 'high'].includes(String(session?.energyLevel || ''))
    ? String(session.energyLevel)
    : '',
  exercises: Array.isArray(session?.exercises)
    ? session.exercises
        .map((exercise) => ({
          exerciseId: String(exercise?.exerciseId || '').trim(),
          exerciseName: String(exercise?.exerciseName || '').trim(),
          plannedSets: String(exercise?.plannedSets || '').trim(),
          plannedReps: String(exercise?.plannedReps || '').trim(),
          plannedWeight: String(exercise?.plannedWeight || '').trim(),
          completed: Boolean(exercise?.completed),
          durationSeconds: exercise?.durationSeconds ? Number(exercise.durationSeconds) : null,
          sets: Array.isArray(exercise?.sets)
            ? exercise.sets
                .map((setItem) => ({
                  weight: Number(setItem?.weight),
                  reps: Number(setItem?.reps),
                  difficulty: setItem?.difficulty || 'good',
                }))
                .filter(
                  (setItem) =>
                    setItem.weight > 0 && setItem.reps > 0 && Boolean(setItem.difficulty)
                )
            : [],
        }))
        .filter((exercise) => exercise.exerciseName)
    : [],
});

const buildLegacyExercisesPayload = (
  exercises: Array<{
    exerciseName: string;
    plannedSets: string;
    plannedReps: string;
    plannedWeight: string;
    completed: boolean;
    sets: Array<{ weight: number; reps: number; difficulty: string }>;
  }>
) =>
  exercises.map((exercise) => ({
    exerciseName: exercise.exerciseName,
    plannedSets: exercise.plannedSets,
    plannedReps: exercise.plannedReps,
    plannedWeight: exercise.plannedWeight,
    completed: exercise.completed,
    sets: exercise.sets,
  }));

const normalizeWorkout = (
  sessionRow: {
    id: string;
    session_date: string;
    day_id?: string | null;
    day_name?: string | null;
    started_at?: string | null;
    ended_at?: string | null;
    duration_seconds?: number | null;
    energy_level?: string | null;
    reorder_count?: number | null;
  },
  exerciseRows: Array<{
    id: string;
    exercise_id?: string | null;
    exercise_name?: string | null;
    planned_sets?: string | null;
    planned_reps?: string | null;
    planned_weight?: string | null;
    completed?: boolean | null;
    duration_seconds?: number | null;
    exercise_order: number;
  }> = [],
  setRows: Array<{
    workout_session_exercise_id: string;
    set_order: number;
    weight?: number | string;
    reps?: number | string;
    difficulty?: string | null;
  }> = []
): SavedWorkoutSession => ({
  id: sessionRow.id,
  date: sessionRow.session_date,
  dayId: sessionRow.day_id || '',
  dayName: sessionRow.day_name || '',
  startedAt: sessionRow.started_at || '',
  endedAt: sessionRow.ended_at || '',
  durationSeconds: Number(sessionRow.duration_seconds || 0),
  energyLevel: sessionRow.energy_level || '',
  reorderCount: Number(sessionRow.reorder_count || 0),
  exercises: exerciseRows
    .sort((left, right) => left.exercise_order - right.exercise_order)
    .map((exerciseRow) => ({
      exerciseId: exerciseRow.exercise_id || '',
      exerciseName: exerciseRow.exercise_name || '',
      plannedSets: exerciseRow.planned_sets || '',
      plannedReps: exerciseRow.planned_reps || '',
      plannedWeight: exerciseRow.planned_weight || '',
      completed: Boolean(exerciseRow.completed),
      durationSeconds: exerciseRow.duration_seconds ?? null,
      sets: setRows
        .filter((setRow) => setRow.workout_session_exercise_id === exerciseRow.id)
        .sort((left, right) => left.set_order - right.set_order)
        .map(normalizeSet),
    })),
});

export const updateExerciseDurations = async (
  date: string,
  dayId: string,
  durations: Record<string, number>
): Promise<void> => {
  if (Object.keys(durations).length === 0) return;

  const {
    data: { user },
    error: userError,
  } = await webSupabase.auth.getUser();

  if (userError || !user?.id) return;

  const { data: sessionRows } = await webSupabase
    .from('workout_sessions')
    .select('id')
    .eq('user_id', user.id)
    .eq('session_date', date)
    .eq('day_id', dayId)
    .limit(1);

  const sessionId = sessionRows?.[0]?.id;
  if (!sessionId) return;

  const { data: exerciseRows } = await webSupabase
    .from('workout_session_exercises')
    .select('id, exercise_name')
    .eq('workout_session_id', sessionId);

  if (!exerciseRows?.length) return;

  await Promise.all(
    exerciseRows
      .filter((row) => durations[row.exercise_name] !== undefined)
      .map((row) =>
        webSupabase
          .from('workout_session_exercises')
          .update({ duration_seconds: durations[row.exercise_name] })
          .eq('id', row.id)
      )
  );
};

export const updateReorderCount = async (date: string, dayId: string, count: number): Promise<void> => {
  const { data: { user }, error: userError } = await webSupabase.auth.getUser();
  if (userError || !user?.id) return;

  const query = webSupabase
    .from('workout_sessions')
    .update({ reorder_count: count })
    .eq('user_id', user.id)
    .eq('session_date', date);

  if (dayId) query.eq('day_id', dayId);
  await query;
};

export const deleteWorkoutSession = async (date: string, dayId: string): Promise<void> => {
  const {
    data: { user },
    error: userError,
  } = await webSupabase.auth.getUser();

  if (userError || !user?.id) throw userError || new Error('המשתמש לא מחובר.');

  const query = webSupabase
    .from('workout_sessions')
    .delete()
    .eq('user_id', user.id)
    .eq('session_date', date);

  if (dayId) query.eq('day_id', dayId);

  const { error } = await query;
  if (error) throw error;
};

export const deleteWorkoutSessionById = async (id: string): Promise<void> => {
  const {
    data: { user },
    error: userError,
  } = await webSupabase.auth.getUser();

  if (userError || !user?.id) throw userError || new Error('המשתמש לא מחובר.');

  const { error } = await webSupabase
    .from('workout_sessions')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id); // RLS guard: user can only delete their own sessions

  if (error) throw error;
};

export const getWorkoutSessionById = async (id: string): Promise<SavedWorkoutSession | null> => {
  const {
    data: { user },
    error: userError,
  } = await webSupabase.auth.getUser();

  if (userError || !user?.id) throw userError || new Error('המשתמש לא מחובר.');

  const { data: sessionRow, error: sessionError } = await webSupabase
    .from('workout_sessions')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single();

  if (sessionError || !sessionRow) return null;

  const { data: exerciseRows, error: exerciseError } = await webSupabase
    .from('workout_session_exercises')
    .select('*')
    .eq('workout_session_id', id)
    .order('exercise_order', { ascending: true });

  if (exerciseError) throw exerciseError;

  const exerciseIds = (exerciseRows || []).map((row) => row.id);
  let setRows: Array<{
    workout_session_exercise_id: string;
    set_order: number;
    weight?: number | string;
    reps?: number | string;
    difficulty?: string | null;
  }> = [];

  if (exerciseIds.length > 0) {
    const { data, error } = await webSupabase
      .from('workout_session_sets')
      .select('*')
      .in('workout_session_exercise_id', exerciseIds)
      .order('set_order', { ascending: true });

    if (error) throw error;
    setRows = data || [];
  }

  return normalizeWorkout(sessionRow, exerciseRows || [], setRows);
};

export const fetchSavedWorkoutSessions = async (): Promise<SavedWorkoutSession[]> => {
  const {
    data: { user },
    error: userError,
  } = await webSupabase.auth.getUser();

  if (userError) {
    throw userError;
  }

  if (!user?.id) {
    throw new Error('המשתמש לא מחובר.');
  }

  const { data: sessionRows, error: sessionsError } = await webSupabase
    .from('workout_sessions')
    .select('*')
    .eq('user_id', user.id)
    .order('session_date', { ascending: false })
    .order('created_at', { ascending: false });

  if (sessionsError) {
    throw sessionsError;
  }

  const sessionIds = (sessionRows || []).map((row) => row.id);
  if (sessionIds.length === 0) {
    return [];
  }

  const { data: exerciseRows, error: exerciseError } = await webSupabase
    .from('workout_session_exercises')
    .select('*')
    .in('workout_session_id', sessionIds)
    .order('exercise_order', { ascending: true });

  if (exerciseError) {
    throw exerciseError;
  }

  const exerciseIds = (exerciseRows || []).map((row) => row.id);
  let setRows: Array<{
    workout_session_exercise_id: string;
    set_order: number;
    weight?: number | string;
    reps?: number | string;
    difficulty?: string | null;
  }> = [];

  if (exerciseIds.length > 0) {
    const { data, error } = await webSupabase
      .from('workout_session_sets')
      .select('*')
      .in('workout_session_exercise_id', exerciseIds)
      .order('set_order', { ascending: true });

    if (error) {
      throw error;
    }

    setRows = data || [];
  }

  return (sessionRows || []).map((sessionRow) =>
    normalizeWorkout(
      sessionRow,
      (exerciseRows || []).filter((exercise) => exercise.workout_session_id === sessionRow.id),
      setRows
    )
  );
};

export const saveFullWorkoutSession = async (session: {
  date: string;
  dayId?: string;
  dayName: string;
  startedAt?: string;
  endedAt?: string;
  durationSeconds?: number;
  energyLevel?: string;
  exercises: Array<{
    exerciseId?: string;
    exerciseName: string;
    plannedSets?: string;
    plannedReps?: string;
    plannedWeight?: string;
    completed?: boolean;
    sets: Array<{ weight: string | number; reps: string | number; difficulty?: string }>;
  }>;
}) => {
  const normalizedSession = normalizeWorkoutInput(session);

  if (!normalizedSession.date || !normalizedSession.dayName) {
    throw new Error('חסרים פרטי אימון לשמירה.');
  }

  if (normalizedSession.exercises.length === 0) {
    throw new Error('אין תרגילים תקינים לשמירה.');
  }

  const activeProgram = await fetchActiveProgramRecord();
  const status = normalizedSession.exercises.every((exercise) => exercise.completed)
    ? 'completed'
    : 'partial';

  const payload = {
    p_session_date: normalizedSession.date,
    p_day_id: normalizedSession.dayId || null,
    p_day_name: normalizedSession.dayName,
    p_program_id: activeProgram?.id || null,
    p_status: status,
    p_started_at: normalizedSession.startedAt || null,
    p_ended_at: normalizedSession.endedAt || null,
    p_duration_seconds: normalizedSession.durationSeconds > 0 ? normalizedSession.durationSeconds : null,
    p_energy_level: normalizedSession.energyLevel || null,
    p_exercises: normalizedSession.exercises,
  };

  const { error } = await webSupabase.rpc('create_workout_session', payload);

  if (error && isStableIdSchemaMismatch(error)) {
    const legacyPayload = {
      p_session_date: normalizedSession.date,
      p_day_name: normalizedSession.dayName,
      p_program_id: activeProgram?.id || null,
      p_status: status,
      p_started_at: normalizedSession.startedAt || null,
      p_ended_at: normalizedSession.endedAt || null,
      p_duration_seconds:
        normalizedSession.durationSeconds > 0 ? normalizedSession.durationSeconds : null,
      p_energy_level: normalizedSession.energyLevel || null,
      p_exercises: buildLegacyExercisesPayload(normalizedSession.exercises),
    };

    const { error: legacyError } = await webSupabase.rpc('create_workout_session', legacyPayload);
    if (legacyError) {
      throw legacyError;
    }
  } else if (error) {
    throw error;
  }

  return normalizedSession;
};
