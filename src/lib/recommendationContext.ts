import type { GoalType } from './goalDefinitions';
import type { ProgressStatusResult } from './progressStatus';
import type { NutritionAdherenceResult } from './nutritionAdherence';
import type { TrainingLoadResult } from './trainingLoad';
import type { GoalKPIStatusResult } from './goalKpiStatus';
import type { WorkoutConsistencyResult } from './workoutConsistency';
import type { DataCompletenessResult } from './dataCompleteness';
import type { SavedWorkoutSession } from './repositories/workoutSessionRepository';
import type { WorkoutProgram } from './repositories/programRepository';

// ─── Context Type ─────────────────────────────────────────────────────────────

export type RecommendationContext = {
  // Profile
  goal: GoalType;
  goalLabel: string;

  // Today's workout
  todayIsWorkoutDay: boolean;
  todayWorkoutDone: boolean;
  todayWorkoutName: string | null;

  // Exercise performance
  exerciseTrend: 'up' | 'stable' | 'down' | 'insufficient_data';
  hasDecliningExercise: boolean;
  hasPlateauExercise: boolean;
  hasImprovingExercise: boolean;
  exerciseDownCount: number;
  exerciseUpCount: number;

  // Nutrition
  nutritionStatus: 'good' | 'partial' | 'poor' | 'insufficient_data';
  hasTodayNutritionLog: boolean;

  // Weight
  weightTrend: 'up' | 'stable' | 'down' | 'insufficient_data';
  goalKpiNegative: boolean;
  hasTodayWeight: boolean;

  // Workout consistency
  consistencyRatio: number | null;
  hasConsistencyIssue: boolean;
  weeklyTarget: number;
  completedThisWeek: number;
  lastWeekCompleted: number;

  // Fatigue
  fatigueDetected: boolean;

  // Progress
  progressStatusLevel: 'on_track' | 'partial' | 'off_track' | 'insufficient_data';

  // Data completeness
  dataCompletenessScore: number;
  topGapType: 'weight' | 'nutrition' | 'workout' | null;
  topGapSeverity: 'high' | 'medium' | null;
  hasHighGap: boolean;
};

// ─── Input Type ───────────────────────────────────────────────────────────────

export type BuildContextInput = {
  goal: GoalType;
  progressStatus: ProgressStatusResult;
  nutritionAdherence: NutritionAdherenceResult;
  trainingLoad: TrainingLoadResult;
  goalKpiStatus: GoalKPIStatusResult;
  workoutConsistency: WorkoutConsistencyResult;
  dataCompleteness: DataCompletenessResult;
  workoutSessions: SavedWorkoutSession[];
  workoutProgram: WorkoutProgram;
  hasTodayNutritionLog: boolean;
  hasTodayWeight: boolean;
  todayWorkoutDone: boolean;
  currentDate?: string;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const GOAL_LABELS: Partial<Record<GoalType, string>> = {
  bulk: 'מסה',
  cut: 'חיטוב',
  maintain: 'שמירה',
};

/**
 * Returns true if today's day-of-week appears at least twice in the last 6 weeks
 * of session history — indicating the user typically trains on this day.
 */
const deriveTodayIsWorkoutDay = (
  sessions: { date: string }[],
  currentDate?: string
): boolean => {
  const today = currentDate ? new Date(currentDate) : new Date();
  const todayDOW = today.getDay();
  const cutoff = new Date(today);
  cutoff.setDate(today.getDate() - 42);

  const countByDOW: Record<number, number> = {};
  for (const s of sessions) {
    const d = new Date(s.date);
    if (d >= cutoff) {
      const dow = d.getDay();
      countByDOW[dow] = (countByDOW[dow] ?? 0) + 1;
    }
  }
  return (countByDOW[todayDOW] ?? 0) >= 2;
};

/**
 * Returns the next program day name in the rotation after the most-recently
 * completed day. Falls back to the first day if history is empty or unmatched.
 */
const getNextWorkoutName = (
  workoutProgram: WorkoutProgram,
  workoutSessions: { date: string; dayName: string }[]
): string | null => {
  const days = workoutProgram.days ?? [];
  if (days.length === 0) return null;

  const sorted = [...workoutSessions].sort((a, b) => b.date.localeCompare(a.date));
  const lastDayName = sorted[0]?.dayName ?? null;
  if (!lastDayName) return days[0]?.name ?? null;

  const lastIndex = days.findIndex((d) => d.name === lastDayName);
  const nextIndex = lastIndex === -1 ? 0 : (lastIndex + 1) % days.length;
  return days[nextIndex]?.name ?? null;
};

// ─── Builder ──────────────────────────────────────────────────────────────────

export const buildRecommendationContext = (input: BuildContextInput): RecommendationContext => {
  const {
    goal, progressStatus, nutritionAdherence, trainingLoad,
    goalKpiStatus, workoutConsistency, dataCompleteness,
    workoutSessions, workoutProgram,
    hasTodayNutritionLog, hasTodayWeight, todayWorkoutDone, currentDate,
  } = input;

  const ex = progressStatus.breakdown.exercise;
  const exerciseTrend = ex.trend;
  const hasDecliningExercise = exerciseTrend === 'down' || ex.downCount > 0;
  const hasPlateauExercise =
    exerciseTrend === 'stable' && ex.validExercisesCount >= 2 && ex.downCount === 0;
  const hasImprovingExercise = exerciseTrend === 'up' || ex.upCount > 0;

  const nutritionStatus = nutritionAdherence.status as RecommendationContext['nutritionStatus'];

  const weightTrend = progressStatus.breakdown.weight;
  const goalKpiNegative = goalKpiStatus.status === 'negative';

  const weeklyTarget = workoutConsistency.weeklyTarget;
  const lastWeekCompleted = workoutConsistency.lastWeek?.completed ?? 0;
  const consistencyRatio = weeklyTarget > 0 ? lastWeekCompleted / weeklyTarget : null;
  const hasConsistencyIssue = consistencyRatio !== null && consistencyRatio < 0.7;

  const fatigueDetected =
    trainingLoad.status === 'high_load' && trainingLoad.confidence !== 'low';

  const topGap = dataCompleteness.gaps[0] ?? null;

  const todayIsWorkoutDay =
    !todayWorkoutDone && deriveTodayIsWorkoutDay(workoutSessions, currentDate);

  return {
    goal,
    goalLabel: GOAL_LABELS[goal] ?? 'מטרה',
    todayIsWorkoutDay,
    todayWorkoutDone,
    todayWorkoutName: getNextWorkoutName(workoutProgram, workoutSessions),
    exerciseTrend,
    hasDecliningExercise,
    hasPlateauExercise,
    hasImprovingExercise,
    exerciseDownCount: ex.downCount,
    exerciseUpCount: ex.upCount,
    nutritionStatus,
    hasTodayNutritionLog,
    weightTrend,
    goalKpiNegative,
    hasTodayWeight,
    consistencyRatio,
    hasConsistencyIssue,
    weeklyTarget,
    completedThisWeek: workoutConsistency.currentWeek?.completed ?? 0,
    lastWeekCompleted,
    fatigueDetected,
    progressStatusLevel: progressStatus.status,
    dataCompletenessScore: dataCompleteness.score,
    topGapType: topGap?.type ?? null,
    topGapSeverity: topGap?.severity ?? null,
    hasHighGap: topGap?.severity === 'high',
  };
};
