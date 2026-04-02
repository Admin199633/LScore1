import { calculateExerciseProgress, type ExerciseProgressTrend } from '@/lib/exerciseProgress';
import { diffDaysFromCurrentDate, getLatestDate, type DataReliability } from '@/lib/dataReliability';
import type { SavedNutritionLog } from '@/lib/repositories/nutritionLogRepository';
import type { SavedWorkoutSession } from '@/lib/repositories/workoutSessionRepository';
import type { WorkoutConsistencyResult } from '@/lib/workoutConsistency';
import { calculateBodyweightTrend } from '@shared-engines/index';

export type GoalType = 'bulk' | 'cut' | 'maintain' | '';
export type ExerciseProgressSummaryTrend = 'up' | 'stable' | 'down' | 'insufficient_data';
export type WeightTrendSummary = 'up' | 'stable' | 'down' | 'insufficient_data';
export type NutritionAdherenceSummary = 'good' | 'partial' | 'poor' | 'insufficient_data';
export type WorkoutConsistencySummary = 'high' | 'medium' | 'low' | 'insufficient_data';
export type ProgressStatus = 'on_track' | 'partial' | 'off_track' | 'insufficient_data';
export type ProgressStatusConfidence = 'low' | 'medium' | 'high';

export type ExerciseProgressSummary = {
  trend: ExerciseProgressSummaryTrend;
  upCount: number;
  stableCount: number;
  downCount: number;
  validExercisesCount: number;
} & DataReliability;

export type WeightTrendSummaryResult = {
  trend: WeightTrendSummary;
} & DataReliability;

export type NutritionAdherenceSummaryResult = {
  result: NutritionAdherenceSummary;
} & DataReliability;

export type ProgressStatusResult = {
  status: ProgressStatus;
  label: 'בכיוון' | 'חלקית' | 'לא בכיוון' | 'אין מספיק נתונים';
  reason: string;
  confidence: ProgressStatusConfidence;
  breakdown: {
    exercise: ExerciseProgressSummary;
    weight: WeightTrendSummary;
    nutrition: NutritionAdherenceSummary;
    consistency: WorkoutConsistencySummary;
  };
  summaries: {
    exerciseProgress: ExerciseProgressSummary;
    weightTrend: WeightTrendSummaryResult;
    nutritionAdherence: NutritionAdherenceSummaryResult;
    workoutConsistency: WorkoutConsistencySummary;
    workoutConsistencyReliability: DataReliability;
  };
};

type ReliabilityLike = Pick<DataReliability, 'dataStatus' | 'freshness' | 'confidence'>;

type ProfileForProgress = {
  age: number;
  height: number;
  gender: string;
  goal: string;
};

const getLatestBodyweight = (bodyweightLogs: Array<{ date: string; weight: number }>) =>
  bodyweightLogs.length ? bodyweightLogs[bodyweightLogs.length - 1].weight : 0;

const getDailyCalorieTarget = (
  profile: ProfileForProgress | null,
  bodyweightLogs: Array<{ date: string; weight: number }>
) => {
  if (!profile) return null;

  const latestWeight = getLatestBodyweight(bodyweightLogs);
  if (!latestWeight || !profile.height || !profile.age) return null;

  const base = 10 * latestWeight + 6.25 * profile.height - 5 * profile.age;
  const bmr = profile.gender === 'female' ? base - 161 : base + 5;
  const tdee = bmr * 1.375;

  if (profile.goal === 'cut') return Math.round(tdee - 400);
  if (profile.goal === 'bulk') return Math.round(tdee + 300);
  return Math.round(tdee);
};

const getDailyProteinTarget = (
  profile: ProfileForProgress | null,
  bodyweightLogs: Array<{ date: string; weight: number }>
) => {
  if (!profile) return null;

  const latestWeight = getLatestBodyweight(bodyweightLogs);
  if (!latestWeight) return null;

  const multiplier = profile.goal === 'cut' ? 2.2 : profile.goal === 'bulk' ? 1.8 : 1.6;
  return Math.round(latestWeight * multiplier);
};

const getNutritionScore = (actual: number | null, target: number | null, mode: 'protein' | 'calories', goal: GoalType) => {
  if (!actual || !target || target <= 0) {
    return null;
  }

  const ratio = actual / target;

  if (mode === 'protein') {
    if (ratio >= 0.9) return 2;
    if (ratio >= 0.75) return 1;
    return 0;
  }

  if (goal === 'bulk') {
    if (ratio >= 0.9 && ratio <= 1.15) return 2;
    if (ratio >= 0.75 && ratio <= 1.25) return 1;
    return 0;
  }

  if (goal === 'cut') {
    if (ratio >= 0.85 && ratio <= 1.1) return 2;
    if (ratio >= 0.7 && ratio <= 1.2) return 1;
    return 0;
  }

  if (ratio >= 0.9 && ratio <= 1.1) return 2;
  if (ratio >= 0.8 && ratio <= 1.2) return 1;
  return 0;
};

export const summarizeExerciseProgress = (
  exerciseNames: string[],
  workoutHistory: SavedWorkoutSession[],
  currentDate?: string | Date
): ExerciseProgressSummary => {
  const uniqueExerciseNames = Array.from(new Set(exerciseNames.map((name) => String(name || '').trim()).filter(Boolean)));
  let upCount = 0;
  let stableCount = 0;
  let downCount = 0;
  const lastRelevantDates: string[] = [];

  uniqueExerciseNames.forEach((exerciseName) => {
    const result = calculateExerciseProgress(exerciseName, workoutHistory);
    const trend = result.trend as ExerciseProgressTrend;

    if (trend === 'up') upCount += 1;
    if (trend === 'stable') stableCount += 1;
    if (trend === 'down') downCount += 1;
    if (result.currentBestSet?.date) {
      lastRelevantDates.push(result.currentBestSet.date);
    }
  });

  const validExercisesCount = upCount + stableCount + downCount;
  const lastUpdatedAt = getLatestDate(lastRelevantDates);
  const daysSinceLastRelevantWorkout = diffDaysFromCurrentDate(lastUpdatedAt, currentDate);

  if (validExercisesCount < 2) {
    return {
      trend: 'insufficient_data',
      upCount,
      stableCount,
      downCount,
      validExercisesCount,
      dataStatus: 'missing',
      freshness: 'stale',
      confidence: 'low',
      lastUpdatedAt,
    };
  }

  const reliability =
    daysSinceLastRelevantWorkout === null
      ? ({ dataStatus: 'missing', freshness: 'stale', confidence: 'low' } satisfies Pick<DataReliability, 'dataStatus' | 'freshness' | 'confidence'>)
      : daysSinceLastRelevantWorkout <= 14
        ? ({
            dataStatus: 'complete',
            freshness: 'fresh',
            confidence: validExercisesCount >= 3 ? 'high' : 'medium',
          } satisfies Pick<DataReliability, 'dataStatus' | 'freshness' | 'confidence'>)
        : daysSinceLastRelevantWorkout <= 21
          ? ({ dataStatus: 'partial', freshness: 'aging', confidence: 'medium' } satisfies Pick<DataReliability, 'dataStatus' | 'freshness' | 'confidence'>)
          : ({ dataStatus: 'stale', freshness: 'stale', confidence: 'low' } satisfies Pick<DataReliability, 'dataStatus' | 'freshness' | 'confidence'>);

  if (downCount > upCount && downCount >= stableCount) {
    return { trend: 'down', upCount, stableCount, downCount, validExercisesCount, ...reliability, lastUpdatedAt };
  }

  if (upCount > downCount && upCount >= stableCount) {
    return { trend: 'up', upCount, stableCount, downCount, validExercisesCount, ...reliability, lastUpdatedAt };
  }

  return { trend: 'stable', upCount, stableCount, downCount, validExercisesCount, ...reliability, lastUpdatedAt };
};

export const summarizeWeightTrend = (
  bodyweightLogs: Array<{ date: string; weight: number }>,
  currentDate?: string | Date
): WeightTrendSummaryResult => {
  const orderedLogs = [...(bodyweightLogs || [])].sort((left, right) => left.date.localeCompare(right.date));
  const lastUpdatedAt = orderedLogs.length ? orderedLogs[orderedLogs.length - 1].date : null;
  const logsInLast14Days = orderedLogs.filter((log) => {
    const diff = diffDaysFromCurrentDate(log.date, currentDate);
    return diff !== null && diff >= 0 && diff <= 14;
  });
  const daysSinceLastLog = diffDaysFromCurrentDate(lastUpdatedAt, currentDate);

  if (!Array.isArray(bodyweightLogs) || bodyweightLogs.length < 2) {
    return {
      trend: 'insufficient_data',
      dataStatus: 'missing',
      freshness: 'stale',
      confidence: 'low',
      lastUpdatedAt,
    };
  }

  if (logsInLast14Days.length >= 4 && daysSinceLastLog !== null && daysSinceLastLog <= 3) {
    return {
      trend: calculateBodyweightTrend(orderedLogs) as WeightTrendSummary,
      dataStatus: 'complete',
      freshness: 'fresh',
      confidence: 'high',
      lastUpdatedAt,
    };
  }

  if (logsInLast14Days.length >= 2 && logsInLast14Days.length <= 3 && daysSinceLastLog !== null && daysSinceLastLog <= 5) {
    return {
      trend: calculateBodyweightTrend(orderedLogs) as WeightTrendSummary,
      dataStatus: 'partial',
      freshness: 'aging',
      confidence: 'medium',
      lastUpdatedAt,
    };
  }

  if (daysSinceLastLog !== null && daysSinceLastLog > 5) {
    return {
      trend: 'insufficient_data',
      dataStatus: 'stale',
      freshness: 'stale',
      confidence: 'low',
      lastUpdatedAt,
    };
  }

  return {
    trend: 'insufficient_data',
    dataStatus: 'missing',
    freshness: 'stale',
    confidence: 'low',
    lastUpdatedAt,
  };
};

export const summarizeNutritionAdherence = ({
  goal,
  nutritionLogs,
  profile,
  bodyweightLogs,
  currentDate,
}: {
  goal: GoalType;
  nutritionLogs: SavedNutritionLog[];
  profile: ProfileForProgress | null;
  bodyweightLogs: Array<{ date: string; weight: number }>;
  currentDate?: string | Date;
}): NutritionAdherenceSummaryResult => {
  const recentLogs = [...(nutritionLogs || [])]
    .sort((left, right) => left.date.localeCompare(right.date))
    .slice(-7);
  const lastUpdatedAt = recentLogs.length ? recentLogs[recentLogs.length - 1].date : null;
  const daysSinceLastLog = diffDaysFromCurrentDate(lastUpdatedAt, currentDate);

  if (recentLogs.length < 3) {
    return {
      result: 'insufficient_data',
      dataStatus: recentLogs.length <= 1 ? 'missing' : 'partial',
      freshness: 'stale',
      confidence: 'low',
      lastUpdatedAt,
    };
  }

  const proteinTarget = getDailyProteinTarget(profile, bodyweightLogs);
  const calorieTarget = getDailyCalorieTarget(profile, bodyweightLogs);

  if (!proteinTarget || !calorieTarget) {
    return {
      result: 'insufficient_data',
      dataStatus: 'missing',
      freshness: 'stale',
      confidence: 'low',
      lastUpdatedAt,
    };
  }

  const scores = recentLogs
    .map((log) => {
      const proteinScore = getNutritionScore(log.totalProteinGrams, proteinTarget, 'protein', goal);
      const caloriesScore = getNutritionScore(log.totalCalories, calorieTarget, 'calories', goal);

      const validScores = [proteinScore, caloriesScore].filter((score): score is number => typeof score === 'number');
      if (validScores.length === 0) {
        return null;
      }

      return validScores.reduce((sum, score) => sum + score, 0) / validScores.length;
    })
    .filter((score): score is number => typeof score === 'number');

  if (scores.length < 3) {
    return {
      result: 'insufficient_data',
      dataStatus: 'partial',
      freshness: daysSinceLastLog !== null && daysSinceLastLog <= 5 ? 'aging' : 'stale',
      confidence: 'low',
      lastUpdatedAt,
    };
  }

  const averageScore = scores.reduce((sum, score) => sum + score, 0) / scores.length;
  const result =
    averageScore >= 1.5 ? 'good' : averageScore >= 0.85 ? 'partial' : 'poor';

  if (recentLogs.length >= 6 && daysSinceLastLog !== null && daysSinceLastLog <= 1) {
    return {
      result,
      dataStatus: 'complete',
      freshness: 'fresh',
      confidence: 'high',
      lastUpdatedAt,
    };
  }

  if (recentLogs.length >= 4 && recentLogs.length <= 5) {
    return {
      result,
      dataStatus: 'partial',
      freshness: 'aging',
      confidence: 'medium',
      lastUpdatedAt,
    };
  }

  if ((recentLogs.length >= 2 && recentLogs.length <= 3) || (daysSinceLastLog !== null && daysSinceLastLog > 1)) {
    return {
      result: recentLogs.length >= 2 ? result : 'insufficient_data',
      dataStatus: recentLogs.length >= 2 ? 'partial' : 'stale',
      freshness: daysSinceLastLog !== null && daysSinceLastLog <= 5 ? 'aging' : 'stale',
      confidence: 'low',
      lastUpdatedAt,
    };
  }

  return {
    result: 'insufficient_data',
    dataStatus: 'missing',
    freshness: 'stale',
    confidence: 'low',
    lastUpdatedAt,
  };
};

export const summarizeWorkoutConsistency = (
  result: WorkoutConsistencyResult
): WorkoutConsistencySummary => {
  if (!result.hasActiveProgram) {
    return 'insufficient_data';
  }

  if (result.confidence === 'low' && result.lastWeek.completed === 0 && result.currentWeek.completed === 0) {
    return 'insufficient_data';
  }

  return result.lastWeek.status;
};

const isAvailable = (status: string) => status !== 'insufficient_data';
const isMissingOrStale = (reliability: ReliabilityLike) =>
  reliability.dataStatus === 'missing' || reliability.dataStatus === 'stale';
const isUsable = (reliability: ReliabilityLike) =>
  reliability.dataStatus === 'complete' || reliability.dataStatus === 'partial';
const isStrongReliability = (reliability: ReliabilityLike) =>
  reliability.confidence === 'high' || reliability.confidence === 'medium';

const getProgressReliabilityConfidence = ({
  exerciseProgressSummary,
  weightTrend,
  nutritionAdherence,
  workoutConsistencyReliability,
}: {
  exerciseProgressSummary: ExerciseProgressSummary;
  weightTrend: WeightTrendSummaryResult;
  nutritionAdherence: NutritionAdherenceSummaryResult;
  workoutConsistencyReliability: ReliabilityLike;
}): ProgressStatusConfidence => {
  const reliabilityItems = [
    exerciseProgressSummary,
    weightTrend,
    nutritionAdherence,
    workoutConsistencyReliability,
  ];

  const completeFreshCount = reliabilityItems.filter(
    (item) => item.dataStatus === 'complete' && item.freshness === 'fresh'
  ).length;
  const usableCount = reliabilityItems.filter(isUsable).length;
  const missingOrStaleCount = reliabilityItems.filter(isMissingOrStale).length;
  const exerciseUsable = isUsable(exerciseProgressSummary);

  if (completeFreshCount >= 3 && exerciseUsable) {
    return 'high';
  }

  if (usableCount >= 2 && missingOrStaleCount <= 1 && (exerciseUsable || isUsable(weightTrend))) {
    return 'medium';
  }

  return 'low';
};

const buildDecision = (
  status: ProgressStatus,
  reason: string,
  confidence: ProgressStatusConfidence
): Omit<ProgressStatusResult, 'summaries' | 'breakdown'> => {
  const label: ProgressStatusResult['label'] =
    status === 'on_track'
      ? 'בכיוון'
      : status === 'partial'
        ? 'חלקית'
        : status === 'off_track'
          ? 'לא בכיוון'
          : 'אין מספיק נתונים';

  return {
    status,
    label,
    reason,
    confidence,
  };
};

export const calculateProgressStatus = ({
  goal,
  exerciseProgressSummary,
  weightTrend,
  nutritionAdherence,
  workoutConsistency,
  workoutConsistencyReliability,
}: {
  goal: GoalType;
  exerciseProgressSummary: ExerciseProgressSummary;
  weightTrend: WeightTrendSummaryResult;
  nutritionAdherence: NutritionAdherenceSummaryResult;
  workoutConsistency: WorkoutConsistencySummary;
  workoutConsistencyReliability: ReliabilityLike;
}): Omit<ProgressStatusResult, 'summaries' | 'breakdown'> => {
  const confidence = getProgressReliabilityConfidence({
    exerciseProgressSummary,
    weightTrend,
    nutritionAdherence,
    workoutConsistencyReliability,
  });
  const effectiveExerciseTrend =
    isMissingOrStale(exerciseProgressSummary) ? 'insufficient_data' : exerciseProgressSummary.trend;
  const effectiveWeightTrend =
    isMissingOrStale(weightTrend) ? 'insufficient_data' : weightTrend.trend;
  const effectiveNutrition =
    isMissingOrStale(nutritionAdherence) ? 'insufficient_data' : nutritionAdherence.result;
  const effectiveConsistency =
    workoutConsistencyReliability.dataStatus === 'missing' || workoutConsistencyReliability.dataStatus === 'partial'
      ? 'insufficient_data'
      : workoutConsistency;
  const missingOrStaleMetrics = [
    isMissingOrStale(exerciseProgressSummary),
    isMissingOrStale(weightTrend),
    isMissingOrStale(nutritionAdherence),
    isMissingOrStale(workoutConsistencyReliability),
  ].filter(Boolean).length;
  const mediumHighMetrics = [
    exerciseProgressSummary,
    weightTrend,
    nutritionAdherence,
    workoutConsistencyReliability,
  ].filter(isStrongReliability).length;
  const hasTooLittleData =
    (isMissingOrStale(exerciseProgressSummary) && missingOrStaleMetrics >= 2) ||
    mediumHighMetrics < 2;

  if (hasTooLittleData) {
    return buildDecision(
      'insufficient_data',
      'אין מספיק נתונים עדכניים כדי לקבוע אם אתה בכיוון.',
      confidence
    );
  }

  if (goal === 'maintain' && effectiveWeightTrend !== 'stable' && effectiveExerciseTrend === 'down') {
    return buildDecision(
      'off_track',
      'המשקל זז מהיעד והביצועים בירידה, ולכן אתה לא בכיוון.',
      confidence
    );
  }

  if (goal === 'bulk') {
    const weightGood = effectiveWeightTrend === 'up';
    const nutritionGood = effectiveNutrition === 'good' || effectiveNutrition === 'partial';
    const consistencyGood = workoutConsistency === 'high' || workoutConsistency === 'medium';
    const onTrackBlocked =
      effectiveExerciseTrend === 'down' ||
      (effectiveWeightTrend === 'down' && effectiveExerciseTrend !== 'up') ||
      (workoutConsistencyReliability.dataStatus === 'complete' &&
        workoutConsistency === 'low' &&
        effectiveNutrition === 'poor');

    if (!onTrackBlocked && effectiveExerciseTrend === 'up' && weightGood && nutritionGood && consistencyGood) {
      return buildDecision(
        'on_track',
        'הביצועים בעלייה והנתונים תומכים בכך שאתה מתקדם לפי המטרה.',
        confidence
      );
    }

    if (effectiveExerciseTrend === 'down') {
      return buildDecision(
        'off_track',
        effectiveWeightTrend === 'up'
          ? 'המשקל עולה, אבל אין שיפור בתרגילים ולכן ההתקדמות לא מספקת.'
          : 'הביצועים בירידה ולכן קשה לומר שאתה מתקדם במסה.',
        confidence
      );
    }

    if (effectiveWeightTrend === 'down' && effectiveExerciseTrend !== 'up') {
      return buildDecision(
        'off_track',
        'מגמת המשקל לא תואמת מסה, וגם הביצועים לא נותנים פיצוי ברור.',
        confidence
      );
    }

    if (
      workoutConsistencyReliability.dataStatus === 'complete' &&
      workoutConsistency === 'low' &&
      effectiveNutrition === 'poor'
    ) {
      return buildDecision(
        effectiveExerciseTrend === 'up' || (effectiveExerciseTrend === 'stable' && weightGood) ? 'partial' : 'off_track',
        'התזונה והעקביות חלשות ולכן קשה להתקדם כרגע.',
        confidence
      );
    }

    if (!isUsable(weightTrend)) {
      return buildDecision(
        'partial',
        'יש שיפור חלקי, אבל מגמת המשקל לא עדכנית ולכן הסטטוס חלקי בלבד.',
        confidence
      );
    }

    if ((effectiveExerciseTrend === 'stable' && weightGood) || (effectiveExerciseTrend === 'up' && (!nutritionGood || !consistencyGood))) {
      return buildDecision(
        'partial',
        effectiveWeightTrend !== 'up'
          ? 'יש שיפור חלקי, אבל מגמת המשקל עדיין לא תואמת את המטרה.'
          : 'יש שיפור חלקי, אבל העקביות או התזונה עדיין לא מספיקות.',
        confidence
      );
    }

    return buildDecision(
      'off_track',
      'הביצועים והמשקל לא מצביעים כרגע על התקדמות טובה במסה.',
      confidence
    );
  }

  if (goal === 'cut') {
    const weightGood = effectiveWeightTrend === 'down';
    const exerciseGood = effectiveExerciseTrend === 'up' || effectiveExerciseTrend === 'stable';
    const nutritionGood = effectiveNutrition === 'good' || effectiveNutrition === 'partial';
    const consistencyGood = workoutConsistency === 'high' || workoutConsistency === 'medium';
    const onTrackBlocked =
      effectiveExerciseTrend === 'down' ||
      (effectiveWeightTrend === 'up' && effectiveNutrition === 'poor') ||
      (workoutConsistencyReliability.dataStatus === 'complete' &&
        workoutConsistency === 'low' &&
        effectiveNutrition === 'poor');

    if (!onTrackBlocked && exerciseGood && weightGood && nutritionGood && consistencyGood) {
      return buildDecision(
        'on_track',
        'המשקל יורד והביצועים נשמרים בהתאם למטרת חיטוב.',
        confidence
      );
    }

    if (effectiveWeightTrend === 'up' && effectiveNutrition === 'poor') {
      return buildDecision(
        'off_track',
        'המשקל עולה והתזונה חלשה, ולכן אתה לא בכיוון לחיטוב.',
        confidence
      );
    }

    if (effectiveExerciseTrend === 'down' && weightGood) {
      return buildDecision(
        'partial',
        'יש ירידה במשקל, אבל הביצועים נחלשים ולכן ההתקדמות חלקית.',
        confidence
      );
    }

    if (
      workoutConsistencyReliability.dataStatus === 'complete' &&
      workoutConsistency === 'low' &&
      effectiveNutrition === 'poor'
    ) {
      return buildDecision(
        exerciseGood && weightGood ? 'partial' : 'off_track',
        'התזונה והעקביות חלשות ולכן קשה להתקדם כרגע.',
        confidence
      );
    }

    if (!isUsable(weightTrend)) {
      return buildDecision(
        'partial',
        'הביצועים סבירים, אבל מגמת המשקל לא עדכנית ולכן הסטטוס חלקי בלבד.',
        confidence
      );
    }

    if (exerciseGood && !weightGood) {
      return buildDecision(
        'partial',
        'הביצועים סבירים, אבל מגמת המשקל עדיין לא תואמת את מטרת החיטוב.',
        confidence
      );
    }

    return buildDecision(
      'off_track',
      'המשקל או התזונה לא תומכים כרגע בהתקדמות טובה בחיטוב.',
      confidence
    );
  }

  const weightGood = effectiveWeightTrend === 'stable';
  const exerciseGood = effectiveExerciseTrend === 'up' || effectiveExerciseTrend === 'stable';
  const nutritionGood = effectiveNutrition === 'good' || effectiveNutrition === 'partial';
  const consistencyGood = workoutConsistency === 'high' || workoutConsistency === 'medium';
  const onTrackBlocked =
    effectiveExerciseTrend === 'down' ||
    (workoutConsistencyReliability.dataStatus === 'complete' &&
      workoutConsistency === 'low' &&
      effectiveNutrition === 'poor');

  if (!onTrackBlocked && exerciseGood && weightGood && nutritionGood && consistencyGood) {
    return buildDecision(
      'on_track',
      'המשקל יציב והביצועים נשמרים בהתאם למטרת שמירה.',
      confidence
    );
  }

  if (effectiveExerciseTrend === 'down' && effectiveWeightTrend !== 'stable') {
    return buildDecision(
      'off_track',
      'המשקל לא יציב וגם הביצועים בירידה, ולכן אתה לא בכיוון.',
      confidence
    );
  }

  if (
    workoutConsistencyReliability.dataStatus === 'complete' &&
    workoutConsistency === 'low' &&
    effectiveNutrition === 'poor'
  ) {
    return buildDecision(
      exerciseGood && weightGood ? 'partial' : 'off_track',
      'התזונה והעקביות חלשות ולכן קשה להתקדם כרגע.',
      confidence
    );
  }

  if (!isUsable(weightTrend)) {
    return buildDecision(
      'partial',
      'מגמת המשקל לא עדכנית ולכן הסטטוס חלקי בלבד.',
      confidence
    );
  }

  if (exerciseGood && !weightGood) {
    return buildDecision(
      'partial',
      'יש יציבות או שיפור בביצועים, אבל מגמת המשקל עדיין לא תואמת את מטרת השמירה.',
      confidence
    );
  }

  if ((exerciseGood && (nutritionGood || consistencyGood)) || (weightGood && exerciseGood)) {
    return buildDecision(
      'partial',
      'יש סימנים חיוביים, אבל אין עדיין התאמה מלאה בין כל המדדים.',
      confidence
    );
  }

  return buildDecision(
    'off_track',
    'המשקל או הביצועים לא תומכים כרגע במטרת השמירה.',
    confidence
  );
};

export const buildProgressStatus = ({
  goal,
  exerciseNames,
  workoutHistory,
  bodyweightLogs,
  nutritionLogs,
  profile,
  workoutConsistency,
  currentDate,
}: {
  goal: GoalType;
  exerciseNames: string[];
  workoutHistory: SavedWorkoutSession[];
  bodyweightLogs: Array<{ date: string; weight: number }>;
  nutritionLogs: SavedNutritionLog[];
  profile: ProfileForProgress | null;
  workoutConsistency: WorkoutConsistencyResult;
  currentDate?: string | Date;
}): ProgressStatusResult => {
  const exerciseProgressSummary = summarizeExerciseProgress(exerciseNames, workoutHistory, currentDate);
  const weightTrend = summarizeWeightTrend(bodyweightLogs, currentDate);
  const nutritionAdherence = summarizeNutritionAdherence({
    goal,
    nutritionLogs,
    profile,
    bodyweightLogs,
    currentDate,
  });
  const workoutConsistencySummary = summarizeWorkoutConsistency(workoutConsistency);
  const decision = calculateProgressStatus({
    goal,
    exerciseProgressSummary,
    weightTrend,
    nutritionAdherence,
    workoutConsistency: workoutConsistencySummary,
    workoutConsistencyReliability: workoutConsistency.reliability,
  });

  return {
    ...decision,
    breakdown: {
      exercise: exerciseProgressSummary,
      weight: weightTrend.trend,
      nutrition: nutritionAdherence.result,
      consistency: workoutConsistencySummary,
    },
    summaries: {
      exerciseProgress: exerciseProgressSummary,
      weightTrend,
      nutritionAdherence,
      workoutConsistency: workoutConsistencySummary,
      workoutConsistencyReliability: workoutConsistency.reliability,
    },
  };
};
