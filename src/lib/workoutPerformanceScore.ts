import { calculateAdjustedSetScore } from '@/lib/exerciseProgress';
import type { SavedWorkoutSession } from '@/lib/repositories/workoutSessionRepository';
import type { DataConfidence, DataStatus } from '@/lib/dataReliability';

export type WorkoutPerformanceBestSet = {
  weight: number;
  reps: number;
  difficulty: string;
  adjustedScore: number;
};

export type WorkoutPerformanceScoreResult = {
  score: number | null;
  label: string;
  bestExerciseName: string | null;
  bestSet: WorkoutPerformanceBestSet | null;
  completedExercisesCount: number;
  validSetsCount: number;
  dataStatus: DataStatus;
  confidence: DataConfidence;
  reason: string;
};

type ValidWorkoutExerciseEntry = {
  exerciseName: string;
  validSets: WorkoutPerformanceBestSet[];
};

const normalizeText = (value: string | null | undefined) => String(value || '').trim().toLowerCase();

const parsePositiveNumber = (value: number | string | null | undefined) => {
  const numericValue = typeof value === 'string' ? Number(value.replace(',', '.')) : Number(value);
  return Number.isFinite(numericValue) && numericValue > 0 ? numericValue : null;
};

const normalizeDifficulty = (value: string | null | undefined) => {
  const normalized = normalizeText(value);

  switch (normalized) {
    case 'קל':
    case 'easy':
      return 'easy';
    case 'סבבה':
    case 'good':
      return 'good';
    case 'קשה':
    case 'hard':
      return 'hard';
    case 'כשל':
    case 'failure':
      return 'failure';
    default:
      return null;
  }
};

const buildValidSet = (
  set: { weight?: number | string | null; reps?: number | string | null; difficulty?: string | null }
): WorkoutPerformanceBestSet | null => {
  const weight = parsePositiveNumber(set.weight);
  const reps = parsePositiveNumber(set.reps);
  const difficulty = normalizeDifficulty(set.difficulty);

  if (!weight || !reps || !difficulty) {
    return null;
  }

  const adjustedScore = calculateAdjustedSetScore({
    weight,
    reps,
    difficulty,
  });

  if (adjustedScore === null) {
    return null;
  }

  return {
    weight,
    reps,
    difficulty,
    adjustedScore,
  };
};

export const getValidExerciseEntriesFromWorkout = (
  workoutSession: SavedWorkoutSession
): ValidWorkoutExerciseEntry[] => {
  if (!workoutSession || !Array.isArray(workoutSession.exercises)) {
    return [];
  }

  return workoutSession.exercises
    .map((exercise) => {
      const exerciseName = String(exercise?.exerciseName || '').trim();
      const validSets = Array.isArray(exercise?.sets)
        ? exercise.sets
            .map((set) => buildValidSet(set))
            .filter((set): set is WorkoutPerformanceBestSet => Boolean(set))
        : [];

      if (!exerciseName || validSets.length === 0) {
        return null;
      }

      return {
        exerciseName,
        validSets,
      };
    })
    .filter((entry): entry is ValidWorkoutExerciseEntry => Boolean(entry));
};

export const countValidSetsInWorkout = (workoutSession: SavedWorkoutSession) =>
  getValidExerciseEntriesFromWorkout(workoutSession).reduce((sum, exercise) => sum + exercise.validSets.length, 0);

export const getWorkoutBestSet = (
  workoutSession: SavedWorkoutSession
): { exerciseName: string; bestSet: WorkoutPerformanceBestSet } | null => {
  const validExerciseEntries = getValidExerciseEntriesFromWorkout(workoutSession);

  let bestEntry: { exerciseName: string; bestSet: WorkoutPerformanceBestSet } | null = null;

  for (const exerciseEntry of validExerciseEntries) {
    for (const set of exerciseEntry.validSets) {
      if (!bestEntry || set.adjustedScore > bestEntry.bestSet.adjustedScore) {
        bestEntry = {
          exerciseName: exerciseEntry.exerciseName,
          bestSet: set,
        };
      }
    }
  }

  return bestEntry;
};

const getDataQuality = ({
  completedExercisesCount,
  validSetsCount,
}: {
  completedExercisesCount: number;
  validSetsCount: number;
}): { dataStatus: DataStatus; confidence: DataConfidence; reason: string } => {
  if (completedExercisesCount === 0 || validSetsCount === 0) {
    return {
      dataStatus: 'missing',
      confidence: 'low',
      reason: 'אין מספיק נתונים כדי לחשב ציון ביצוע לאימון',
    };
  }

  if (completedExercisesCount >= 2 && validSetsCount >= 3) {
    return {
      dataStatus: 'complete',
      confidence: 'high',
      reason: 'הציון מבוסס על כמה תרגילים וכמה סטים תקפים באימון.',
    };
  }

  return {
    dataStatus: 'partial',
    confidence: completedExercisesCount >= 1 && validSetsCount >= 2 ? 'medium' : 'low',
    reason: 'הציון מבוסס על מעט תרגילים או מעט סטים תקפים, ולכן הוא חלקי.',
  };
};

const roundScore = (value: number) => Math.round(value * 100) / 100;

export const calculateWorkoutPerformanceScore = (
  workoutSession: SavedWorkoutSession
): WorkoutPerformanceScoreResult => {
  const validExerciseEntries = getValidExerciseEntriesFromWorkout(workoutSession);
  const completedExercisesCount = validExerciseEntries.length;
  const validSetsCount = validExerciseEntries.reduce((sum, exercise) => sum + exercise.validSets.length, 0);
  const bestEntry = getWorkoutBestSet(workoutSession);
  const dataQuality = getDataQuality({
    completedExercisesCount,
    validSetsCount,
  });

  if (!bestEntry) {
    return {
      score: null,
      label: 'אין מספיק נתונים',
      bestExerciseName: null,
      bestSet: null,
      completedExercisesCount,
      validSetsCount,
      dataStatus: dataQuality.dataStatus,
      confidence: dataQuality.confidence,
      reason: dataQuality.reason,
    };
  }

  return {
    score: roundScore(bestEntry.bestSet.adjustedScore),
    label: `${roundScore(bestEntry.bestSet.adjustedScore)}`,
    bestExerciseName: bestEntry.exerciseName,
    bestSet: {
      ...bestEntry.bestSet,
      adjustedScore: roundScore(bestEntry.bestSet.adjustedScore),
    },
    completedExercisesCount,
    validSetsCount,
    dataStatus: dataQuality.dataStatus,
    confidence: dataQuality.confidence,
    reason:
      dataQuality.dataStatus === 'complete'
        ? 'הציון מייצג את הסט החזק ביותר מתוך כל התרגילים שבוצעו באימון.'
        : dataQuality.reason,
  };
};
