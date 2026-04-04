import type { RecommendationItem } from '@/lib/recommendations';
import type { GoalKPIStatusResult } from '@/lib/goalKpiStatus';
import type { NutritionAdherenceResult } from '@/lib/nutritionAdherence';
import type { ProgressStatusResult } from '@/lib/progressStatus';
import type { TrainingLoadResult } from '@/lib/trainingLoad';

export type HomeDecisionStatus =
  | 'needs_data'
  | 'recover'
  | 'off_track'
  | 'on_track'
  | 'stay_consistent';

export type HomeDecisionResult = {
  title: string;
  status: HomeDecisionStatus;
  reason: string;
  confidence: 'low' | 'medium' | 'high';
  primaryActionLabel: string;
  primaryActionHref: '/home' | '/nutrition' | '/workout' | '/reports';
  secondaryNote?: string;
  sourceSignals: {
    goalKpiStatus: GoalKPIStatusResult['status'];
    progressStatus: ProgressStatusResult['status'];
    trainingLoad: TrainingLoadResult['status'];
    nutritionStatus: NutritionAdherenceResult['status'];
    topRecommendationType: RecommendationItem['type'] | null;
  };
};

type HomeDecisionInput = {
  goalKpiStatus: GoalKPIStatusResult;
  progressStatus: ProgressStatusResult;
  trainingLoad: TrainingLoadResult;
  nutritionAdherence: NutritionAdherenceResult;
  recommendations: RecommendationItem[];
  hasTodayWorkout: boolean;
  hasTodayNutritionLog: boolean;
  hasTodayWeight: boolean;
};

type HomeDecisionHref = HomeDecisionResult['primaryActionHref'];
type HomeDecisionAction = {
  label: string;
  href: HomeDecisionHref;
};

const recommendationActionMap: Record<RecommendationItem['type'], HomeDecisionAction> = {
  data: { label: 'השלם נתונים', href: '/reports' },
  training: { label: 'התחל אימון', href: '/workout' },
  nutrition: { label: 'דווח תזונה', href: '/nutrition' },
  consistency: { label: 'פתח אימון', href: '/workout' },
  summary: { label: 'פתח דוחות', href: '/reports' },
};

const getTopRecommendation = (recommendations: RecommendationItem[]) => recommendations[0] || null;

const getDataAction = ({
  hasTodayWeight,
  hasTodayNutritionLog,
  hasTodayWorkout,
  topRecommendation,
}: {
  hasTodayWeight: boolean;
  hasTodayNutritionLog: boolean;
  hasTodayWorkout: boolean;
  topRecommendation: RecommendationItem | null;
}): HomeDecisionAction => {
  if (!hasTodayWeight) {
    return { label: 'הוסף משקל', href: '/home' };
  }

  if (!hasTodayNutritionLog) {
    return { label: 'דווח תזונה', href: '/nutrition' };
  }

  if (!hasTodayWorkout) {
    return { label: 'התחל אימון', href: '/workout' };
  }

  if (topRecommendation) {
    return recommendationActionMap[topRecommendation.type];
  }

  return { label: 'פתח דוחות', href: '/reports' };
};

const getConsistencyAction = ({
  hasTodayWorkout,
  hasTodayNutritionLog,
}: {
  hasTodayWorkout: boolean;
  hasTodayNutritionLog: boolean;
}): HomeDecisionAction => {
  if (!hasTodayWorkout) {
    return { label: 'התחל אימון', href: '/workout' };
  }

  if (!hasTodayNutritionLog) {
    return { label: 'דווח תזונה', href: '/nutrition' };
  }

  return { label: 'פתח דוחות', href: '/reports' };
};

export const getHomeDecision = ({
  goalKpiStatus,
  progressStatus,
  trainingLoad,
  nutritionAdherence,
  recommendations,
  hasTodayWorkout,
  hasTodayNutritionLog,
  hasTodayWeight,
}: HomeDecisionInput): HomeDecisionResult => {
  const topRecommendation = getTopRecommendation(recommendations);
  const highPriorityDataRecommendations = recommendations.filter(
    (item) => item.type === 'data' && item.priority === 'high'
  ).length;

  if (
    progressStatus.status === 'insufficient_data' ||
    goalKpiStatus.status === 'insufficient_data' ||
    highPriorityDataRecommendations >= 2
  ) {
    const action = getDataAction({
      hasTodayWeight,
      hasTodayNutritionLog,
      hasTodayWorkout,
      topRecommendation,
    });

    return {
      title: 'צריך לחזק את הנתונים',
      status: 'needs_data',
      reason:
        topRecommendation?.type === 'data'
          ? topRecommendation.message
          : 'אין מספיק נתונים עדכניים כדי לתת מסקנה יומית חזקה.',
      confidence: 'low',
      primaryActionLabel: action.label,
      primaryActionHref: action.href,
      secondaryNote: 'ככל שתעדכן משקל, תזונה ואימונים באופן עקבי, ההמלצות יהיו מדויקות יותר.',
      sourceSignals: {
        goalKpiStatus: goalKpiStatus.status,
        progressStatus: progressStatus.status,
        trainingLoad: trainingLoad.status,
        nutritionStatus: nutritionAdherence.status,
        topRecommendationType: topRecommendation?.type || null,
      },
    };
  }

  if (trainingLoad.status === 'high_load') {
    return {
      title: 'עדיף להוריד עומס היום',
      status: 'recover',
      reason: trainingLoad.reason,
      confidence: trainingLoad.confidence,
      primaryActionLabel: 'בדוק עומס',
      primaryActionHref: '/reports',
      secondaryNote: 'אם אתה מתאמן היום, עדיף לבחור אימון קל יותר או להתמקד בהתאוששות.',
      sourceSignals: {
        goalKpiStatus: goalKpiStatus.status,
        progressStatus: progressStatus.status,
        trainingLoad: trainingLoad.status,
        nutritionStatus: nutritionAdherence.status,
        topRecommendationType: topRecommendation?.type || null,
      },
    };
  }

  if (goalKpiStatus.status === 'negative' || progressStatus.status === 'off_track') {
    const action: HomeDecisionAction =
      topRecommendation && topRecommendation.type !== 'data'
        ? recommendationActionMap[topRecommendation.type]
        : { label: 'פתח דוחות', href: '/reports' };

    return {
      title: 'צריך לתקן כיוון',
      status: 'off_track',
      reason: goalKpiStatus.reason || progressStatus.reason,
      confidence: goalKpiStatus.confidence === 'high' ? 'high' : progressStatus.confidence,
      primaryActionLabel: action.label,
      primaryActionHref: action.href,
      secondaryNote:
        nutritionAdherence.status === 'poor'
          ? 'כדאי לשים לב גם לעמידה ביעדי התזונה בימים הקרובים.'
          : topRecommendation?.message,
      sourceSignals: {
        goalKpiStatus: goalKpiStatus.status,
        progressStatus: progressStatus.status,
        trainingLoad: trainingLoad.status,
        nutritionStatus: nutritionAdherence.status,
        topRecommendationType: topRecommendation?.type || null,
      },
    };
  }

  if (goalKpiStatus.status === 'positive' && progressStatus.status === 'on_track') {
    const action = getConsistencyAction({
      hasTodayWorkout,
      hasTodayNutritionLog,
    });

    return {
      title: 'אתה בכיוון הנכון',
      status: 'on_track',
      reason: goalKpiStatus.reason,
      confidence: goalKpiStatus.confidence,
      primaryActionLabel: action.label,
      primaryActionHref: action.href,
      secondaryNote:
        action.href === '/workout'
          ? 'המשך לשמור על רצף כדי לחזק את המגמה החיובית.'
          : 'שמירה על עקביות תעזור להפוך את ההתקדמות ליציבה יותר.',
      sourceSignals: {
        goalKpiStatus: goalKpiStatus.status,
        progressStatus: progressStatus.status,
        trainingLoad: trainingLoad.status,
        nutritionStatus: nutritionAdherence.status,
        topRecommendationType: topRecommendation?.type || null,
      },
    };
  }

  const action = getConsistencyAction({
    hasTodayWorkout,
    hasTodayNutritionLog,
  });

  return {
    title: 'שמור על עקביות היום',
    status: 'stay_consistent',
    reason:
      topRecommendation?.message ||
      progressStatus.reason ||
      'אין כרגע סימן חזק לבעיה או לפריצה, ולכן הדבר החשוב ביותר הוא עקביות.',
    confidence: progressStatus.confidence,
    primaryActionLabel: action.label,
    primaryActionHref: action.href,
    secondaryNote:
      trainingLoad.status === 'medium_load'
        ? 'יש סימני עומס קלים, אז כדאי לשים לב לקצב ולהתאוששות.'
        : undefined,
    sourceSignals: {
      goalKpiStatus: goalKpiStatus.status,
      progressStatus: progressStatus.status,
      trainingLoad: trainingLoad.status,
      nutritionStatus: nutritionAdherence.status,
      topRecommendationType: topRecommendation?.type || null,
    },
  };
};
