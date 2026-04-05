import { calculateExerciseProgress, getExerciseOccurrencesFromWorkoutHistory } from '@/lib/exerciseProgress';
import type { GoalKPIStatusResult } from '@/lib/goalKpiStatus';
import type { GoalType } from '@/lib/goalDefinitions';
import type { NutritionAdherenceResult } from '@/lib/nutritionAdherence';
import { calculateNutritionAdherence } from '@/lib/nutritionAdherence';
import type { ProfileForProgress, ProgressStatusResult, WeightTrendSummaryResult } from '@/lib/progressStatus';
import { summarizeWeightTrend } from '@/lib/progressStatus';
import type { RecommendationContext } from '@/lib/recommendationContext';
import type { RenderedRecommendation } from '@/lib/recommendationRenderer';
import type { SavedNutritionLog } from '@/lib/repositories/nutritionLogRepository';
import {
  createWeeklyGoalSnapshot as createWeeklyGoalSnapshotRecord,
  finalizeWeeklyGoalSnapshot as finalizeWeeklyGoalSnapshotRecord,
  findPendingWeeklyGoalSnapshotsBeforeWeekStart,
  findWeeklyGoalSnapshotByUserAndWeekStart,
} from '@/lib/repositories/weeklyGoalSnapshotRepository';
import type { SavedWorkoutSession } from '@/lib/repositories/workoutSessionRepository';
import type { WorkoutConsistencyResult } from '@/lib/workoutConsistency';
import { countCompletedWorkoutsInDateRange } from '@/lib/workoutConsistency';
import type {
  CreateWeeklyGoalSnapshotInput,
  WeeklyGoalActuals,
  WeeklyGoalOutcomes,
  WeeklyGoalSnapshot,
  WeeklyGoalTargets,
} from '@/lib/weeklyGoalSnapshots';
import { getCurrentWeekRange, getWeeklyDecisionWindow, isDateInRange } from '@/lib/weeklyDate';

type WeeklySnapshotRuntimeInput = {
  userId: string;
  goal: GoalType;
  recommendation: RenderedRecommendation;
  recommendationContext: RecommendationContext;
  progressStatus: ProgressStatusResult;
  nutritionAdherence: NutritionAdherenceResult;
  goalKpiStatus: GoalKPIStatusResult;
  workoutConsistency: WorkoutConsistencyResult;
  bodyweightLogs: Array<{ date: string; weight: number }>;
  nutritionLogs: SavedNutritionLog[];
  workoutSessions: SavedWorkoutSession[];
  profile: ProfileForProgress | null;
  currentDate?: string | Date;
};

const NUTRITION_TARGET_DAYS = 5;
const DECLINE_THRESHOLD = -3;
const IMPROVEMENT_THRESHOLD = 3;
const PLATEAU_THRESHOLD = 2;

type FocusExerciseCandidate = {
  exerciseName: string;
  deltaPercentage: number;
};

const filterWorkoutSessionsInRange = (
  workoutSessions: SavedWorkoutSession[],
  range: { startOfWeek: string; endOfWeek: string }
) => workoutSessions.filter((session) => isDateInRange(session.date, range));

const filterBodyweightLogsUpToDate = (
  bodyweightLogs: Array<{ date: string; weight: number }>,
  endDate: string
) => bodyweightLogs.filter((log) => String(log.date || '').slice(0, 10) <= endDate);

const getFocusExerciseCandidates = (
  workoutSessions: SavedWorkoutSession[],
  currentDate?: string | Date
) => {
  const decisionWindow = getWeeklyDecisionWindow(currentDate);
  const sessionsInDecisionWindow = workoutSessions.filter((session) => isDateInRange(session.date, decisionWindow));
  const exerciseNames = Array.from(
    new Set(
      sessionsInDecisionWindow.flatMap((session) =>
        (session.exercises || []).map((exercise) => String(exercise.exerciseName || '').trim()).filter(Boolean)
      )
    )
  );

  const declining: FocusExerciseCandidate[] = [];
  const plateau: FocusExerciseCandidate[] = [];
  const improving: FocusExerciseCandidate[] = [];

  for (const exerciseName of exerciseNames) {
    const occurrences = getExerciseOccurrencesFromWorkoutHistory(exerciseName, sessionsInDecisionWindow);
    if (occurrences.length < 3) {
      continue;
    }

    const firstScore = occurrences[0]?.bestSet.adjustedScore ?? 0;
    const lastScore = occurrences[occurrences.length - 1]?.bestSet.adjustedScore ?? 0;
    if (!firstScore || !lastScore) {
      continue;
    }

    const deltaPercentage = ((lastScore - firstScore) / firstScore) * 100;
    const candidate = { exerciseName, deltaPercentage };

    if (deltaPercentage <= DECLINE_THRESHOLD) {
      declining.push(candidate);
      continue;
    }

    if (deltaPercentage >= IMPROVEMENT_THRESHOLD) {
      improving.push(candidate);
      continue;
    }

    if (Math.abs(deltaPercentage) <= PLATEAU_THRESHOLD) {
      plateau.push(candidate);
    }
  }

  declining.sort((left, right) => left.deltaPercentage - right.deltaPercentage);
  plateau.sort((left, right) => Math.abs(left.deltaPercentage) - Math.abs(right.deltaPercentage));
  improving.sort((left, right) => right.deltaPercentage - left.deltaPercentage);

  return {
    declining,
    plateau,
    improving,
  };
};

const getSnapshotMetadata = ({
  recommendation,
  recommendationContext,
  goalKpiStatus,
  workoutSessions,
  currentDate,
}: Pick<
  WeeklySnapshotRuntimeInput,
  'recommendation' | 'recommendationContext' | 'goalKpiStatus' | 'workoutSessions' | 'currentDate'
>) => {
  const focusCandidates = getFocusExerciseCandidates(workoutSessions, currentDate);
  const topDecliningExercise = focusCandidates.declining[0]?.exerciseName ?? null;
  const topPlateauExercise = focusCandidates.plateau[0]?.exerciseName ?? null;
  const topImprovingExercise = focusCandidates.improving[0]?.exerciseName ?? null;

  switch (recommendation.id) {
    case 'weekly_declining_exercise_focus':
      return {
        goalType: 'training_focus' as const,
        focusArea: topDecliningExercise,
        primaryMetric: 'focus_exercise_trend' as const,
        targets: {
          focusExercise: topDecliningExercise ?? undefined,
        } satisfies WeeklyGoalTargets,
      };
    case 'weekly_plateau_break':
      return {
        goalType: 'training_focus' as const,
        focusArea: topPlateauExercise,
        primaryMetric: 'focus_exercise_trend' as const,
        targets: {
          focusExercise: topPlateauExercise ?? undefined,
        } satisfies WeeklyGoalTargets,
      };
    case 'weekly_improving_keep_momentum':
      return {
        goalType: 'training_focus' as const,
        focusArea: topImprovingExercise,
        primaryMetric: 'focus_exercise_trend' as const,
        targets: {
          focusExercise: topImprovingExercise ?? undefined,
        } satisfies WeeklyGoalTargets,
      };
    case 'weekly_consistency_goal':
      return {
        goalType: 'consistency_focus' as const,
        focusArea: 'consistency',
        primaryMetric: 'workouts' as const,
        targets: {
          workoutsPlanned: recommendationContext.weeklyTarget || undefined,
        } satisfies WeeklyGoalTargets,
      };
    case 'weekly_cut_nutrition_discipline':
      return {
        goalType: 'nutrition_focus' as const,
        focusArea: 'protein',
        primaryMetric: 'protein_days' as const,
        targets: {
          proteinDaysTarget: NUTRITION_TARGET_DAYS,
          calorieDaysTarget: NUTRITION_TARGET_DAYS,
        } satisfies WeeklyGoalTargets,
      };
    case 'weekly_bulk_calorie_surplus':
      return {
        goalType: 'nutrition_focus' as const,
        focusArea: 'calories',
        primaryMetric: 'calories_days' as const,
        targets: {
          calorieDaysTarget: NUTRITION_TARGET_DAYS,
        } satisfies WeeklyGoalTargets,
      };
    case 'weekly_weight_stabilize':
      return {
        goalType: 'weight_focus' as const,
        focusArea: 'weight',
        primaryMetric: 'weight_trend' as const,
        targets: {
          weightTrendTarget: 'stable',
        } satisfies WeeklyGoalTargets,
      };
    case 'weekly_off_track_recovery':
      return {
        goalType: 'fallback' as const,
        focusArea: goalKpiStatus.primaryKPI === 'weight_trend' ? 'weight' : 'consistency',
        primaryMetric:
          goalKpiStatus.primaryKPI === 'weight_trend'
            ? ('weight_trend' as const)
            : recommendationContext.weeklyTarget > 0
              ? ('workouts' as const)
              : null,
        targets: {
          ...(goalKpiStatus.primaryKPI === 'weight_trend'
            ? {
                weightTrendTarget:
                  recommendationContext.weightTrend === 'up'
                    ? 'up'
                    : recommendationContext.weightTrend === 'down'
                      ? 'down'
                      : 'stable',
              }
            : {}),
          ...(recommendationContext.weeklyTarget > 0 ? { workoutsPlanned: recommendationContext.weeklyTarget } : {}),
        } satisfies WeeklyGoalTargets,
      };
    default:
      return {
        goalType: 'fallback' as const,
        focusArea: recommendationContext.weeklyTarget > 0 ? 'consistency' : null,
        primaryMetric: recommendationContext.weeklyTarget > 0 ? ('workouts' as const) : null,
        targets: {
          ...(recommendationContext.weeklyTarget > 0 ? { workoutsPlanned: recommendationContext.weeklyTarget } : {}),
        } satisfies WeeklyGoalTargets,
      };
  }
};

const buildCreateInput = (input: WeeklySnapshotRuntimeInput): CreateWeeklyGoalSnapshotInput => {
  const currentWeek = getCurrentWeekRange(input.currentDate);
  const metadata = getSnapshotMetadata(input);

  return {
    userId: input.userId,
    weekStartDate: currentWeek.startOfWeek,
    weekEndDate: currentWeek.endOfWeek,
    goalType: metadata.goalType,
    templateId: input.recommendation.id ?? null,
    title: input.recommendation.title,
    body: input.recommendation.body,
    focusArea: metadata.focusArea,
    primaryMetric: metadata.primaryMetric,
    targets: metadata.targets,
    actuals: {},
    outcomes: {},
    confidence: input.recommendationContext.dataCompletenessScore >= 80
      ? 'high'
      : input.recommendationContext.dataCompletenessScore >= 55
        ? 'medium'
        : 'low',
  };
};

const calculateActualWeightTrend = (
  bodyweightLogs: Array<{ date: string; weight: number }>,
  weekEndDate: string
): WeightTrendSummaryResult['trend'] =>
  summarizeWeightTrend(filterBodyweightLogsUpToDate(bodyweightLogs, weekEndDate), weekEndDate).trend;

const calculateFocusExerciseTrend = (
  focusExercise: string | undefined,
  workoutSessions: SavedWorkoutSession[],
  range: { startOfWeek: string; endOfWeek: string }
) => {
  if (!focusExercise) {
    return undefined;
  }

  const weeklySessions = filterWorkoutSessionsInRange(workoutSessions, range);
  return calculateExerciseProgress(focusExercise, weeklySessions).trend;
};

const calculateActualsForSnapshot = ({
  snapshot,
  goal,
  profile,
  bodyweightLogs,
  nutritionLogs,
  workoutSessions,
}: {
  snapshot: WeeklyGoalSnapshot;
  goal: GoalType;
  profile: ProfileForProgress | null;
  bodyweightLogs: Array<{ date: string; weight: number }>;
  nutritionLogs: SavedNutritionLog[];
  workoutSessions: SavedWorkoutSession[];
}): WeeklyGoalActuals => {
  const weekRange = {
    startOfWeek: snapshot.weekStartDate,
    endOfWeek: snapshot.weekEndDate,
  };
  const nutritionResult = calculateNutritionAdherence({
    goal,
    nutritionLogs,
    profile,
    bodyweightLogs: filterBodyweightLogsUpToDate(bodyweightLogs, snapshot.weekEndDate),
    currentDate: snapshot.weekEndDate,
  });

  return {
    workoutsCompleted: snapshot.targets.workoutsPlanned !== undefined
      ? countCompletedWorkoutsInDateRange(workoutSessions, weekRange)
      : undefined,
    proteinDaysCompleted: snapshot.targets.proteinDaysTarget !== undefined
      ? nutritionResult.proteinDaysMet
      : undefined,
    calorieDaysCompleted: snapshot.targets.calorieDaysTarget !== undefined
      ? nutritionResult.calorieDaysInRange
      : undefined,
    actualWeightTrend: snapshot.targets.weightTrendTarget
      ? calculateActualWeightTrend(bodyweightLogs, snapshot.weekEndDate)
      : undefined,
    focusExerciseTrend: snapshot.targets.focusExercise
      ? calculateFocusExerciseTrend(snapshot.targets.focusExercise, workoutSessions, weekRange)
      : undefined,
  };
};

const calculateOverallOutcome = (values: Array<boolean | null | undefined>) => {
  const relevant = values.filter((value): value is boolean => typeof value === 'boolean');

  if (relevant.length === 0) {
    return null;
  }

  const metCount = relevant.filter(Boolean).length;
  const notMetCount = relevant.length - metCount;

  if (metCount > notMetCount) {
    return true;
  }

  if (notMetCount > metCount) {
    return false;
  }

  return null;
};

const calculateOutcomesForSnapshot = (
  snapshot: WeeklyGoalSnapshot,
  actuals: WeeklyGoalActuals
): WeeklyGoalOutcomes => {
  const workoutsMet =
    snapshot.targets.workoutsPlanned !== undefined && actuals.workoutsCompleted !== undefined
      ? actuals.workoutsCompleted >= snapshot.targets.workoutsPlanned
      : undefined;
  const proteinMet =
    snapshot.targets.proteinDaysTarget !== undefined && actuals.proteinDaysCompleted !== undefined
      ? actuals.proteinDaysCompleted >= snapshot.targets.proteinDaysTarget
      : undefined;
  const caloriesMet =
    snapshot.targets.calorieDaysTarget !== undefined && actuals.calorieDaysCompleted !== undefined
      ? actuals.calorieDaysCompleted >= snapshot.targets.calorieDaysTarget
      : undefined;
  const weightGoalMet =
    snapshot.targets.weightTrendTarget && actuals.actualWeightTrend
      ? actuals.actualWeightTrend === snapshot.targets.weightTrendTarget
      : undefined;
  const focusGoalMet =
    snapshot.targets.focusExercise
      ? actuals.focusExerciseTrend === 'up'
      : undefined;

  return {
    workoutsMet,
    proteinMet,
    caloriesMet,
    weightGoalMet,
    focusGoalMet,
    overallMet: calculateOverallOutcome([
      workoutsMet ?? null,
      proteinMet ?? null,
      caloriesMet ?? null,
      weightGoalMet ?? null,
      focusGoalMet ?? null,
    ]),
  };
};

export const getWeeklyGoalSnapshotForCurrentWeek = async (
  userId: string,
  currentDate?: string | Date
) => {
  const currentWeek = getCurrentWeekRange(currentDate);
  return findWeeklyGoalSnapshotByUserAndWeekStart(userId, currentWeek.startOfWeek);
};

export const createWeeklyGoalSnapshot = async (input: WeeklySnapshotRuntimeInput) => {
  const currentWeek = getCurrentWeekRange(input.currentDate);
  const existing = await findWeeklyGoalSnapshotByUserAndWeekStart(input.userId, currentWeek.startOfWeek);

  if (existing) {
    return existing;
  }

  const createInput = buildCreateInput(input);

  try {
    return await createWeeklyGoalSnapshotRecord(createInput);
  } catch (error) {
    const existingAfterConflict = await findWeeklyGoalSnapshotByUserAndWeekStart(
      input.userId,
      currentWeek.startOfWeek
    );

    if (existingAfterConflict) {
      return existingAfterConflict;
    }

    throw error;
  }
};

export const finalizeWeeklyGoalSnapshot = async ({
  snapshot,
  goal,
  profile,
  bodyweightLogs,
  nutritionLogs,
  workoutSessions,
}: {
  snapshot: WeeklyGoalSnapshot;
  goal: GoalType;
  profile: ProfileForProgress | null;
  bodyweightLogs: Array<{ date: string; weight: number }>;
  nutritionLogs: SavedNutritionLog[];
  workoutSessions: SavedWorkoutSession[];
}) => {
  if (snapshot.finalizedAt) {
    return snapshot;
  }

  const actuals = calculateActualsForSnapshot({
    snapshot,
    goal,
    profile,
    bodyweightLogs,
    nutritionLogs,
    workoutSessions,
  });
  const outcomes = calculateOutcomesForSnapshot(snapshot, actuals);

  return finalizeWeeklyGoalSnapshotRecord(snapshot.id, {
    actuals,
    outcomes,
    finalizedAt: new Date().toISOString(),
  });
};

export const finalizePendingWeeklyGoalSnapshots = async ({
  userId,
  goal,
  profile,
  bodyweightLogs,
  nutritionLogs,
  workoutSessions,
  currentDate,
}: Pick<
  WeeklySnapshotRuntimeInput,
  'userId' | 'goal' | 'profile' | 'bodyweightLogs' | 'nutritionLogs' | 'workoutSessions' | 'currentDate'
>) => {
  const currentWeek = getCurrentWeekRange(currentDate);
  const pendingSnapshots = await findPendingWeeklyGoalSnapshotsBeforeWeekStart(
    userId,
    currentWeek.startOfWeek
  );

  if (pendingSnapshots.length === 0) {
    return [];
  }

  const finalized: WeeklyGoalSnapshot[] = [];
  for (const snapshot of pendingSnapshots) {
    finalized.push(
      await finalizeWeeklyGoalSnapshot({
        snapshot,
        goal,
        profile,
        bodyweightLogs,
        nutritionLogs,
        workoutSessions,
      })
    );
  }

  return finalized;
};

export const syncCurrentWeeklyGoalSnapshot = async (input: WeeklySnapshotRuntimeInput) => {
  await finalizePendingWeeklyGoalSnapshots(input);
  return createWeeklyGoalSnapshot(input);
};
