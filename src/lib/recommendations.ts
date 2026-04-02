import type { DataReliability } from '@/lib/dataReliability';
import type { ExerciseProgressResult } from '@/lib/exerciseProgress';
import type { NutritionAdherenceResult } from '@/lib/nutritionAdherence';
import type { GoalType, ProgressStatusResult, WeightTrendSummaryResult } from '@/lib/progressStatus';
import type { WorkoutConsistencyResult } from '@/lib/workoutConsistency';

export type RecommendationType = 'training' | 'nutrition' | 'consistency' | 'data' | 'summary';
export type RecommendationPriority = 'high' | 'medium' | 'low';

export type RecommendationItem = {
  id: string;
  type: RecommendationType;
  priority: RecommendationPriority;
  title: string;
  message: string;
  action?: string;
};

export type ExerciseProgressRecommendationInput = {
  exerciseName: string;
  result: ExerciseProgressResult;
};

export type GenerateRecommendationsInput = {
  goal: GoalType;
  progressStatus: ProgressStatusResult;
  exerciseProgressResults: ExerciseProgressRecommendationInput[];
  nutritionAdherence: NutritionAdherenceResult;
  workoutConsistency: WorkoutConsistencyResult;
  weightTrend: WeightTrendSummaryResult;
};

const PRIORITY_ORDER: Record<RecommendationPriority, number> = {
  high: 0,
  medium: 1,
  low: 2,
};

const isMissingOrStale = (reliability: Pick<DataReliability, 'dataStatus' | 'confidence'>) =>
  reliability.dataStatus === 'missing' ||
  reliability.dataStatus === 'stale' ||
  reliability.confidence === 'low';

const buildRecommendation = (
  item: RecommendationItem
): RecommendationItem => item;

const buildSummaryRecommendations = (progressStatus: ProgressStatusResult): RecommendationItem[] => {
  if (progressStatus.status === 'on_track') {
    return [
      buildRecommendation({
        id: 'summary-on-track',
        type: 'summary',
        priority: 'low',
        title: 'אתה בכיוון',
        message: 'הביצועים והנתונים שלך תומכים בהתקדמות לפי המטרה.',
      }),
    ];
  }

  if (progressStatus.status === 'partial') {
    return [
      buildRecommendation({
        id: 'summary-partial',
        type: 'summary',
        priority: 'medium',
        title: 'יש שיפור חלקי',
        message: 'חלק מהמדדים נראים טוב, אבל יש תחומים שעדיין דורשים שיפור.',
      }),
    ];
  }

  if (progressStatus.status === 'off_track') {
    return [
      buildRecommendation({
        id: 'summary-off-track',
        type: 'summary',
        priority: 'high',
        title: 'נדרש שינוי',
        message: 'הנתונים מצביעים על כך שאתה לא מתקדם כרגע לפי המטרה.',
      }),
    ];
  }

  return [
    buildRecommendation({
      id: 'summary-insufficient-data',
      type: 'data',
      priority: 'high',
      title: 'אין מספיק נתונים',
      message: 'צריך עוד נתונים עדכניים כדי לתת המלצות מדויקות.',
      action: 'עדכן נתונים',
    }),
  ];
};

const buildDataRecommendations = ({
  progressStatus,
  nutritionAdherence,
  workoutConsistency,
  weightTrend,
}: Pick<GenerateRecommendationsInput, 'progressStatus' | 'nutritionAdherence' | 'workoutConsistency' | 'weightTrend'>): RecommendationItem[] => {
  const recommendations: RecommendationItem[] = [];

  if (isMissingOrStale(progressStatus.summaries.exerciseProgress)) {
    recommendations.push(
      buildRecommendation({
        id: 'data-workouts',
        type: 'data',
        priority: 'high',
        title: 'אין מספיק נתוני אימון',
        message: 'אין מספיק אימונים מתועדים כדי לנתח ביצועים בצורה אמינה.',
        action: 'שמור אימונים באופן עקבי',
      })
    );
  }

  if (isMissingOrStale(nutritionAdherence)) {
    recommendations.push(
      buildRecommendation({
        id: 'data-nutrition',
        type: 'data',
        priority: 'high',
        title: 'חסרים נתוני תזונה',
        message: 'אין מספיק נתוני תזונה מהימים האחרונים.',
        action: 'עדכן תזונה כדי לשפר את דיוק ההמלצות.',
      })
    );
  }

  if (isMissingOrStale(weightTrend)) {
    recommendations.push(
      buildRecommendation({
        id: 'data-weight',
        type: 'data',
        priority: 'high',
        title: 'חסר מעקב משקל',
        message: 'אין מספיק שקילות עדכניות כדי לזהות מגמת משקל אמינה.',
        action: 'הזן משקל כדי לשפר את אמינות המגמה.',
      })
    );
  }

  if (isMissingOrStale(workoutConsistency.reliability)) {
    recommendations.push(
      buildRecommendation({
        id: 'data-consistency',
        type: 'data',
        priority: 'medium',
        title: 'חסר מעקב עקביות',
        message: workoutConsistency.reliability.reliabilityReason || 'אין מספיק נתוני אימון כדי להעריך עקביות בצורה יציבה.',
        action: 'שמור אימונים כדי לשפר את הדיוק.',
      })
    );
  }

  return recommendations;
};

const buildTrainingRecommendations = (
  exerciseProgressResults: ExerciseProgressRecommendationInput[]
): RecommendationItem[] => {
  const validResults = exerciseProgressResults.filter((item) => item.result.trend !== 'insufficient_data');
  const downResults = validResults
    .filter((item) => item.result.trend === 'down')
    .sort((left, right) => (left.result.deltaPercentage ?? 0) - (right.result.deltaPercentage ?? 0));
  const stableResults = validResults.filter((item) => item.result.trend === 'stable');
  const upResults = validResults
    .filter((item) => item.result.trend === 'up')
    .sort((left, right) => (right.result.deltaPercentage ?? 0) - (left.result.deltaPercentage ?? 0));

  if (downResults.length > 0) {
    const selected = downResults[0];
    return [
      buildRecommendation({
        id: `training-down-${selected.exerciseName}`,
        type: 'training',
        priority: 'high',
        title: 'ירידה בביצועים',
        message: `יש ירידה בביצועים ב${selected.exerciseName} לעומת האימון הקודם.`,
        action: 'שקול להוריד עומס או לבדוק התאוששות.',
      }),
    ];
  }

  if (stableResults.length > 0) {
    const selected = stableResults[0];
    return [
      buildRecommendation({
        id: `training-stable-${selected.exerciseName}`,
        type: 'training',
        priority: 'medium',
        title: 'אפשר לדחוף קדימה',
        message: `${selected.exerciseName} יציב כרגע בלי שיפור מהותי.`,
        action: 'נסה לשפר חזרות או משקל באימון הבא.',
      }),
    ];
  }

  if (upResults.length > 0) {
    const selected = upResults[0];
    return [
      buildRecommendation({
        id: `training-up-${selected.exerciseName}`,
        type: 'training',
        priority: 'low',
        title: 'אפשר להתקדם',
        message: `יש שיפור ב${selected.exerciseName}.`,
        action: 'אפשר לשקול להעלות משקל באימון הבא.',
      }),
    ];
  }

  return [];
};

const buildNutritionRecommendations = (nutritionAdherence: NutritionAdherenceResult): RecommendationItem[] => {
  if (isMissingOrStale(nutritionAdherence) || nutritionAdherence.status === 'insufficient_data') {
    return [
      buildRecommendation({
        id: 'nutrition-data',
        type: 'data',
        priority: 'high',
        title: 'חסרים נתוני תזונה',
        message: 'אין מספיק נתוני תזונה מהימים האחרונים.',
        action: 'עדכן תזונה כדי לקבל המלצות מדויקות יותר.',
      }),
    ];
  }

  if (nutritionAdherence.status === 'poor') {
    return [
      buildRecommendation({
        id: 'nutrition-poor',
        type: 'nutrition',
        priority: 'high',
        title: 'התזונה לא עקבית',
        message: nutritionAdherence.reason,
        action: 'נסה להשלים את היעדים בצורה עקבית יותר.',
      }),
    ];
  }

  if (nutritionAdherence.status === 'partial') {
    return [
      buildRecommendation({
        id: 'nutrition-partial',
        type: 'nutrition',
        priority: 'medium',
        title: 'יש מקום לשיפור בתזונה',
        message: nutritionAdherence.reason,
        action: 'נסה לשפר עקביות בחלבון או בקלוריות.',
      }),
    ];
  }

  if (nutritionAdherence.status === 'good') {
    return [
      buildRecommendation({
        id: 'nutrition-good',
        type: 'nutrition',
        priority: 'low',
        title: 'התזונה תומכת במטרה',
        message: 'נתוני התזונה שלך נראים עקביים ברוב ימי השבוע.',
      }),
    ];
  }

  return [];
};

const buildConsistencyRecommendations = (workoutConsistency: WorkoutConsistencyResult): RecommendationItem[] => {
  if (isMissingOrStale(workoutConsistency.reliability)) {
    return [
      buildRecommendation({
        id: 'consistency-data',
        type: 'data',
        priority: 'medium',
        title: 'חסרים נתוני עקביות',
        message: workoutConsistency.reliability.reliabilityReason || 'אין מספיק נתונים כדי להעריך את קצב האימונים שלך.',
        action: 'שמור אימונים כדי לשפר את הדיוק.',
      }),
    ];
  }

  if (workoutConsistency.currentWeek.paceStatus === 'behind') {
    return [
      buildRecommendation({
        id: 'consistency-behind',
        type: 'consistency',
        priority: 'high',
        title: 'אתה מאחור השבוע',
        message: 'קצב האימונים שלך נמוך מהיעד השבועי.',
        action: 'נסה להשלים אימון נוסף השבוע.',
      }),
    ];
  }

  if (workoutConsistency.currentWeek.paceStatus === 'ahead') {
    return [
      buildRecommendation({
        id: 'consistency-ahead',
        type: 'consistency',
        priority: 'low',
        title: 'הקצב השבועי טוב',
        message: 'אתה עומד יפה בקצב האימונים השבוע.',
      }),
    ];
  }

  return [];
};

const dedupeRecommendations = (recommendations: RecommendationItem[]) => {
  const seen = new Set<string>();

  return recommendations.filter((item) => {
    const key = `${item.type}:${item.title}`;
    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
};

export const generateRecommendations = ({
  goal,
  progressStatus,
  exerciseProgressResults,
  nutritionAdherence,
  workoutConsistency,
  weightTrend,
}: GenerateRecommendationsInput): RecommendationItem[] => {
  const progressInsufficient = progressStatus.status === 'insufficient_data';
  const severeDataIssues = buildDataRecommendations({
    progressStatus,
    nutritionAdherence,
    workoutConsistency,
    weightTrend,
  });

  const candidates: RecommendationItem[] = [
    ...buildSummaryRecommendations(progressStatus),
    ...severeDataIssues,
    ...(!progressInsufficient ? buildTrainingRecommendations(exerciseProgressResults) : []),
    ...buildNutritionRecommendations(nutritionAdherence),
    ...buildConsistencyRecommendations(workoutConsistency),
  ];

  const goalAwareCandidates =
    goal === 'bulk' || goal === 'cut' || goal === 'maintain'
      ? candidates
      : candidates.filter((item) => item.type !== 'summary' || item.priority !== 'low');

  const filteredForConflicts = progressInsufficient
    ? goalAwareCandidates.filter((item) => item.type === 'data' || item.type === 'summary')
    : severeDataIssues.length >= 2
      ? goalAwareCandidates.filter((item) => item.type !== 'training' || item.priority !== 'low')
      : goalAwareCandidates;

  return dedupeRecommendations(filteredForConflicts)
    .sort((left, right) => PRIORITY_ORDER[left.priority] - PRIORITY_ORDER[right.priority])
    .slice(0, 3);
};
