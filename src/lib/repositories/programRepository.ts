import { webSupabase } from '@/lib/supabase/browser';

type ProgramRow = {
  id: string;
  exercise: string;
  sets: string;
  repsHeavy: string;
  weightHeavy: string;
};

export type WorkoutProgramDay = {
  id: string;
  name: string;
  rows: ProgramRow[];
};

export type WorkoutProgram = {
  id: string;
  days: WorkoutProgramDay[];
};

const normalizeProgramInput = (programInput: { days?: WorkoutProgramDay[] }) => ({
  days: Array.isArray(programInput.days)
    ? programInput.days.map((day) => ({
        name: String(day?.name || '').trim(),
        rows: Array.isArray(day?.rows)
          ? day.rows
              .map((row) => ({
                exercise: String(row?.exercise || '').trim(),
                sets: String(row?.sets || '').trim(),
                repsHeavy: String(row?.repsHeavy || '').trim(),
                weightHeavy: String(row?.weightHeavy || '').trim(),
              }))
              .filter((row) => row.exercise || row.sets || row.repsHeavy || row.weightHeavy)
          : [],
      }))
    : [],
});

const requireCurrentUserId = async () => {
  const {
    data: { user },
    error,
  } = await webSupabase.auth.getUser();

  if (error) {
    throw error;
  }

  if (!user?.id) {
    throw new Error('המשתמש לא מחובר.');
  }

  return user.id;
};

export const fetchActiveProgramRecord = async () => {
  const userId = await requireCurrentUserId();
  const { data, error } = await webSupabase
    .from('workout_programs')
    .select('*')
    .eq('user_id', userId)
    .eq('is_active', true)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
};

export const fetchActiveWorkoutProgram = async (): Promise<WorkoutProgram> => {
  const activeProgram = await fetchActiveProgramRecord();
  if (!activeProgram) {
    return { id: '', days: [] };
  }

  const { data: dayRows, error: daysError } = await webSupabase
    .from('workout_program_days')
    .select('*')
    .eq('program_id', activeProgram.id)
    .order('day_order', { ascending: true });

  if (daysError) {
    throw daysError;
  }

  const dayIds = (dayRows || []).map((day) => day.id);
  let exerciseRows: Array<{
    id: string;
    day_id: string;
    exercise_name: string;
    sets_planned: string;
    reps_heavy: string;
    weight_heavy: string;
    exercise_order: number;
  }> = [];

  if (dayIds.length > 0) {
    const { data, error } = await webSupabase
      .from('workout_program_exercises')
      .select('*')
      .in('day_id', dayIds)
      .order('exercise_order', { ascending: true });

    if (error) {
      throw error;
    }

    exerciseRows = data || [];
  }

  return {
    id: activeProgram.id,
    days: (dayRows || []).map((dayRow) => ({
      id: dayRow.id || '',
      name: dayRow.name || '',
      rows: exerciseRows
        .filter((exercise) => exercise.day_id === dayRow.id)
        .sort((left, right) => left.exercise_order - right.exercise_order)
        .map((exercise) => ({
          id: exercise.id || '',
          exercise: exercise.exercise_name || '',
          sets: exercise.sets_planned || '',
          repsHeavy: exercise.reps_heavy || '',
          weightHeavy: exercise.weight_heavy || '',
        })),
    })),
  };
};

export const saveActiveWorkoutProgram = async (programInput: { days?: WorkoutProgramDay[] }) => {
  await requireCurrentUserId();
  const normalizedProgram = normalizeProgramInput(programInput);

  const { error } = await webSupabase.rpc('replace_active_workout_program', {
    p_name: 'התוכנית שלי',
    p_days: normalizedProgram.days,
  });

  if (error) {
    throw error;
  }

  return fetchActiveWorkoutProgram();
};
