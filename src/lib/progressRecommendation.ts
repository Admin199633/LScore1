import type { DataReliability } from '@/lib/dataReliability';
import type {
  GoalType,
  NutritionAdherenceSummary,
  ProgressStatusResult,
  WeightTrendSummary,
  WorkoutConsistencySummary,
} from '@/lib/progressStatus';

export type ProgressRecommendationType =
  | 'keep_going'
  | 'improve_nutrition'
  | 'improve_consistency'
  | 'focus_on_performance'
  | 'update_missing_data'
  | 'review_plan'
  | 'mixed';

export type ProgressRecommendationPriority = 'high' | 'medium' | 'low';

export type ProgressRecommendation = {
  recommendationType: ProgressRecommendationType;
  title: string;
  message: string;
  actionLabel: string | null;
  priority: ProgressRecommendationPriority;
};

type RecommendationInput = {
  goal: GoalType;
  progressStatus: ProgressStatusResult;
};

const isMissingOrStale = (reliability: DataReliability) =>
  reliability.dataStatus === 'missing' || reliability.dataStatus === 'stale';

const isUsable = (reliability: DataReliability) =>
  reliability.dataStatus === 'complete' || reliability.dataStatus === 'partial';

const isReliableEnoughForIntervention = (reliability: DataReliability) =>
  isUsable(reliability) && reliability.freshness !== 'stale' && reliability.confidence !== 'low';

const isWeightAlignedWithGoal = (goal: GoalType, trend: WeightTrendSummary) => {
  if (trend === 'insufficient_data') {
    return null;
  }

  if (goal === 'bulk') {
    return trend === 'up';
  }

  if (goal === 'cut') {
    return trend === 'down';
  }

  if (goal === 'maintain') {
    return trend === 'stable';
  }

  return null;
};

const buildRecommendation = (
  recommendationType: ProgressRecommendationType,
  title: string,
  message: string,
  actionLabel: string | null,
  priority: ProgressRecommendationPriority
): ProgressRecommendation => ({
  recommendationType,
  title,
  message,
  actionLabel,
  priority,
});

const shouldUpdateMissingData = ({
  exerciseReliability,
  weightReliability,
  nutritionReliability,
  consistencyReliability,
}: {
  exerciseReliability: DataReliability;
  weightReliability: DataReliability;
  nutritionReliability: DataReliability;
  consistencyReliability: DataReliability;
}) => {
  const staleOrMissingCount = [
    exerciseReliability,
    weightReliability,
    nutritionReliability,
    consistencyReliability,
  ].filter(isMissingOrStale).length;

  const lowConfidenceCount = [
    exerciseReliability,
    weightReliability,
    nutritionReliability,
    consistencyReliability,
  ].filter((item) => item.confidence === 'low').length;

  return staleOrMissingCount >= 2 || lowConfidenceCount >= 3;
};

const shouldReviewPlan = ({
  goal,
  weightTrend,
  exerciseTrend,
}: {
  goal: GoalType;
  weightTrend: WeightTrendSummary;
  exerciseTrend: ProgressStatusResult['summaries']['exerciseProgress']['trend'];
}) => {
  if (exerciseTrend !== 'down') {
    return false;
  }

  if (goal === 'bulk') {
    return weightTrend === 'down' || weightTrend === 'stable';
  }

  if (goal === 'cut') {
    return weightTrend === 'up' || weightTrend === 'stable';
  }

  if (goal === 'maintain') {
    return weightTrend === 'up' || weightTrend === 'down';
  }

  return false;
};

const isNutritionWeak = (value: NutritionAdherenceSummary) => value === 'poor';
const isConsistencyWeak = (value: WorkoutConsistencySummary) => value === 'low';

export const calculateProgressRecommendation = ({
  goal,
  progressStatus,
}: RecommendationInput): ProgressRecommendation => {
  const exerciseSummary = progressStatus.summaries.exerciseProgress;
  const weightSummary = progressStatus.summaries.weightTrend;
  const nutritionSummary = progressStatus.summaries.nutritionAdherence;
  const consistencySummary = progressStatus.summaries.workoutConsistency;
  const consistencyReliability = progressStatus.summaries.workoutConsistencyReliability;

  const exerciseReliable = isReliableEnoughForIntervention(exerciseSummary);
  const weightReliable = isReliableEnoughForIntervention(weightSummary);
  const nutritionReliable = isReliableEnoughForIntervention(nutritionSummary);
  const consistencyReliable = isReliableEnoughForIntervention(consistencyReliability);
  const weightAligned = weightReliable ? isWeightAlignedWithGoal(goal, weightSummary.trend) : null;

  if (progressStatus.status === 'insufficient_data') {
    return buildRecommendation(
      'update_missing_data',
      'אין מספיק נתונים',
      'כדי לקבל תמונת התקדמות מדויקת, כדאי לעדכן משקל, תזונה ואימונים באופן רציף.',
      'השלם נתונים',
      'high'
    );
  }

  if (
    shouldUpdateMissingData({
      exerciseReliability: exerciseSummary,
      weightReliability: weightSummary,
      nutritionReliability: nutritionSummary,
      consistencyReliability,
    })
  ) {
    return buildRecommendation(
      'update_missing_data',
      'עדכן נתונים',
      'חלק מהנתונים לא עדכניים, ולכן כדאי לעדכן משקל, תזונה או אימונים כדי לקבל תמונה מדויקת יותר.',
      'השלם נתונים',
      'high'
    );
  }

  if (progressStatus.status === 'on_track') {
    return buildRecommendation(
      'keep_going',
      'המשך כך',
      'הביצועים והנתונים שלך בכיוון הנכון. כדאי להמשיך לשמור על עקביות.',
      'המשך מעקב',
      'low'
    );
  }

  if (progressStatus.status === 'off_track') {
    if (exerciseReliable && exerciseSummary.trend === 'down') {
      if (weightReliable && shouldReviewPlan({ goal, weightTrend: weightSummary.trend, exerciseTrend: exerciseSummary.trend })) {
        return buildRecommendation(
          'review_plan',
          'כדאי לבצע התאמות',
          'גם מגמת המשקל וגם הביצועים לא תואמים כרגע את המטרה שלך. כדאי לבדוק תזונה, עקביות או תוכנית אימון.',
          'בדוק פרטים',
          'high'
        );
      }

      return buildRecommendation(
        'focus_on_performance',
        'בדוק את ההתקדמות באימונים',
        'יש ירידה בביצועים, ולכן כרגע נראה שאתה לא מתקדם בכיוון הרצוי.',
        'צפה בדוחות',
        'high'
      );
    }

    if (nutritionReliable && isNutritionWeak(nutritionSummary.result)) {
      return buildRecommendation(
        'improve_nutrition',
        'שפר את התזונה',
        'כדי לחזור להתקדמות טובה יותר, כדאי לשפר את העמידה ביעדי החלבון והקלוריות.',
        'עדכן תזונה',
        'high'
      );
    }

    if (consistencyReliable && isConsistencyWeak(consistencySummary)) {
      return buildRecommendation(
        'improve_consistency',
        'שפר את העקביות',
        'כדי להתקדם בצורה יציבה יותר, חשוב להתמיד יותר באימונים לפי התוכנית.',
        'צפה באימונים',
        'high'
      );
    }

    return buildRecommendation(
      'review_plan',
      'כדאי לבצע התאמות',
      'כרגע הנתונים מצביעים על פער בין המטרה שלך לבין התוצאה בפועל, ולכן כדאי לבדוק את התוכנית, התזונה והעקביות.',
      'בדוק פרטים',
      'high'
    );
  }

  if (!nutritionReliable && !weightReliable) {
    return buildRecommendation(
      'update_missing_data',
      'עדכן נתונים',
      'חלק מהנתונים עדיין לא עדכניים, ולכן כדאי לעדכן משקל ותזונה כדי לקבל תמונה מדויקת יותר.',
      'השלם נתונים',
      'high'
    );
  }

  if (
    nutritionReliable &&
    isNutritionWeak(nutritionSummary.result) &&
    exerciseSummary.trend !== 'down'
  ) {
    return buildRecommendation(
      'improve_nutrition',
      'שפר את התזונה',
      'יש בסיס טוב, אבל כדי להתקדם כדאי לשפר את העמידה ביעדי החלבון והקלוריות.',
      'עדכן תזונה',
      'medium'
    );
  }

  if (
    consistencyReliable &&
    isConsistencyWeak(consistencySummary) &&
    exerciseSummary.trend !== 'down'
  ) {
    return buildRecommendation(
      'improve_consistency',
      'שפר את העקביות',
      'כדי לראות התקדמות יציבה, חשוב להתמיד יותר באימונים לפי התוכנית.',
      'צפה באימונים',
      'medium'
    );
  }

  if (exerciseReliable && exerciseSummary.trend !== 'down' && weightReliable && weightAligned === false) {
    return buildRecommendation(
      'mixed',
      'המשך, אבל עקוב אחרי המגמה',
      'יש סימני התקדמות באימונים, אבל מגמת המשקל עדיין לא תואמת את המטרה.',
      null,
      'medium'
    );
  }

  return buildRecommendation(
    'mixed',
    'התקדמות חלקית',
    'יש סימני התקדמות, אבל חלק מהמדדים עדיין לא מספיק חזקים כדי להראות תמונה מלאה.',
    null,
    'medium'
  );
};
