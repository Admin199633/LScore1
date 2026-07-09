import type { SavedWorkoutSession } from '@/lib/repositories/workoutSessionRepository';
import {
  getMuscleGroupForExercise,
  MUSCLE_GROUP_LABELS,
  MUSCLE_GROUP_ORDER,
  type MuscleGroup,
} from '@/lib/muscleGroups';

// Summarizes recent training volume per muscle group. Intensity is normalized
// against the most-trained group so the heatmap bars are always relative to the
// user's own recent activity.

export type MuscleHeatmapEntry = {
  group: MuscleGroup;
  label: string;
  volume: number;
  intensity: number; // 0..1, relative to the highest-volume group
};

export type MuscleHeatmapResult = {
  entries: MuscleHeatmapEntry[];
  hasData: boolean;
  windowDays: number;
};

const parsePositiveNumber = (value: number | string | null | undefined): number => {
  const numericValue = typeof value === 'string' ? Number(value.replace(',', '.')) : Number(value);
  return Number.isFinite(numericValue) && numericValue > 0 ? numericValue : 0;
};

const toDateKey = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const calculateMuscleHeatmap = (
  workoutHistory: SavedWorkoutSession[],
  options: { windowDays?: number; referenceDate?: Date } = {}
): MuscleHeatmapResult => {
  const windowDays = options.windowDays ?? 30;
  const referenceDate = options.referenceDate ?? new Date();

  const cutoff = new Date(referenceDate);
  cutoff.setDate(cutoff.getDate() - (windowDays - 1));
  const cutoffKey = toDateKey(cutoff);

  const volumeByGroup = MUSCLE_GROUP_ORDER.reduce<Record<MuscleGroup, number>>((accumulator, group) => {
    accumulator[group] = 0;
    return accumulator;
  }, {} as Record<MuscleGroup, number>);

  if (Array.isArray(workoutHistory)) {
    for (const session of workoutHistory) {
      const sessionDate = session?.date || '';
      // Session dates are YYYY-MM-DD so lexicographic compare is chronological.
      if (!sessionDate || sessionDate < cutoffKey) {
        continue;
      }

      for (const exercise of session.exercises || []) {
        const group = getMuscleGroupForExercise(exercise?.exerciseName || '');
        if (!group) {
          continue;
        }

        let exerciseVolume = 0;
        for (const set of exercise.sets || []) {
          const weight = parsePositiveNumber(set?.weight);
          const reps = parsePositiveNumber(set?.reps);
          if (weight > 0 && reps > 0) {
            exerciseVolume += weight * reps;
          }
        }

        volumeByGroup[group] += exerciseVolume;
      }
    }
  }

  const maxVolume = Math.max(0, ...MUSCLE_GROUP_ORDER.map((group) => volumeByGroup[group]));

  const entries: MuscleHeatmapEntry[] = MUSCLE_GROUP_ORDER.map((group) => ({
    group,
    label: MUSCLE_GROUP_LABELS[group],
    volume: Math.round(volumeByGroup[group]),
    intensity: maxVolume > 0 ? volumeByGroup[group] / maxVolume : 0,
  }));

  return {
    entries,
    hasData: maxVolume > 0,
    windowDays,
  };
};
