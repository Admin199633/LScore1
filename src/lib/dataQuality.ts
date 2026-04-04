import { diffDaysFromCurrentDate, type DataConfidence } from '@/lib/dataReliability';
import type { SavedNutritionLog } from '@/lib/repositories/nutritionLogRepository';
import type { SavedWorkoutSession } from '@/lib/repositories/workoutSessionRepository';

export type DataValidityStatus = 'valid' | 'partial' | 'invalid';
export type DataQualityLevel = 'high' | 'medium' | 'low';
export type ConfidenceImpact = 'none' | 'reduce' | 'block';

export type DataQualityAssessment = {
  status: DataValidityStatus;
  quality: DataQualityLevel;
  confidenceImpact: ConfidenceImpact;
  reason: string;
  counts?: Record<string, number>;
};

const normalizeDifficulty = (value: string | null | undefined) => {
  const normalized = String(value || '').trim().toLowerCase();

  switch (normalized) {
    case 'easy':
    case 'קל':
    case 'good':
    case 'סבבה':
    case 'hard':
    case 'קשה':
    case 'failure':
    case 'כשל':
      return normalized;
    default:
      return null;
  }
};

const parsePositiveNumber = (value: number | string | null | undefined) => {
  const numericValue = typeof value === 'string' ? Number(value.replace(',', '.')) : Number(value);
  return Number.isFinite(numericValue) && numericValue > 0 ? numericValue : null;
};

export const isSetValidForPerformance = (set: {
  weight?: number | string | null;
  reps?: number | string | null;
  difficulty?: string | null;
}) => Boolean(parsePositiveNumber(set?.weight) && parsePositiveNumber(set?.reps) && normalizeDifficulty(set?.difficulty));

export const isWorkoutValidForAnalysis = (workout: SavedWorkoutSession | null | undefined) => {
  if (!workout || !Array.isArray(workout.exercises)) {
    return false;
  }

  return workout.exercises.some((exercise) => Array.isArray(exercise?.sets) && exercise.sets.some(isSetValidForPerformance));
};

export const assessWeightDataQuality = (
  bodyweightLogs: Array<{ date: string; weight: number }>,
  currentDate?: string | Date
): DataQualityAssessment => {
  const validLogs = [...(bodyweightLogs || [])]
    .filter((item) => parsePositiveNumber(item?.weight) && String(item?.date || '').trim())
    .sort((left, right) => left.date.localeCompare(right.date));
  const latestDate = validLogs.length ? validLogs[validLogs.length - 1].date : null;
  const daysSinceLatest = diffDaysFromCurrentDate(latestDate, currentDate);

  if (validLogs.length < 2) {
    return {
      status: 'invalid',
      quality: 'low',
      confidenceImpact: 'block',
      reason: 'אין מספיק מדידות משקל כדי להסיק מגמה אמינה.',
      counts: { validMeasurements: validLogs.length },
    };
  }

  if (validLogs.length < 4 || (daysSinceLatest !== null && daysSinceLatest > 7)) {
    return {
      status: 'partial',
      quality: 'medium',
      confidenceImpact: 'reduce',
      reason: 'מגמת המשקל מבוססת על מעט מדידות או על מדידה לא עדכנית.',
      counts: { validMeasurements: validLogs.length },
    };
  }

  return {
    status: 'valid',
    quality: 'high',
    confidenceImpact: 'none',
    reason: 'יש מספיק מדידות משקל רציפות כדי להסיק מגמה סבירה.',
    counts: { validMeasurements: validLogs.length },
  };
};

export const assessWorkoutDataQuality = (workoutHistory: SavedWorkoutSession[]): DataQualityAssessment => {
  const validWorkouts = (workoutHistory || []).filter(isWorkoutValidForAnalysis);
  const exerciseOccurrences = new Map<string, number>();
  let validSetsCount = 0;

  validWorkouts.forEach((workout) => {
    workout.exercises.forEach((exercise) => {
      const validSets = (exercise.sets || []).filter(isSetValidForPerformance);

      if (validSets.length > 0) {
        validSetsCount += validSets.length;
        const exerciseName = String(exercise.exerciseName || '').trim();
        if (exerciseName) {
          exerciseOccurrences.set(exerciseName, (exerciseOccurrences.get(exerciseName) || 0) + 1);
        }
      }
    });
  });

  const comparableExercises = Array.from(exerciseOccurrences.values()).filter((count) => count >= 2).length;

  if (validWorkouts.length < 2 || comparableExercises === 0) {
    return {
      status: 'invalid',
      quality: 'low',
      confidenceImpact: 'block',
      reason: 'אין מספיק אימונים או תרגילים ברי־השוואה כדי לנתח ביצועים בצורה אמינה.',
      counts: {
        validWorkouts: validWorkouts.length,
        comparableExercises,
        validSets: validSetsCount,
      },
    };
  }

  if (validWorkouts.length < 3 || comparableExercises < 2 || validSetsCount < 8) {
    return {
      status: 'partial',
      quality: 'medium',
      confidenceImpact: 'reduce',
      reason: 'ניתוח הביצועים מבוסס על מעט אימונים, מעט תרגילים דומים או מעט סטים תקפים.',
      counts: {
        validWorkouts: validWorkouts.length,
        comparableExercises,
        validSets: validSetsCount,
      },
    };
  }

  return {
    status: 'valid',
    quality: 'high',
    confidenceImpact: 'none',
    reason: 'יש מספיק אימונים, סטים ותרגילים ברי־השוואה לניתוח ביצועים.',
    counts: {
      validWorkouts: validWorkouts.length,
      comparableExercises,
      validSets: validSetsCount,
    },
  };
};

export const assessNutritionDataQuality = (
  nutritionLogs: SavedNutritionLog[],
  currentDate?: string | Date
): DataQualityAssessment => {
  const validLogs = [...(nutritionLogs || [])]
    .filter((log) => String(log?.date || '').trim())
    .sort((left, right) => left.date.localeCompare(right.date));
  const latestDate = validLogs.length ? validLogs[validLogs.length - 1].date : null;
  const daysSinceLatest = diffDaysFromCurrentDate(latestDate, currentDate);

  if (validLogs.length < 2) {
    return {
      status: 'invalid',
      quality: 'low',
      confidenceImpact: 'block',
      reason: 'אין מספיק ימי תזונה מדווחים כדי להסיק עמידה ביעדים.',
      counts: { trackedDays: validLogs.length },
    };
  }

  if (validLogs.length < 5 || (daysSinceLatest !== null && daysSinceLatest > 2)) {
    return {
      status: 'partial',
      quality: 'medium',
      confidenceImpact: 'reduce',
      reason: 'עמידה בתזונה מבוססת על מעט ימים או על דיווח לא עדכני.',
      counts: { trackedDays: validLogs.length },
    };
  }

  return {
    status: 'valid',
    quality: 'high',
    confidenceImpact: 'none',
    reason: 'יש מספיק ימי תזונה עדכניים כדי להעריך עמידה ביעדים.',
    counts: { trackedDays: validLogs.length },
  };
};

export const mapQualityToConfidence = (
  assessment: DataQualityAssessment,
  fallback: DataConfidence = 'medium'
): DataConfidence => {
  if (assessment.status === 'invalid') {
    return 'low';
  }

  if (assessment.quality === 'high') {
    return 'high';
  }

  if (assessment.quality === 'medium') {
    return 'medium';
  }

  return fallback;
};
