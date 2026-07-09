import type { SavedWorkoutSession } from '@/lib/repositories/workoutSessionRepository';

// Builds per-exercise history, personal records and saved notes from the
// user's full workout history. Pure/data-only — the UI (ExerciseHistoryModal)
// handles formatting. Matches exercises by normalized name so the Hebrew and
// English variants used across the app all resolve to the same history.

export type ExerciseHistorySet = {
  weight: number;
  reps: number;
};

export type ExerciseHistoryWorkout = {
  date: string;
  startedAt: string;
  sets: ExerciseHistorySet[];
  totalVolume: number;
};

export type ExerciseHistoryNote = {
  date: string;
  note: string;
};

export type ExercisePersonalRecords = {
  heaviestWeight: { weight: number; reps: number; date: string } | null;
  bestSingleSet: { weight: number; reps: number; volume: number; date: string } | null;
  highestVolume: { volume: number; date: string } | null;
};

export type ExerciseHistory = {
  exerciseName: string;
  totalWorkouts: number;
  firstWorkoutDate: string | null;
  lastWorkoutDate: string | null;
  workouts: ExerciseHistoryWorkout[]; // newest first
  notes: ExerciseHistoryNote[]; // newest first
  personalRecords: ExercisePersonalRecords;
  hasData: boolean;
};

const normalizeName = (value: string | null | undefined) => String(value || '').trim().toLowerCase();

const parsePositiveNumber = (value: number | string | null | undefined): number => {
  const numericValue = typeof value === 'string' ? Number(value.replace(',', '.')) : Number(value);
  return Number.isFinite(numericValue) && numericValue > 0 ? numericValue : 0;
};

// Newest first, using date + start time as a stable ordering key.
const byNewestFirst = (leftDate: string, leftStartedAt: string, rightDate: string, rightStartedAt: string) => {
  const leftKey = `${leftDate}T${leftStartedAt || '00:00:00'}`;
  const rightKey = `${rightDate}T${rightStartedAt || '00:00:00'}`;
  return rightKey.localeCompare(leftKey);
};

export const buildExerciseHistory = (
  exerciseName: string,
  workoutHistory: SavedWorkoutSession[]
): ExerciseHistory => {
  const normalizedTarget = normalizeName(exerciseName);

  const empty: ExerciseHistory = {
    exerciseName,
    totalWorkouts: 0,
    firstWorkoutDate: null,
    lastWorkoutDate: null,
    workouts: [],
    notes: [],
    personalRecords: { heaviestWeight: null, bestSingleSet: null, highestVolume: null },
    hasData: false,
  };

  if (!normalizedTarget || !Array.isArray(workoutHistory)) {
    return empty;
  }

  const workouts: ExerciseHistoryWorkout[] = [];
  const notes: ExerciseHistoryNote[] = [];
  const records: ExercisePersonalRecords = {
    heaviestWeight: null,
    bestSingleSet: null,
    highestVolume: null,
  };

  for (const session of workoutHistory) {
    if (!session || !Array.isArray(session.exercises)) {
      continue;
    }

    const matchingExercises = session.exercises.filter(
      (exercise) => normalizeName(exercise?.exerciseName) === normalizedTarget
    );

    if (matchingExercises.length === 0) {
      continue;
    }

    const date = session.date || '';
    const startedAt = session.startedAt || '';

    // Collect saved notes for this exercise on this date (non-empty only).
    for (const exercise of matchingExercises) {
      const note = String(exercise?.notes || '').trim();
      if (note) {
        notes.push({ date, note });
      }
    }

    // Collect valid performed sets across all matching exercise rows.
    const performedSets: ExerciseHistorySet[] = [];
    for (const exercise of matchingExercises) {
      for (const set of exercise.sets || []) {
        const weight = parsePositiveNumber(set?.weight);
        const reps = parsePositiveNumber(set?.reps);
        if (weight <= 0 || reps <= 0) {
          continue;
        }

        performedSets.push({ weight, reps });

        const volume = weight * reps;

        if (!records.heaviestWeight || weight > records.heaviestWeight.weight) {
          records.heaviestWeight = { weight, reps, date };
        }
        if (!records.bestSingleSet || volume > records.bestSingleSet.volume) {
          records.bestSingleSet = { weight, reps, volume, date };
        }
      }
    }

    if (performedSets.length === 0) {
      continue;
    }

    const totalVolume = performedSets.reduce((sum, set) => sum + set.weight * set.reps, 0);
    workouts.push({ date, startedAt, sets: performedSets, totalVolume });

    if (!records.highestVolume || totalVolume > records.highestVolume.volume) {
      records.highestVolume = { volume: totalVolume, date };
    }
  }

  if (workouts.length === 0) {
    // There may still be notes even if no valid sets were logged; surface them.
    notes.sort((left, right) => byNewestFirst(left.date, '', right.date, ''));
    return { ...empty, notes, hasData: notes.length > 0 };
  }

  workouts.sort((left, right) => byNewestFirst(left.date, left.startedAt, right.date, right.startedAt));
  notes.sort((left, right) => byNewestFirst(left.date, '', right.date, ''));

  const workoutDates = workouts.map((workout) => workout.date).filter(Boolean).sort();

  return {
    exerciseName,
    totalWorkouts: workouts.length,
    firstWorkoutDate: workoutDates[0] || null,
    lastWorkoutDate: workoutDates[workoutDates.length - 1] || null,
    workouts,
    notes,
    personalRecords: records,
    hasData: true,
  };
};
