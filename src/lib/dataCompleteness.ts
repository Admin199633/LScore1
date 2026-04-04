import { diffDaysFromCurrentDate, getLatestDate } from './dataReliability';
import {
  getWeeklyWorkoutTarget,
  getCurrentWeekRange,
  countCompletedWorkoutsInDateRange,
  calculateExpectedWorkoutsSoFar,
} from './workoutConsistency';
import type { WorkoutProgram } from './repositories/programRepository';
import type { SavedWorkoutSession } from './repositories/workoutSessionRepository';
import type { SavedNutritionLog } from './repositories/nutritionLogRepository';

// ─── Types ────────────────────────────────────────────────────────────────────

type DataStatus = 'good' | 'partial' | 'missing';
type OverallStatus = 'complete' | 'partial' | 'poor';
type GapSeverity = 'high' | 'medium';
type GapType = 'weight' | 'nutrition' | 'workout';
type InternalHref = '/home' | '/nutrition' | '/workout' | '/profile';

export type DataGap = {
  type: GapType;
  severity: GapSeverity;
  message: string;
  cta: { label: string; href: InternalHref };
};

export type DataCompletenessResult = {
  overallStatus: OverallStatus;
  score: number; // 0–100
  gaps: DataGap[];
  breakdown: {
    weight: {
      status: DataStatus;
      lastUpdatedAt: string | null;
      missingDays: number | null;
    };
    nutrition: {
      status: DataStatus;
      lastUpdatedAt: string | null;
      documentedDaysLast7: number;
      missingRecentDays: number;
    };
    workout: {
      status: DataStatus;
      lastUpdatedAt: string | null;
      weeklyTarget: number;
      completedThisWeek: number;
      expectedSoFar: number;
    };
  };
};

export type DataCompletenessInput = {
  bodyweightLogs: Array<{ date: string; weight: number }>;
  nutritionLogs: Array<{ date: string }>;
  workoutSessions: SavedWorkoutSession[];
  workoutProgram: WorkoutProgram | null;
  currentDate?: string | Date;
};

// ─── Score table ──────────────────────────────────────────────────────────────

const STATUS_SCORE: Record<DataStatus, number> = { good: 100, partial: 60, missing: 20 };

// ─── Weight ───────────────────────────────────────────────────────────────────

const evaluateWeight = (
  bodyweightLogs: Array<{ date: string }>,
  currentDate?: string | Date
): DataCompletenessResult['breakdown']['weight'] & { status: DataStatus } => {
  const lastUpdatedAt = getLatestDate(bodyweightLogs.map((l) => l.date));
  const missingDays = diffDaysFromCurrentDate(lastUpdatedAt, currentDate);

  let status: DataStatus;
  if (missingDays === null || missingDays > 6) {
    status = 'missing';
  } else if (missingDays > 3) {
    status = 'partial';
  } else {
    status = 'good';
  }

  return { status, lastUpdatedAt, missingDays };
};

// ─── Nutrition ────────────────────────────────────────────────────────────────

const evaluateNutrition = (
  nutritionLogs: Array<{ date: string }>,
  currentDate?: string | Date
): DataCompletenessResult['breakdown']['nutrition'] & { status: DataStatus } => {
  const today = currentDate
    ? new Date(currentDate)
    : new Date();
  const todayStr = today.toISOString().slice(0, 10);

  // Build set of last-7-day date strings
  const last7Dates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    return d.toISOString().slice(0, 10);
  });

  const loggedDates = new Set(nutritionLogs.map((l) => l.date));
  const documentedDaysLast7 = last7Dates.filter((d) => loggedDates.has(d)).length;

  // Count consecutive missing days going backwards from today
  let missingRecentDays = 0;
  for (const d of last7Dates) {
    if (loggedDates.has(d)) break;
    missingRecentDays += 1;
  }

  const lastUpdatedAt = getLatestDate(nutritionLogs.map((l) => l.date));
  const hasRecentLog = loggedDates.has(todayStr) || loggedDates.has(last7Dates[1]);

  let status: DataStatus;
  if (documentedDaysLast7 >= 6 && hasRecentLog) {
    status = 'good';
  } else if (documentedDaysLast7 >= 4) {
    status = 'partial';
  } else {
    status = 'missing';
  }

  return { status, lastUpdatedAt, documentedDaysLast7, missingRecentDays };
};

// ─── Workout ──────────────────────────────────────────────────────────────────

const evaluateWorkout = (
  workoutSessions: SavedWorkoutSession[],
  workoutProgram: WorkoutProgram | null,
  currentDate?: string | Date
): DataCompletenessResult['breakdown']['workout'] & { status: DataStatus } => {
  const lastUpdatedAt = getLatestDate(workoutSessions.map((s) => s.date));
  const weeklyTarget = getWeeklyWorkoutTarget(workoutProgram);

  if (!workoutProgram || weeklyTarget === 0) {
    return {
      status: 'missing',
      lastUpdatedAt,
      weeklyTarget: 0,
      completedThisWeek: 0,
      expectedSoFar: 0,
    };
  }

  const currentWeekRange = getCurrentWeekRange(currentDate);
  const completedThisWeek = countCompletedWorkoutsInDateRange(workoutSessions, currentWeekRange);
  const expectedSoFar = calculateExpectedWorkoutsSoFar(weeklyTarget, currentDate);

  const gap = expectedSoFar - completedThisWeek;
  let status: DataStatus;
  if (gap <= 0) {
    status = 'good';
  } else if (gap === 1) {
    status = 'partial';
  } else {
    status = 'missing';
  }

  return { status, lastUpdatedAt, weeklyTarget, completedThisWeek, expectedSoFar };
};

// ─── Gaps ─────────────────────────────────────────────────────────────────────

const buildWeightGap = (
  w: DataCompletenessResult['breakdown']['weight'] & { status: DataStatus }
): DataGap | null => {
  if (w.status === 'good') return null;
  const days = w.missingDays;
  const message =
    w.status === 'missing'
      ? days !== null ? `לא הזנת משקל כבר ${days} ימים` : 'אין נתוני משקל עדכניים'
      : `לא הזנת משקל כבר ${days} ימים`;
  return {
    type: 'weight',
    severity: w.status === 'missing' ? 'high' : 'medium',
    message,
    cta: { label: 'הזן משקל', href: '/home' },
  };
};

const buildNutritionGap = (
  n: DataCompletenessResult['breakdown']['nutrition'] & { status: DataStatus }
): DataGap | null => {
  if (n.status === 'good') return null;
  const message =
    n.status === 'missing'
      ? 'כמעט ואין נתוני תזונה בשבוע האחרון'
      : n.missingRecentDays >= 2
        ? `חסרים נתוני תזונה מ-${n.missingRecentDays} הימים האחרונים`
        : 'חסרים נתוני תזונה מהיומיים האחרונים';
  return {
    type: 'nutrition',
    severity: n.status === 'missing' ? 'high' : 'medium',
    message,
    cta: { label: 'עדכן תזונה', href: '/nutrition' },
  };
};

const buildWorkoutGap = (
  w: DataCompletenessResult['breakdown']['workout'] & { status: DataStatus }
): DataGap | null => {
  if (w.status === 'good') return null;
  if (w.weeklyTarget === 0) {
    return {
      type: 'workout',
      severity: 'high',
      message: 'אין תוכנית אימונים פעילה',
      cta: { label: 'הגדר תוכנית', href: '/profile' },
    };
  }
  const message =
    w.status === 'missing'
      ? 'חסרים אימונים מתועדים השבוע'
      : 'חסר תיעוד של אימון אחד כדי להיות בקצב';
  return {
    type: 'workout',
    severity: w.status === 'missing' ? 'high' : 'medium',
    message,
    cta: { label: 'התחל אימון', href: '/workout' },
  };
};

const SEVERITY_ORDER: Record<GapSeverity, number> = { high: 0, medium: 1 };

const sortGaps = (gaps: DataGap[]): DataGap[] =>
  [...gaps].sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);

// ─── Overall ──────────────────────────────────────────────────────────────────

const calcOverallStatus = (statuses: DataStatus[]): OverallStatus => {
  const missingCount = statuses.filter((s) => s === 'missing').length;
  if (missingCount >= 2) return 'poor';
  if (missingCount === 1 || statuses.some((s) => s === 'partial')) return 'partial';
  return 'complete';
};

const calcScore = (statuses: DataStatus[]): number => {
  const total = statuses.reduce((sum, s) => sum + STATUS_SCORE[s], 0);
  return Math.round(total / statuses.length);
};

// ─── Main ─────────────────────────────────────────────────────────────────────

export const calculateDataCompleteness = (
  input: DataCompletenessInput
): DataCompletenessResult => {
  const { bodyweightLogs, nutritionLogs, workoutSessions, workoutProgram, currentDate } = input;

  const weight   = evaluateWeight(bodyweightLogs, currentDate);
  const nutrition = evaluateNutrition(nutritionLogs, currentDate);
  const workout  = evaluateWorkout(workoutSessions, workoutProgram, currentDate);

  const statuses: DataStatus[] = [weight.status, nutrition.status, workout.status];

  const rawGaps = [
    buildWeightGap(weight),
    buildNutritionGap(nutrition),
    buildWorkoutGap(workout),
  ].filter((g): g is DataGap => g !== null);

  return {
    overallStatus: calcOverallStatus(statuses),
    score: calcScore(statuses),
    gaps: sortGaps(rawGaps),
    breakdown: { weight, nutrition, workout },
  };
};
