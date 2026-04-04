import { assessNutritionDataQuality, mapQualityToConfidence } from '@/lib/dataQuality';
import { diffDaysFromCurrentDate, type DataConfidence, type DataFreshness, type DataStatus } from '@/lib/dataReliability';
import type { GoalType } from '@/lib/goalDefinitions';
import {
  getDailyCalorieTarget,
  getDailyProteinTarget,
  type ProfileForProgress,
} from '@/lib/progressStatus';
import type { SavedNutritionLog } from '@/lib/repositories/nutritionLogRepository';

export type NutritionAdherenceStatus = 'good' | 'partial' | 'poor' | 'insufficient_data';

export type NutritionTargetSet = {
  calories: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
};

export type NutritionDailyBreakdown = {
  date: string;
  actual: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  };
  target: NutritionTargetSet;
  proteinMet: boolean;
  caloriesInRange: boolean;
};

export type NutritionAdherenceResult = {
  status: NutritionAdherenceStatus;
  label: 'עומד ביעדים' | 'חלקית' | 'לא עומד' | 'אין מספיק נתונים';
  reason: string;
  proteinDaysMet: number;
  calorieDaysInRange: number;
  totalTrackedDays: number;
  averages: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  };
  targets: NutritionTargetSet;
  dailyBreakdown: NutritionDailyBreakdown[];
  dataStatus: DataStatus;
  freshness: DataFreshness;
  confidence: DataConfidence;
  lastUpdatedAt: string | null;
};

const roundNumber = (value: number) => Math.round(value * 10) / 10;

const normalizeDate = (value?: string | Date) => {
  if (value instanceof Date) {
    return new Date(Date.UTC(value.getFullYear(), value.getMonth(), value.getDate()));
  }

  const normalized = String(value || '').trim();
  if (!normalized) {
    const now = new Date();
    return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  }

  const [year, month, day] = normalized.slice(0, 10).split('-').map(Number);
  if (!year || !month || !day) {
    const now = new Date();
    return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  }

  return new Date(Date.UTC(year, month - 1, day));
};

const formatDate = (value: Date) => {
  const year = value.getUTCFullYear();
  const month = String(value.getUTCMonth() + 1).padStart(2, '0');
  const day = String(value.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getLast7Days = (currentDate?: string | Date) => {
  const current = normalizeDate(currentDate);
  return Array.from({ length: 7 }, (_, index) => {
    const nextDate = new Date(current);
    nextDate.setUTCDate(current.getUTCDate() - index);
    return formatDate(nextDate);
  }).reverse();
};

const toNumber = (value: number | null | undefined) => (typeof value === 'number' && Number.isFinite(value) ? value : 0);

const buildMacroTargets = ({
  caloriesTarget,
  proteinTarget,
}: {
  caloriesTarget: number | null;
  proteinTarget: number | null;
}): NutritionTargetSet => {
  if (!caloriesTarget || !proteinTarget) {
    return {
      calories: caloriesTarget,
      protein: proteinTarget,
      carbs: null,
      fat: null,
    };
  }

  const fatTarget = Math.round((caloriesTarget * 0.25) / 9);
  const remainingCalories = caloriesTarget - proteinTarget * 4 - fatTarget * 9;
  const carbsTarget = remainingCalories > 0 ? Math.round(remainingCalories / 4) : null;

  return {
    calories: caloriesTarget,
    protein: proteinTarget,
    carbs: carbsTarget,
    fat: fatTarget,
  };
};

const isProteinMet = (actualProtein: number, proteinTarget: number | null) =>
  Boolean(proteinTarget && actualProtein >= proteinTarget * 0.9);

const isCaloriesInRange = (actualCalories: number, calorieTarget: number | null) => {
  if (!calorieTarget) {
    return false;
  }

  const lowerBound = calorieTarget * 0.9;
  const upperBound = calorieTarget * 1.1;
  return actualCalories >= lowerBound && actualCalories <= upperBound;
};

const getReliability = ({
  totalTrackedDays,
  daysSinceLastLog,
  nutritionQuality,
}: {
  totalTrackedDays: number;
  daysSinceLastLog: number | null;
  nutritionQuality: ReturnType<typeof assessNutritionDataQuality>;
}): Pick<NutritionAdherenceResult, 'dataStatus' | 'freshness' | 'confidence'> => {
  if (nutritionQuality.status === 'invalid') {
    return {
      dataStatus: 'missing',
      freshness: 'stale',
      confidence: 'low',
    };
  }

  if (totalTrackedDays <= 1) {
    return {
      dataStatus: 'missing',
      freshness: 'stale',
      confidence: 'low',
    };
  }

  if (totalTrackedDays >= 6 && daysSinceLastLog !== null && daysSinceLastLog <= 1) {
    return {
      dataStatus: 'complete',
      freshness: 'fresh',
      confidence: 'high',
    };
  }

  if (totalTrackedDays >= 4) {
    return {
      dataStatus: 'partial',
      freshness: 'aging',
      confidence: mapQualityToConfidence(nutritionQuality, 'medium'),
    };
  }

  if (daysSinceLastLog !== null && daysSinceLastLog > 1) {
    return {
      dataStatus: 'stale',
      freshness: 'stale',
      confidence: 'low',
    };
  }

  return {
    dataStatus: 'partial',
    freshness: 'aging',
    confidence: 'low',
  };
};

const buildLabel = (status: NutritionAdherenceStatus): NutritionAdherenceResult['label'] => {
  if (status === 'good') return 'עומד ביעדים';
  if (status === 'partial') return 'חלקית';
  if (status === 'poor') return 'לא עומד';
  return 'אין מספיק נתונים';
};

const buildReason = ({
  status,
  proteinDaysMet,
  calorieDaysInRange,
  totalTrackedDays,
}: {
  status: NutritionAdherenceStatus;
  proteinDaysMet: number;
  calorieDaysInRange: number;
  totalTrackedDays: number;
}) => {
  if (status === 'good') {
    return 'עמדת ביעד חלבון ובטווח הקלורי ברוב ימי השבוע.';
  }

  if (status === 'partial') {
    if (proteinDaysMet >= calorieDaysInRange) {
      return 'עמדת חלקית ביעדי התזונה, אבל הקלוריות לא היו עקביות.';
    }

    return 'עמדת חלקית ביעדי התזונה, אבל החלבון לא היה עקבי לאורך השבוע.';
  }

  if (status === 'poor') {
    return 'רוב ימי השבוע לא עמדת ביעדי החלבון והקלוריות.';
  }

  return totalTrackedDays === 0
    ? 'אין נתוני תזונה ב-7 הימים האחרונים.'
    : 'אין מספיק נתוני תזונה כדי לקבוע עמידה ביעדים.';
};

export const calculateNutritionAdherence = ({
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
}): NutritionAdherenceResult => {
  const last7Days = new Set(getLast7Days(currentDate));
  const recentLogs = [...(nutritionLogs || [])]
    .filter((log) => last7Days.has(String(log.date || '').slice(0, 10)))
    .sort((left, right) => left.date.localeCompare(right.date));
  const totalTrackedDays = recentLogs.length;
  const lastUpdatedAt = totalTrackedDays > 0 ? recentLogs[recentLogs.length - 1].date : null;
  const daysSinceLastLog = diffDaysFromCurrentDate(lastUpdatedAt, currentDate);
  const calorieTarget = getDailyCalorieTarget(profile, bodyweightLogs);
  const proteinTarget = getDailyProteinTarget(profile, bodyweightLogs);
  const nutritionQuality = assessNutritionDataQuality(recentLogs, currentDate);
  const targets = buildMacroTargets({
    caloriesTarget: calorieTarget,
    proteinTarget,
  });
  const reliability = getReliability({
    totalTrackedDays,
    daysSinceLastLog,
    nutritionQuality,
  });

  const dailyBreakdown: NutritionDailyBreakdown[] = recentLogs.map((log) => {
    const actual = {
      calories: toNumber(log.totalCalories),
      protein: toNumber(log.totalProteinGrams),
      carbs: toNumber(log.totalCarbs),
      fat: toNumber(log.totalFat),
    };

    return {
      date: log.date,
      actual,
      target: targets,
      proteinMet: isProteinMet(actual.protein, proteinTarget),
      caloriesInRange: isCaloriesInRange(actual.calories, calorieTarget),
    };
  });

  const proteinDaysMet = dailyBreakdown.filter((day) => day.proteinMet).length;
  const calorieDaysInRange = dailyBreakdown.filter((day) => day.caloriesInRange).length;
  const averages = totalTrackedDays
    ? {
        calories: roundNumber(dailyBreakdown.reduce((sum, day) => sum + day.actual.calories, 0) / totalTrackedDays),
        protein: roundNumber(dailyBreakdown.reduce((sum, day) => sum + day.actual.protein, 0) / totalTrackedDays),
        carbs: roundNumber(dailyBreakdown.reduce((sum, day) => sum + day.actual.carbs, 0) / totalTrackedDays),
        fat: roundNumber(dailyBreakdown.reduce((sum, day) => sum + day.actual.fat, 0) / totalTrackedDays),
      }
    : {
        calories: 0,
        protein: 0,
        carbs: 0,
        fat: 0,
      };

  let status: NutritionAdherenceStatus = 'insufficient_data';

  if (nutritionQuality.status === 'invalid' || totalTrackedDays < 3 || !proteinTarget || !calorieTarget) {
    status = 'insufficient_data';
  } else if (totalTrackedDays >= 5 && proteinDaysMet >= 5 && calorieDaysInRange >= 5) {
    status = 'good';
  } else if (totalTrackedDays >= 4 && (proteinDaysMet >= 3 || calorieDaysInRange >= 3)) {
    status = 'partial';
  } else if (totalTrackedDays >= 3) {
    status = 'poor';
  }

  if (status === 'poor' && reliability.dataStatus === 'missing') {
    status = 'insufficient_data';
  }

  return {
    status,
    label: buildLabel(status),
    reason:
      status === 'insufficient_data'
        ? nutritionQuality.reason
        : buildReason({
            status,
            proteinDaysMet,
            calorieDaysInRange,
            totalTrackedDays,
          }),
    proteinDaysMet,
    calorieDaysInRange,
    totalTrackedDays,
    averages,
    targets,
    dailyBreakdown,
    dataStatus: reliability.dataStatus,
    freshness: reliability.freshness,
    confidence: reliability.confidence,
    lastUpdatedAt,
  };
};
