import { getExerciseOccurrencesFromWorkoutHistory } from '@/lib/exerciseProgress';
import type { GoalKPIStatusResult } from '@/lib/goalKpiStatus';
import type { GoalType } from '@/lib/goalDefinitions';
import type { NutritionAdherenceResult } from '@/lib/nutritionAdherence';
import type { ProgressStatusResult } from '@/lib/progressStatus';
import type { RecommendationContext } from '@/lib/recommendationContext';
import { renderRecommendationTemplate, type RenderedRecommendation } from '@/lib/recommendationRenderer';
import type { SavedNutritionLog } from '@/lib/repositories/nutritionLogRepository';
import type { SavedWorkoutSession } from '@/lib/repositories/workoutSessionRepository';
import { WEEKLY_FALLBACK, WEEKLY_TEMPLATES } from '@/lib/recommendationTemplates.weekly';
import type { WorkoutConsistencyResult } from '@/lib/workoutConsistency';
import { getWeeklyDecisionWindow, isDateInRange } from '@/lib/weeklyDate';

type WeeklyRecommendationEngineInput = {
  goal: GoalType;
  recommendationContext: RecommendationContext;
  progressStatus: ProgressStatusResult;
  nutritionAdherence: NutritionAdherenceResult;
  goalKpiStatus: GoalKPIStatusResult;
  workoutConsistency: WorkoutConsistencyResult;
  bodyweightLogs: Array<{ date: string; weight: number }>;
  nutritionLogs: SavedNutritionLog[];
  workoutSessions: SavedWorkoutSession[];
  currentDate?: string | Date;
};

type WeeklySignalSummary = {
  hasDeclineSignal: boolean;
  hasPlateauSignal: boolean;
  hasConsistencySignal: boolean;
  hasNutritionSignal: boolean;
  hasWeightSignal: boolean;
  hasImprovingSignal: boolean;
  strongSignalCount: number;
};

const MIN_EXERCISE_OCCURRENCES_IN_WINDOW = 3;
const MIN_WEIGHT_LOGS_IN_WINDOW = 3;
const MIN_NUTRITION_LOGS_IN_WINDOW = 4;
const MIN_NUTRITION_LOGS_FOR_PARTIAL_SIGNAL = 6;
const DECLINE_THRESHOLD = -3;
const IMPROVEMENT_THRESHOLD = 3;
const PLATEAU_THRESHOLD = 2;

const getTemplateById = (id: string) =>
  WEEKLY_TEMPLATES.find((template) => template.id === id) ?? WEEKLY_FALLBACK;

const buildVariables = (ctx: RecommendationContext) => ({
  goalLabel: ctx.goalLabel,
  weeklyTarget: String(ctx.weeklyTarget),
  lastWeekCompleted: String(ctx.lastWeekCompleted),
  completedThisWeek: String(ctx.completedThisWeek),
  todayWorkoutName: ctx.todayWorkoutName ?? '',
  exerciseDownCount: String(ctx.exerciseDownCount),
  consistencyPct:
    ctx.consistencyRatio !== null
      ? `${Math.round(ctx.consistencyRatio * 100)}%`
      : '',
});

const getWindowedSessions = (
  workoutSessions: SavedWorkoutSession[],
  currentDate?: string | Date
) => {
  const decisionWindow = getWeeklyDecisionWindow(currentDate);
  return {
    decisionWindow,
    sessions: workoutSessions.filter((session) => isDateInRange(session.date, decisionWindow)),
  };
};

const getExerciseSignalSummary = (
  workoutSessions: SavedWorkoutSession[],
  currentDate?: string | Date
) => {
  const { sessions } = getWindowedSessions(workoutSessions, currentDate);
  const exerciseNames = Array.from(
    new Set(
      sessions.flatMap((session) =>
        (session.exercises || []).map((exercise) => String(exercise.exerciseName || '').trim()).filter(Boolean)
      )
    )
  );

  let declineCount = 0;
  let plateauCount = 0;
  let improvingCount = 0;

  for (const exerciseName of exerciseNames) {
    const windowOccurrences = getExerciseOccurrencesFromWorkoutHistory(exerciseName, sessions);

    if (windowOccurrences.length < MIN_EXERCISE_OCCURRENCES_IN_WINDOW) {
      continue;
    }

    const firstScore = windowOccurrences[0]?.bestSet.adjustedScore ?? 0;
    const lastScore = windowOccurrences[windowOccurrences.length - 1]?.bestSet.adjustedScore ?? 0;

    if (!firstScore || !lastScore) {
      continue;
    }

    const deltaPercentage = ((lastScore - firstScore) / firstScore) * 100;

    if (deltaPercentage <= DECLINE_THRESHOLD) {
      declineCount += 1;
      continue;
    }

    if (deltaPercentage >= IMPROVEMENT_THRESHOLD) {
      improvingCount += 1;
      continue;
    }

    if (Math.abs(deltaPercentage) <= PLATEAU_THRESHOLD) {
      plateauCount += 1;
    }
  }

  return {
    declineCount,
    plateauCount,
    improvingCount,
  };
};

const buildWeeklySignals = ({
  goal,
  progressStatus,
  nutritionAdherence,
  goalKpiStatus,
  workoutConsistency,
  bodyweightLogs,
  nutritionLogs,
  workoutSessions,
  currentDate,
}: Omit<WeeklyRecommendationEngineInput, 'recommendationContext'>): WeeklySignalSummary => {
  const exerciseSignals = getExerciseSignalSummary(workoutSessions, currentDate);
  const decisionWindow = getWeeklyDecisionWindow(currentDate);
  const weightLogsInWindow = bodyweightLogs.filter((log) => isDateInRange(log.date, decisionWindow));
  const nutritionLogsInWindow = nutritionLogs.filter((log) => isDateInRange(log.date, decisionWindow));
  const lastWeekRatio =
    workoutConsistency.weeklyTarget > 0
      ? workoutConsistency.lastWeek.completed / workoutConsistency.weeklyTarget
      : null;

  const hasDeclineSignal = exerciseSignals.declineCount >= 1;
  const hasPlateauSignal =
    !hasDeclineSignal &&
    exerciseSignals.plateauCount >= 1 &&
    progressStatus.breakdown.exercise.trend !== 'insufficient_data';
  const hasConsistencySignal =
    workoutConsistency.weeklyTarget > 0 &&
    lastWeekRatio !== null &&
    lastWeekRatio < 0.7 &&
    workoutConsistency.reliability.confidence !== 'low';
  const hasNutritionSignal =
    nutritionAdherence.status === 'poor'
      ? nutritionLogsInWindow.length >= MIN_NUTRITION_LOGS_IN_WINDOW
      : nutritionAdherence.status === 'partial' && goal === 'cut'
        ? nutritionLogsInWindow.length >= MIN_NUTRITION_LOGS_FOR_PARTIAL_SIGNAL
        : false;
  const hasWeightSignal =
    goalKpiStatus.status === 'negative' &&
    weightLogsInWindow.length >= MIN_WEIGHT_LOGS_IN_WINDOW &&
    goalKpiStatus.confidence !== 'low';
  const hasImprovingSignal =
    !hasDeclineSignal &&
    !hasPlateauSignal &&
    exerciseSignals.improvingCount >= 1 &&
    progressStatus.status === 'on_track';

  const strongSignalCount = [
    hasDeclineSignal,
    hasPlateauSignal,
    hasConsistencySignal,
    hasNutritionSignal,
    hasWeightSignal,
  ].filter(Boolean).length;

  return {
    hasDeclineSignal,
    hasPlateauSignal,
    hasConsistencySignal,
    hasNutritionSignal,
    hasWeightSignal,
    hasImprovingSignal,
    strongSignalCount,
  };
};

const selectStableWeeklyTemplate = (
  input: Omit<WeeklyRecommendationEngineInput, 'recommendationContext'>,
  signals: WeeklySignalSummary
) => {
  if (signals.hasDeclineSignal) {
    return getTemplateById('weekly_declining_exercise_focus');
  }

  if (signals.hasPlateauSignal) {
    return getTemplateById('weekly_plateau_break');
  }

  if (input.progressStatus.status === 'off_track' && signals.strongSignalCount >= 2) {
    return getTemplateById('weekly_off_track_recovery');
  }

  if (signals.hasConsistencySignal) {
    return getTemplateById('weekly_consistency_goal');
  }

  if (signals.hasNutritionSignal && input.goal === 'cut') {
    return getTemplateById('weekly_cut_nutrition_discipline');
  }

  if (signals.hasWeightSignal && input.goal === 'bulk') {
    return getTemplateById('weekly_bulk_calorie_surplus');
  }

  if (signals.hasWeightSignal && input.goal === 'maintain') {
    return getTemplateById('weekly_weight_stabilize');
  }

  if (signals.hasImprovingSignal) {
    return getTemplateById('weekly_improving_keep_momentum');
  }

  return WEEKLY_FALLBACK;
};

export const selectStableWeeklyRecommendation = (
  input: WeeklyRecommendationEngineInput
): RenderedRecommendation => {
  const signals = buildWeeklySignals(input);

  const template =
    signals.strongSignalCount === 0
      ? WEEKLY_FALLBACK
      : selectStableWeeklyTemplate(input, signals);

  return renderRecommendationTemplate(template, {
    ...buildVariables(input.recommendationContext),
  });
};
