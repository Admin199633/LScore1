import type { SavedWorkoutSession } from '@/lib/repositories/workoutSessionRepository';

export type ExerciseProgressTrend = 'up' | 'stable' | 'down' | 'insufficient_data';
export type ExerciseProgressConfidence = 'low' | 'medium' | 'high';

export type ExerciseSetInput = {
  weight?: number | string | null;
  reps?: number | string | null;
  difficulty?: string | null;
};

export type ExerciseProgressBestSet = {
  weight: number;
  reps: number;
  difficulty: string;
  difficultyMultiplier: number;
  adjustedScore: number;
  date: string;
  startedAt: string;
};

export type ExerciseExerciseOccurrence = {
  date: string;
  startedAt: string;
  exerciseName: string;
  bestSet: ExerciseProgressBestSet;
};

export type ExerciseProgressResult = {
  trend: ExerciseProgressTrend;
  label: 'שיפור' | '➖ יציב' | 'ירידה' | 'אין מספיק נתונים';
  reason: string;
  confidence: ExerciseProgressConfidence;
  previousBestSet: ExerciseProgressBestSet | null;
  currentBestSet: ExerciseProgressBestSet | null;
  deltaPercentage: number | null;
};

const UP_THRESHOLD = 2;
const DOWN_THRESHOLD = -2;

const normalizeText = (value: string | null | undefined) => String(value || '').trim().toLowerCase();

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
      return 'good';
  }
};

const parsePositiveNumber = (value: number | string | null | undefined) => {
  const numericValue = typeof value === 'string' ? Number(value.replace(',', '.')) : Number(value);
  return Number.isFinite(numericValue) && numericValue > 0 ? numericValue : null;
};

export const mapDifficultyToMultiplier = (difficulty: string | null | undefined): number => {
  switch (normalizeDifficulty(difficulty)) {
    case 'easy':
      return 0.9;
    case 'hard':
      return 1.05;
    case 'failure':
      return 1.1;
    case 'good':
    default:
      return 1;
  }
};

export const calculateAdjustedSetScore = (set: ExerciseSetInput): number | null => {
  const weight = parsePositiveNumber(set.weight);
  const reps = parsePositiveNumber(set.reps);

  if (!weight || !reps) {
    return null;
  }

  const difficultyMultiplier = mapDifficultyToMultiplier(set.difficulty);
  return weight * (1 + reps / 30) * difficultyMultiplier;
};

export const getBestSetForExerciseInSession = (
  exerciseName: string,
  session: SavedWorkoutSession
): ExerciseProgressBestSet | null => {
  const normalizedExerciseName = normalizeText(exerciseName);

  if (!normalizedExerciseName || !session || !Array.isArray(session.exercises)) {
    return null;
  }

  const matchingExercises = session.exercises.filter(
    (exercise) => normalizeText(exercise?.exerciseName) === normalizedExerciseName
  );

  if (matchingExercises.length === 0) {
    return null;
  }

  let bestSet: ExerciseProgressBestSet | null = null;

  for (const exercise of matchingExercises) {
    for (const set of exercise.sets || []) {
      const weight = parsePositiveNumber(set?.weight);
      const reps = parsePositiveNumber(set?.reps);
      const adjustedScore = calculateAdjustedSetScore(set);

      if (!weight || !reps || adjustedScore === null) {
        continue;
      }

      const difficulty = normalizeDifficulty(set?.difficulty);
      const nextBestSet: ExerciseProgressBestSet = {
        weight,
        reps,
        difficulty,
        difficultyMultiplier: mapDifficultyToMultiplier(difficulty),
        adjustedScore,
        date: session.date || '',
        startedAt: session.startedAt || '',
      };

      if (!bestSet || nextBestSet.adjustedScore > bestSet.adjustedScore) {
        bestSet = nextBestSet;
      }
    }
  }

  return bestSet;
};

export const getExerciseOccurrencesFromWorkoutHistory = (
  exerciseName: string,
  workoutHistory: SavedWorkoutSession[]
): ExerciseExerciseOccurrence[] => {
  if (!exerciseName || !Array.isArray(workoutHistory)) {
    return [];
  }

  return workoutHistory
    .map((session) => {
      const bestSet = getBestSetForExerciseInSession(exerciseName, session);

      if (!bestSet) {
        return null;
      }

      return {
        date: session.date || '',
        startedAt: session.startedAt || '',
        exerciseName: exerciseName.trim(),
        bestSet,
      };
    })
    .filter((occurrence): occurrence is ExerciseExerciseOccurrence => Boolean(occurrence))
    .sort((left, right) => {
      const leftKey = `${left.date}T${left.startedAt || '00:00:00'}`;
      const rightKey = `${right.date}T${right.startedAt || '00:00:00'}`;
      return leftKey.localeCompare(rightKey);
    });
};

const getConfidence = (relevantSessionCount: number): ExerciseProgressConfidence => {
  if (relevantSessionCount >= 5) {
    return 'high';
  }

  if (relevantSessionCount >= 3) {
    return 'medium';
  }

  return 'low';
};

const roundDeltaPercentage = (value: number) => Math.round(value * 100) / 100;

export const calculateExerciseProgress = (
  exerciseName: string,
  workoutHistory: SavedWorkoutSession[]
): ExerciseProgressResult => {
  const occurrences = getExerciseOccurrencesFromWorkoutHistory(exerciseName, workoutHistory);
  const confidence = getConfidence(occurrences.length);

  if (occurrences.length < 2) {
    const currentBestSet = occurrences.length === 1 ? occurrences[0].bestSet : null;

    return {
      trend: 'insufficient_data',
      label: 'אין מספיק נתונים',
      reason: 'אין מספיק נתונים להשוואה',
      confidence,
      previousBestSet: null,
      currentBestSet,
      deltaPercentage: null,
    };
  }

  const previousBestSet = occurrences[occurrences.length - 2].bestSet;
  const currentBestSet = occurrences[occurrences.length - 1].bestSet;

  if (!previousBestSet.adjustedScore || !currentBestSet.adjustedScore) {
    return {
      trend: 'insufficient_data',
      label: 'אין מספיק נתונים',
      reason: 'אין מספיק נתונים להשוואה',
      confidence,
      previousBestSet,
      currentBestSet,
      deltaPercentage: null,
    };
  }

  const deltaPercentage = roundDeltaPercentage(
    ((currentBestSet.adjustedScore - previousBestSet.adjustedScore) / previousBestSet.adjustedScore) * 100
  );

  if (deltaPercentage > UP_THRESHOLD) {
    return {
      trend: 'up',
      label: 'שיפור',
      reason: 'עלייה בביצוע לעומת האימון הקודם',
      confidence,
      previousBestSet,
      currentBestSet,
      deltaPercentage,
    };
  }

  if (deltaPercentage < DOWN_THRESHOLD) {
    return {
      trend: 'down',
      label: 'ירידה',
      reason: 'ירידה בביצוע לעומת האימון הקודם',
      confidence,
      previousBestSet,
      currentBestSet,
      deltaPercentage,
    };
  }

  return {
    trend: 'stable',
    label: '➖ יציב',
    reason: 'ללא שינוי מהותי לעומת האימון הקודם',
    confidence,
    previousBestSet,
    currentBestSet,
    deltaPercentage,
  };
};
