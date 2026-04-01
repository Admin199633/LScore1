import { calculateExerciseProgress, type ExerciseProgressTrend } from '@/lib/exerciseProgress';
import type { SavedNutritionLog } from '@/lib/repositories/nutritionLogRepository';
import type { WorkoutProgram } from '@/lib/repositories/programRepository';
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
};

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
    weightTrend: WeightTrendSummary;
    nutritionAdherence: NutritionAdherenceSummary;
    workoutConsistency: WorkoutConsistencySummary;
  };
};

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
  workoutHistory: SavedWorkoutSession[]
): ExerciseProgressSummary => {
  const uniqueExerciseNames = Array.from(new Set(exerciseNames.map((name) => String(name || '').trim()).filter(Boolean)));
  let upCount = 0;
  let stableCount = 0;
  let downCount = 0;

  uniqueExerciseNames.forEach((exerciseName) => {
    const trend = calculateExerciseProgress(exerciseName, workoutHistory).trend as ExerciseProgressTrend;

    if (trend === 'up') upCount += 1;
    if (trend === 'stable') stableCount += 1;
    if (trend === 'down') downCount += 1;
  });

  const validExercisesCount = upCount + stableCount + downCount;

  if (validExercisesCount < 2) {
    return {
      trend: 'insufficient_data',
      upCount,
      stableCount,
      downCount,
      validExercisesCount,
    };
  }

  if (downCount > upCount && downCount >= stableCount) {
    return { trend: 'down', upCount, stableCount, downCount, validExercisesCount };
  }

  if (upCount > downCount && upCount >= stableCount) {
    return { trend: 'up', upCount, stableCount, downCount, validExercisesCount };
  }

  return { trend: 'stable', upCount, stableCount, downCount, validExercisesCount };
};

export const summarizeWeightTrend = (bodyweightLogs: Array<{ date: string; weight: number }>): WeightTrendSummary => {
  if (!Array.isArray(bodyweightLogs) || bodyweightLogs.length < 2) {
    return 'insufficient_data';
  }

  return calculateBodyweightTrend(bodyweightLogs) as WeightTrendSummary;
};

export const summarizeNutritionAdherence = ({
  goal,
  nutritionLogs,
  profile,
  bodyweightLogs,
}: {
  goal: GoalType;
  nutritionLogs: SavedNutritionLog[];
  profile: ProfileForProgress | null;
  bodyweightLogs: Array<{ date: string; weight: number }>;
}): NutritionAdherenceSummary => {
  const recentLogs = [...(nutritionLogs || [])]
    .sort((left, right) => left.date.localeCompare(right.date))
    .slice(-7);

  if (recentLogs.length < 3) {
    return 'insufficient_data';
  }

  const proteinTarget = getDailyProteinTarget(profile, bodyweightLogs);
  const calorieTarget = getDailyCalorieTarget(profile, bodyweightLogs);

  if (!proteinTarget || !calorieTarget) {
    return 'insufficient_data';
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
    return 'insufficient_data';
  }

  const averageScore = scores.reduce((sum, score) => sum + score, 0) / scores.length;

  if (averageScore >= 1.5) {
    return 'good';
  }

  if (averageScore >= 0.85) {
    return 'partial';
  }

  return 'poor';
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

const getProgressStatusConfidence = ({
  exerciseProgressSummary,
  weightTrend,
  nutritionAdherence,
  workoutConsistency,
}: {
  exerciseProgressSummary: ExerciseProgressSummary;
  weightTrend: WeightTrendSummary;
  nutritionAdherence: NutritionAdherenceSummary;
  workoutConsistency: WorkoutConsistencySummary;
}) => {
  const availableStatuses = [
    exerciseProgressSummary.trend,
    weightTrend,
    nutritionAdherence,
    workoutConsistency,
  ].filter(isAvailable);

  const hasExercise = isAvailable(exerciseProgressSummary.trend);
  const hasWeight = isAvailable(weightTrend);

  if (availableStatuses.length === 4 && hasExercise) {
    return 'high' as const;
  }

  if (availableStatuses.length >= 3 && (hasExercise || hasWeight)) {
    return 'medium' as const;
  }

  return 'low' as const;
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
}: {
  goal: GoalType;
  exerciseProgressSummary: ExerciseProgressSummary;
  weightTrend: WeightTrendSummary;
  nutritionAdherence: NutritionAdherenceSummary;
  workoutConsistency: WorkoutConsistencySummary;
}): Omit<ProgressStatusResult, 'summaries' | 'breakdown'> => {
  const statuses = [exerciseProgressSummary.trend, weightTrend, nutritionAdherence, workoutConsistency];
  const insufficientCount = statuses.filter((status) => status === 'insufficient_data').length;
  const confidence = getProgressStatusConfidence({
    exerciseProgressSummary,
    weightTrend,
    nutritionAdherence,
    workoutConsistency,
  });
  const exerciseTrend = exerciseProgressSummary.trend;
  const lowHabitSupport = workoutConsistency === 'low' && nutritionAdherence === 'poor';
  const hasTooLittleData =
    (exerciseTrend === 'insufficient_data' && insufficientCount >= 2) || insufficientCount >= 3;

  if (hasTooLittleData) {
    return buildDecision(
      'insufficient_data',
      'אין מספיק נתונים כדי לקבוע אם אתה בכיוון.',
      confidence
    );
  }

  if (goal === 'maintain' && weightTrend !== 'stable' && exerciseTrend === 'down') {
    return buildDecision(
      'off_track',
      'המשקל זז מהיעד והביצועים בירידה, ולכן אתה לא בכיוון.',
      confidence
    );
  }

  if (goal === 'bulk') {
    const weightGood = weightTrend === 'up';
    const nutritionGood = nutritionAdherence === 'good' || nutritionAdherence === 'partial';
    const consistencyGood = workoutConsistency === 'high' || workoutConsistency === 'medium';
    const onTrackBlocked =
      exerciseTrend === 'down' ||
      (weightTrend === 'down' && exerciseTrend !== 'up') ||
      lowHabitSupport;

    if (!onTrackBlocked && exerciseTrend === 'up' && weightGood && nutritionGood && consistencyGood) {
      return buildDecision(
        'on_track',
        'הביצועים בעלייה והמשקל מתקדם בהתאם למטרה שלך.',
        confidence
      );
    }

    if (exerciseTrend === 'down') {
      return buildDecision(
        'off_track',
        weightTrend === 'up'
          ? 'המשקל עולה, אבל אין שיפור בתרגילים ולכן ההתקדמות לא מספקת.'
          : 'הביצועים בירידה ולכן קשה לומר שאתה מתקדם במסה.',
        confidence
      );
    }

    if (weightTrend === 'down' && exerciseTrend !== 'up') {
      return buildDecision(
        'off_track',
        'מגמת המשקל לא תואמת מסה, וגם הביצועים לא נותנים פיצוי ברור.',
        confidence
      );
    }

    if (lowHabitSupport) {
      return buildDecision(
        exerciseTrend === 'up' || (exerciseTrend === 'stable' && weightGood) ? 'partial' : 'off_track',
        'התזונה והעקביות חלשות ולכן קשה להתקדם כרגע.',
        confidence
      );
    }

    if ((exerciseTrend === 'stable' && weightGood) || (exerciseTrend === 'up' && (!nutritionGood || !consistencyGood))) {
      return buildDecision(
        'partial',
        weightTrend !== 'up'
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
    const weightGood = weightTrend === 'down';
    const exerciseGood = exerciseTrend === 'up' || exerciseTrend === 'stable';
    const nutritionGood = nutritionAdherence === 'good' || nutritionAdherence === 'partial';
    const consistencyGood = workoutConsistency === 'high' || workoutConsistency === 'medium';
    const onTrackBlocked =
      exerciseTrend === 'down' ||
      (weightTrend === 'up' && nutritionAdherence === 'poor') ||
      lowHabitSupport;

    if (!onTrackBlocked && exerciseGood && weightGood && nutritionGood && consistencyGood) {
      return buildDecision(
        'on_track',
        'המשקל יורד והביצועים נשמרים בהתאם למטרת חיטוב.',
        confidence
      );
    }

    if (weightTrend === 'up' && nutritionAdherence === 'poor') {
      return buildDecision(
        'off_track',
        'המשקל עולה והתזונה חלשה, ולכן אתה לא בכיוון לחיטוב.',
        confidence
      );
    }

    if (exerciseTrend === 'down' && weightGood) {
      return buildDecision(
        'partial',
        'יש ירידה במשקל, אבל הביצועים נחלשים ולכן ההתקדמות חלקית.',
        confidence
      );
    }

    if (lowHabitSupport) {
      return buildDecision(
        exerciseGood && weightGood ? 'partial' : 'off_track',
        'התזונה והעקביות חלשות ולכן קשה להתקדם כרגע.',
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

  const weightGood = weightTrend === 'stable';
  const exerciseGood = exerciseTrend === 'up' || exerciseTrend === 'stable';
  const nutritionGood = nutritionAdherence === 'good' || nutritionAdherence === 'partial';
  const consistencyGood = workoutConsistency === 'high' || workoutConsistency === 'medium';
  const onTrackBlocked = exerciseTrend === 'down' || lowHabitSupport;

  if (!onTrackBlocked && exerciseGood && weightGood && nutritionGood && consistencyGood) {
    return buildDecision(
      'on_track',
      'המשקל יציב והביצועים נשמרים בהתאם למטרת שמירה.',
      confidence
    );
  }

  if (exerciseTrend === 'down' && weightTrend !== 'stable') {
    return buildDecision(
      'off_track',
      'המשקל לא יציב וגם הביצועים בירידה, ולכן אתה לא בכיוון.',
      confidence
    );
  }

  if (lowHabitSupport) {
    return buildDecision(
      exerciseGood && weightGood ? 'partial' : 'off_track',
      'התזונה והעקביות חלשות ולכן קשה להתקדם כרגע.',
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
}: {
  goal: GoalType;
  exerciseNames: string[];
  workoutHistory: SavedWorkoutSession[];
  bodyweightLogs: Array<{ date: string; weight: number }>;
  nutritionLogs: SavedNutritionLog[];
  profile: ProfileForProgress | null;
  workoutConsistency: WorkoutConsistencyResult;
}): ProgressStatusResult => {
  const exerciseProgressSummary = summarizeExerciseProgress(exerciseNames, workoutHistory);
  const weightTrend = summarizeWeightTrend(bodyweightLogs);
  const nutritionAdherence = summarizeNutritionAdherence({
    goal,
    nutritionLogs,
    profile,
    bodyweightLogs,
  });
  const workoutConsistencySummary = summarizeWorkoutConsistency(workoutConsistency);
  const decision = calculateProgressStatus({
    goal,
    exerciseProgressSummary,
    weightTrend,
    nutritionAdherence,
    workoutConsistency: workoutConsistencySummary,
  });

  return {
    ...decision,
    breakdown: {
      exercise: exerciseProgressSummary,
      weight: weightTrend,
      nutrition: nutritionAdherence,
      consistency: workoutConsistencySummary,
    },
    summaries: {
      exerciseProgress: exerciseProgressSummary,
      weightTrend,
      nutritionAdherence,
      workoutConsistency: workoutConsistencySummary,
    },
  };
};
