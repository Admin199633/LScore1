import type { WorkoutProgram } from '@/lib/repositories/programRepository';
import type { SavedWorkoutSession } from '@/lib/repositories/workoutSessionRepository';
import { diffDaysFromCurrentDate, getLatestDate, type DataReliability } from '@/lib/dataReliability';
import {
  getCurrentWeekRange,
  getPreviousWeekRange,
  normalizeDateInput,
  type WeekRange,
} from '@/lib/weeklyDate';

export { getCurrentWeekRange, getPreviousWeekRange } from '@/lib/weeklyDate';

export type WorkoutConsistencyStatus = 'high' | 'medium' | 'low';
export type WorkoutPaceStatus = 'on_track' | 'behind' | 'ahead';
export type WorkoutConsistencyConfidence = 'low' | 'medium' | 'high';

export type WorkoutConsistencyResult = {
  weeklyTarget: number;
  lastWeek: {
    completed: number;
    percentage: number;
    status: WorkoutConsistencyStatus;
  };
  currentWeek: {
    completed: number;
    expectedSoFar: number;
    paceStatus: WorkoutPaceStatus;
  };
  confidence: WorkoutConsistencyConfidence;
  reason: string;
  hasActiveProgram: boolean;
  reliability: DataReliability;
};

export const getWeeklyWorkoutTarget = (workoutProgram: WorkoutProgram | null | undefined) => {
  if (!workoutProgram || !Array.isArray(workoutProgram.days)) {
    return 0;
  }

  return workoutProgram.days.filter((day) => {
    const hasName = Boolean(String(day?.name || '').trim());
    const hasRows = Array.isArray(day?.rows) && day.rows.some((row) => Boolean(String(row?.exercise || '').trim()));
    return hasName || hasRows;
  }).length;
};

export const countCompletedWorkoutsInDateRange = (
  workoutHistory: SavedWorkoutSession[],
  range: WeekRange
) => {
  if (!Array.isArray(workoutHistory)) {
    return 0;
  }

  return workoutHistory.filter((session) => {
    const sessionDate = String(session?.date || '').slice(0, 10);
    return Boolean(sessionDate) && sessionDate >= range.startOfWeek && sessionDate <= range.endOfWeek;
  }).length;
};

export const calculateExpectedWorkoutsSoFar = (
  weeklyTarget: number,
  currentDate?: string | Date
) => {
  if (weeklyTarget <= 0) {
    return 0;
  }

  const currentWeekStart = normalizeDateInput(getCurrentWeekRange(currentDate).startOfWeek);
  const today = normalizeDateInput(currentDate);
  const daysElapsedInWeek = Math.floor((today.getTime() - currentWeekStart.getTime()) / (24 * 60 * 60 * 1000)) + 1;

  return Math.ceil((daysElapsedInWeek / 7) * weeklyTarget);
};

export const getPaceStatus = (
  actualThisWeek: number,
  expectedSoFar: number
): WorkoutPaceStatus => {
  if (actualThisWeek > expectedSoFar) {
    return 'ahead';
  }

  if (actualThisWeek < expectedSoFar) {
    return 'behind';
  }

  return 'on_track';
};

const getLastWeekStatus = (percentage: number): WorkoutConsistencyStatus => {
  if (percentage >= 80) {
    return 'high';
  }

  if (percentage >= 50) {
    return 'medium';
  }

  return 'low';
};

const getWeeksWithHistoryBeforeCurrentWeek = (
  workoutHistory: SavedWorkoutSession[],
  currentDate?: string | Date
) => {
  const currentWeekRange = getCurrentWeekRange(currentDate);

  return new Set(
    workoutHistory
      .map((session) => String(session?.date || '').slice(0, 10))
      .filter((date) => Boolean(date) && date < currentWeekRange.startOfWeek)
      .map((date) => getCurrentWeekRange(date).startOfWeek)
  ).size;
};

const getConfidence = (
  weeklyTarget: number,
  workoutHistory: SavedWorkoutSession[],
  currentDate?: string | Date
): WorkoutConsistencyConfidence => {
  if (weeklyTarget <= 0) {
    return 'low';
  }

  const previousClosedWeeksWithHistory = getWeeksWithHistoryBeforeCurrentWeek(workoutHistory, currentDate);

  if (previousClosedWeeksWithHistory >= 2) {
    return 'high';
  }

  if (previousClosedWeeksWithHistory >= 1) {
    return 'medium';
  }

  return 'low';
};

const getReliability = (
  weeklyTarget: number,
  workoutHistory: SavedWorkoutSession[],
  currentDate?: string | Date
): DataReliability => {
  const lastUpdatedAt = getLatestDate(workoutHistory.map((session) => session?.date));

  if (weeklyTarget <= 0) {
    return {
      dataStatus: 'missing',
      freshness: 'stale',
      confidence: 'low',
      lastUpdatedAt,
      reliabilityReason: 'אין תוכנית אימונים פעילה',
    };
  }

  const previousClosedWeeksWithHistory = getWeeksWithHistoryBeforeCurrentWeek(workoutHistory, currentDate);
  const currentWeekRange = getCurrentWeekRange(currentDate);
  const currentWeekCompleted = countCompletedWorkoutsInDateRange(workoutHistory, currentWeekRange);
  const daysSinceLastWorkout = diffDaysFromCurrentDate(lastUpdatedAt, currentDate);

  if (previousClosedWeeksWithHistory >= 2 && currentWeekCompleted > 0) {
    return {
      dataStatus: 'complete',
      freshness: daysSinceLastWorkout !== null && daysSinceLastWorkout <= 14 ? 'fresh' : 'aging',
      confidence: 'high',
      lastUpdatedAt,
      reliabilityReason: 'הדוח מבוסס על כמה שבועות עם היסטוריית אימונים',
    };
  }

  if (previousClosedWeeksWithHistory >= 1) {
    return {
      dataStatus: 'partial',
      freshness: daysSinceLastWorkout !== null && daysSinceLastWorkout <= 14 ? 'fresh' : 'aging',
      confidence: 'medium',
      lastUpdatedAt,
      reliabilityReason: 'הדוח מבוסס על שבוע סגור אחד לפחות',
    };
  }

  if (workoutHistory.length === 0) {
    return {
      dataStatus: 'missing',
      freshness: 'stale',
      confidence: 'low',
      lastUpdatedAt,
      reliabilityReason: 'אין מספיק שבועות מתועדים',
    };
  }

  return {
    dataStatus: 'partial',
    freshness: daysSinceLastWorkout !== null && daysSinceLastWorkout <= 14 ? 'aging' : 'stale',
    confidence: 'low',
    lastUpdatedAt,
    reliabilityReason: 'אין מספיק היסטוריה כדי להעריך עקביות ברמת ביטחון גבוהה',
  };
};

const getReason = (
  weeklyTarget: number,
  confidence: WorkoutConsistencyConfidence,
  workoutHistory: SavedWorkoutSession[]
) => {
  if (weeklyTarget <= 0) {
    return 'אין כרגע תוכנית אימונים פעילה, ולכן אי אפשר לחשב עקביות שבועית.';
  }

  if (!Array.isArray(workoutHistory) || workoutHistory.length === 0) {
    return 'אין עדיין היסטוריית אימונים שמורה, ולכן המדד הראשוני מוגבל.';
  }

  if (confidence === 'low') {
    return 'יש מעט היסטוריית אימונים, ולכן כדאי להתייחס למדד בזהירות.';
  }

  if (confidence === 'medium') {
    return 'יש כבר לפחות שבוע סגור אחד להשוואה, כך שהמדד מתחיל להיות יציב.';
  }

  return 'יש מספיק היסטוריית אימונים כדי להעריך את רמת העקביות בצורה אמינה יותר.';
};

export const calculateWorkoutConsistency = (
  workoutProgram: WorkoutProgram | null | undefined,
  workoutHistory: SavedWorkoutSession[],
  currentDate?: string | Date
): WorkoutConsistencyResult => {
  const weeklyTarget = getWeeklyWorkoutTarget(workoutProgram);
  const previousWeekRange = getPreviousWeekRange(currentDate);
  const currentWeekRange = getCurrentWeekRange(currentDate);
  const lastWeekCompleted = countCompletedWorkoutsInDateRange(workoutHistory, previousWeekRange);
  const currentWeekCompleted = countCompletedWorkoutsInDateRange(workoutHistory, currentWeekRange);
  const expectedSoFar = calculateExpectedWorkoutsSoFar(weeklyTarget, currentDate);
  const percentage = weeklyTarget > 0 ? Math.round((lastWeekCompleted / weeklyTarget) * 100) : 0;
  const confidence = getConfidence(weeklyTarget, workoutHistory, currentDate);
  const reliability = getReliability(weeklyTarget, workoutHistory, currentDate);

  return {
    weeklyTarget,
    lastWeek: {
      completed: lastWeekCompleted,
      percentage,
      status: getLastWeekStatus(percentage),
    },
    currentWeek: {
      completed: currentWeekCompleted,
      expectedSoFar,
      paceStatus: getPaceStatus(currentWeekCompleted, expectedSoFar),
    },
    confidence,
    reason: getReason(weeklyTarget, confidence, workoutHistory),
    hasActiveProgram: weeklyTarget > 0,
    reliability,
  };
};
