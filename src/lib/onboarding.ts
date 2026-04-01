import { fetchLatestBodyweight, upsertBodyweightLog } from '@/lib/repositories/bodyweightRepository';
import {
  ensureProfile,
  fetchCurrentProfile,
  saveCurrentProfile,
} from '@/lib/repositories/profileRepository';
import {
  fetchActiveWorkoutProgram,
  type WorkoutProgram,
  type WorkoutProgramDay,
} from '@/lib/repositories/programRepository';
import { webSupabase } from '@/lib/supabase/browser';

export const isOnboardingComplete = ({
  user,
  program,
}: {
  user: {
    age?: number;
    height?: number;
    experience?: string;
    goal?: string;
  } | null;
  program: { days?: WorkoutProgramDay[] } | null;
}) =>
  Boolean(
    user?.age &&
      user?.height &&
      user?.experience &&
      user?.goal &&
      Array.isArray(program?.days) &&
      program.days.length > 0
  );

export const loadOnboardingData = async () => {
  await ensureProfile();
  const latestBodyweight = await fetchLatestBodyweight();
  const [user, program] = await Promise.all([
    fetchCurrentProfile(latestBodyweight?.weight || 0),
    fetchActiveWorkoutProgram(),
  ]);

  return {
    user,
    program,
  };
};

export const saveOnboardingData = async ({
  user,
  program,
}: {
  user: {
    age: number;
    weight: number;
    height: number;
    experience: string;
    goal: string;
    focusAreas: string[];
    gender?: string;
  };
  program: { days: WorkoutProgramDay[] };
}) => {
  await ensureProfile();
  await saveCurrentProfile(user, user.weight);

  const normalizedProgram = {
    days: Array.isArray(program?.days)
      ? program.days.map((day) => ({
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
  };

  const { error } = await webSupabase.rpc('replace_active_workout_program', {
    p_name: 'התוכנית שלי',
    p_days: normalizedProgram.days,
  });

  if (error) {
    throw error;
  }

  if (user.weight) {
    await upsertBodyweightLog({
      date: new Date().toISOString().slice(0, 10),
      weight: Number(user.weight),
    });
  }

  const savedProgram: WorkoutProgram = await fetchActiveWorkoutProgram();
  return { user, program: savedProgram };
};
