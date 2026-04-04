import { assessWeightDataQuality, assessWorkoutDataQuality, mapQualityToConfidence } from '@/lib/dataQuality';
import { getExerciseOccurrencesFromWorkoutHistory } from '@/lib/exerciseProgress';
import { getGoalDefinition, normalizeGoalType, type GoalDefinition, type GoalType } from '@/lib/goalDefinitions';
import type { SavedWorkoutSession } from '@/lib/repositories/workoutSessionRepository';

export type GoalKPIStatusValue = 'positive' | 'neutral' | 'negative' | 'insufficient_data';
export type GoalKPIConfidence = 'low' | 'medium' | 'high';
export type GoalKPIDataQuality = 'complete' | 'partial' | 'missing';

export type BaselineMetricSummary = {
  value: number | null;
  sampleCount: number;
  startDate: string | null;
  endDate: string | null;
  metric: 'weight' | 'performance';
};

export type GoalKPIStatusResult = {
  primaryKPI: GoalDefinition['primaryKPI'] | null;
  status: GoalKPIStatusValue;
  confidence: GoalKPIConfidence;
  reason: string;
  dataQuality: GoalKPIDataQuality;
  baselineSummary: {
    weight: BaselineMetricSummary;
    performance: BaselineMetricSummary;
  };
  currentSummary: {
    weight: BaselineMetricSummary;
    performance: BaselineMetricSummary;
  };
};

type WorkoutLike = Pick<SavedWorkoutSession, 'date' | 'startedAt' | 'exercises'>;

const roundValue = (value: number) => Math.round(value * 100) / 100;

const buildMetricSummary = (
  metric: 'weight' | 'performance',
  values: number[],
  dates: string[]
): BaselineMetricSummary => ({
  metric,
  value: values.length ? roundValue(values.reduce((sum, item) => sum + item, 0) / values.length) : null,
  sampleCount: values.length,
  startDate: dates[0] || null,
  endDate: dates[dates.length - 1] || null,
});

const getWeightWindowSummaries = (bodyweightLogs: Array<{ date: string; weight: number }>) => {
  const orderedLogs = [...(bodyweightLogs || [])]
    .filter((item) => Number.isFinite(Number(item?.weight)) && Number(item.weight) > 0 && String(item?.date || '').trim())
    .sort((left, right) => left.date.localeCompare(right.date));

  const baselineLogs = orderedLogs.slice(0, 3);
  const currentLogs = orderedLogs.slice(-3);

  return {
    baseline: buildMetricSummary(
      'weight',
      baselineLogs.map((item) => Number(item.weight)),
      baselineLogs.map((item) => item.date)
    ),
    current: buildMetricSummary(
      'weight',
      currentLogs.map((item) => Number(item.weight)),
      currentLogs.map((item) => item.date)
    ),
  };
};

const getUniqueExerciseNames = (workoutHistory: WorkoutLike[]) =>
  Array.from(
    new Set(
      (workoutHistory || []).flatMap((session) =>
        (session.exercises || []).map((exercise) => String(exercise?.exerciseName || '').trim()).filter(Boolean)
      )
    )
  );

const getPerformanceWindowSummaries = (workoutHistory: WorkoutLike[]) => {
  const exerciseNames = getUniqueExerciseNames(workoutHistory);
  const comparableOccurrences = exerciseNames
    .map((exerciseName) => {
      const occurrences = getExerciseOccurrencesFromWorkoutHistory(exerciseName, workoutHistory as any);

      if (occurrences.length < 2) {
        return null;
      }

      return {
        baselineScore: occurrences[0].bestSet.adjustedScore,
        baselineDate: occurrences[0].date,
        currentScore: occurrences[occurrences.length - 1].bestSet.adjustedScore,
        currentDate: occurrences[occurrences.length - 1].date,
      };
    })
    .filter(
      (
        item
      ): item is {
        baselineScore: number;
        baselineDate: string;
        currentScore: number;
        currentDate: string;
      } => Boolean(item)
    );

  return {
    baseline: buildMetricSummary(
      'performance',
      comparableOccurrences.map((item) => item.baselineScore),
      comparableOccurrences.map((item) => item.baselineDate).sort((left, right) => left.localeCompare(right))
    ),
    current: buildMetricSummary(
      'performance',
      comparableOccurrences.map((item) => item.currentScore),
      comparableOccurrences.map((item) => item.currentDate).sort((left, right) => left.localeCompare(right))
    ),
  };
};

const getDataQuality = ({
  goal,
  weightBaseline,
  currentWeight,
  performanceBaseline,
  currentPerformance,
  weightQuality,
  workoutQuality,
}: {
  goal: GoalType;
  weightBaseline: BaselineMetricSummary;
  currentWeight: BaselineMetricSummary;
  performanceBaseline: BaselineMetricSummary;
  currentPerformance: BaselineMetricSummary;
  weightQuality: ReturnType<typeof assessWeightDataQuality>;
  workoutQuality: ReturnType<typeof assessWorkoutDataQuality>;
}): GoalKPIDataQuality => {
  if (goal === 'cut') {
    if (weightQuality.status === 'invalid') return 'missing';
    return weightQuality.status === 'valid' && weightBaseline.sampleCount >= 2 && currentWeight.sampleCount >= 2
      ? 'complete'
      : 'partial';
  }

  if (goal === 'bulk') {
    if (workoutQuality.status === 'invalid') return 'missing';
    return workoutQuality.status === 'valid' &&
      performanceBaseline.sampleCount >= 2 &&
      currentPerformance.sampleCount >= 2
      ? 'complete'
      : 'partial';
  }

  const weightReady = weightBaseline.sampleCount >= 2 && currentWeight.sampleCount >= 2;
  const performanceReady = performanceBaseline.sampleCount >= 2 && currentPerformance.sampleCount >= 2;

  if (weightQuality.status === 'invalid' && workoutQuality.status === 'invalid') {
    return 'missing';
  }

  if (weightReady && performanceReady && weightQuality.status === 'valid' && workoutQuality.status === 'valid') {
    return 'complete';
  }

  if (weightReady || performanceReady) {
    return 'partial';
  }

  return 'missing';
};

const getConfidence = ({
  dataQuality,
  goal,
  performanceSampleCount,
  weightQuality,
  workoutQuality,
}: {
  dataQuality: GoalKPIDataQuality;
  goal: GoalType;
  performanceSampleCount: number;
  weightQuality: ReturnType<typeof assessWeightDataQuality>;
  workoutQuality: ReturnType<typeof assessWorkoutDataQuality>;
}): GoalKPIConfidence => {
  if (
    dataQuality === 'complete' &&
    weightQuality.status !== 'invalid' &&
    workoutQuality.status !== 'invalid' &&
    (goal !== 'bulk' || performanceSampleCount >= 3)
  ) {
    return 'high';
  }

  if (dataQuality === 'complete' || dataQuality === 'partial') {
    return mapQualityToConfidence(
      goal === 'cut' ? weightQuality : goal === 'bulk' ? workoutQuality : weightQuality.status === 'valid' ? weightQuality : workoutQuality,
      'medium'
    );
  }

  return 'low';
};

const getWeightDeltaPercentage = (baseline: number | null, current: number | null) => {
  if (!baseline || !current) {
    return null;
  }

  return ((current - baseline) / baseline) * 100;
};

const getPerformanceDeltaPercentage = (baseline: number | null, current: number | null) => {
  if (!baseline || !current) {
    return null;
  }

  return ((current - baseline) / baseline) * 100;
};

export const getGoalKPIStatus = ({
  goal,
  bodyweightLogs,
  workoutHistory,
}: {
  goal: GoalType | string | null | undefined;
  bodyweightLogs: Array<{ date: string; weight: number }>;
  workoutHistory: WorkoutLike[];
}): GoalKPIStatusResult => {
  const normalizedGoal = normalizeGoalType(goal);
  const goalDefinition = getGoalDefinition(normalizedGoal);
  const weightQuality = assessWeightDataQuality(bodyweightLogs);
  const workoutQuality = assessWorkoutDataQuality(workoutHistory as SavedWorkoutSession[]);
  const weightSummaries = getWeightWindowSummaries(bodyweightLogs);
  const performanceSummaries = getPerformanceWindowSummaries(workoutHistory);
  const dataQuality = getDataQuality({
    goal: normalizedGoal,
    weightBaseline: weightSummaries.baseline,
    currentWeight: weightSummaries.current,
    performanceBaseline: performanceSummaries.baseline,
    currentPerformance: performanceSummaries.current,
    weightQuality,
    workoutQuality,
  });
  const confidence = getConfidence({
    dataQuality,
    goal: normalizedGoal,
    performanceSampleCount: performanceSummaries.current.sampleCount,
    weightQuality,
    workoutQuality,
  });
  const weightDelta = getWeightDeltaPercentage(weightSummaries.baseline.value, weightSummaries.current.value);
  const performanceDelta = getPerformanceDeltaPercentage(
    performanceSummaries.baseline.value,
    performanceSummaries.current.value
  );

  if (!goalDefinition || dataQuality === 'missing') {
    return {
      primaryKPI: goalDefinition?.primaryKPI || null,
      status: 'insufficient_data',
      confidence: 'low',
      reason:
        normalizedGoal === 'cut'
          ? weightQuality.reason
          : normalizedGoal === 'bulk'
            ? workoutQuality.reason
            : 'אין מספיק נתונים כדי להעריך התקדמות ביחס למטרה.',
      dataQuality,
      baselineSummary: {
        weight: weightSummaries.baseline,
        performance: performanceSummaries.baseline,
      },
      currentSummary: {
        weight: weightSummaries.current,
        performance: performanceSummaries.current,
      },
    };
  }

  if (normalizedGoal === 'cut') {
    if (weightDelta !== null && weightDelta <= -1) {
      return {
        primaryKPI: goalDefinition.primaryKPI,
        status: performanceDelta !== null && performanceDelta <= -5 ? 'neutral' : 'positive',
        confidence,
        reason:
          performanceDelta !== null && performanceDelta <= -5
            ? 'המשקל יורד, אבל יש גם ירידה מורגשת בביצועים.'
            : 'מגמת המשקל יורדת בהתאם למטרת החיטוב.',
        dataQuality,
        baselineSummary: {
          weight: weightSummaries.baseline,
          performance: performanceSummaries.baseline,
        },
        currentSummary: {
          weight: weightSummaries.current,
          performance: performanceSummaries.current,
        },
      };
    }

    return {
      primaryKPI: goalDefinition.primaryKPI,
      status: 'negative',
      confidence,
      reason: 'מגמת המשקל לא יורדת בצורה ברורה ביחס לנקודת ההתחלה.',
      dataQuality,
      baselineSummary: {
        weight: weightSummaries.baseline,
        performance: performanceSummaries.baseline,
      },
      currentSummary: {
        weight: weightSummaries.current,
        performance: performanceSummaries.current,
      },
    };
  }

  if (normalizedGoal === 'bulk') {
    if (performanceDelta !== null && performanceDelta >= 2) {
      return {
        primaryKPI: goalDefinition.primaryKPI,
        status: 'positive',
        confidence,
        reason: 'הביצועים משתפרים ביחס לנקודת ההתחלה של התרגילים הזמינים.',
        dataQuality,
        baselineSummary: {
          weight: weightSummaries.baseline,
          performance: performanceSummaries.baseline,
        },
        currentSummary: {
          weight: weightSummaries.current,
          performance: performanceSummaries.current,
        },
      };
    }

    return {
      primaryKPI: goalDefinition.primaryKPI,
      status: performanceDelta !== null && performanceDelta <= -2 ? 'negative' : 'neutral',
      confidence,
      reason:
        performanceDelta !== null && performanceDelta <= -2
          ? 'אין שיפור בביצועים ביחס לבייסליין, ויש סימן לירידה.'
          : 'אין עדיין שיפור מובהק בביצועים ביחס לבייסליין.',
      dataQuality,
      baselineSummary: {
        weight: weightSummaries.baseline,
        performance: performanceSummaries.baseline,
      },
      currentSummary: {
        weight: weightSummaries.current,
        performance: performanceSummaries.current,
      },
    };
  }

  const weightStable = weightDelta !== null && Math.abs(weightDelta) <= 1.5;
  const performanceStable = performanceDelta !== null && performanceDelta >= -2 && performanceDelta <= 2;

  return {
    primaryKPI: goalDefinition.primaryKPI,
    status: weightStable && performanceStable ? 'positive' : weightStable || performanceStable ? 'neutral' : 'negative',
    confidence,
    reason:
      weightStable && performanceStable
        ? 'המשקל והביצועים נשארים בטווח יציב ביחס לבייסליין.'
        : !weightStable && !performanceStable
          ? 'יש סטייה גם במשקל וגם בביצועים ביחס לבייסליין.'
          : 'חלק מהמדדים עדיין יציבים, אבל יש גם סטייה ביחס לבייסליין.',
    dataQuality,
    baselineSummary: {
      weight: weightSummaries.baseline,
      performance: performanceSummaries.baseline,
    },
    currentSummary: {
      weight: weightSummaries.current,
      performance: performanceSummaries.current,
    },
  };
};
