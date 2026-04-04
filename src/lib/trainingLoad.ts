import { calculateExerciseProgress, type ExerciseProgressResult } from '@/lib/exerciseProgress';
import { assessWorkoutDataQuality, isWorkoutValidForAnalysis } from '@/lib/dataQuality';
import type { SavedWorkoutSession } from '@/lib/repositories/workoutSessionRepository';

export type TrainingLoadStatus = 'low_load' | 'medium_load' | 'high_load' | 'insufficient_data';
export type TrainingLoadConfidence = 'low' | 'medium' | 'high';

export type TrainingLoadFlags = {
  performanceFlag: 'on' | 'off' | 'unknown';
  effortFlag: 'off' | 'moderate' | 'strong' | 'unknown';
  energyFlag: 'on' | 'off' | 'unknown';
  executionFlag: 'on' | 'off' | 'unknown';
  durationFlag: 'on' | 'off' | 'unknown';
};

export type TrainingLoadResult = {
  status: TrainingLoadStatus;
  label: 'עומס נמוך' | 'עומס בינוני' | 'עומס גבוה' | 'אין מספיק נתונים';
  reason: string;
  confidence: TrainingLoadConfidence;
  flags: TrainingLoadFlags;
};

type PerformanceSummary = {
  flag: TrainingLoadFlags['performanceFlag'];
  trend: 'up' | 'stable' | 'down' | 'unknown';
  downCount: number;
  upCount: number;
  validExercisesCount: number;
};

const buildDateTimeKey = (session: SavedWorkoutSession) =>
  `${String(session?.date || '').slice(0, 10)}T${String(session?.startedAt || '00:00:00')}`;

const getRecentSessions = (workoutHistory: SavedWorkoutSession[]) =>
  [...(workoutHistory || [])]
    .sort((left, right) => buildDateTimeKey(left).localeCompare(buildDateTimeKey(right)))
    .slice(-3);

const getUniqueExerciseNames = (sessions: SavedWorkoutSession[]) =>
  Array.from(
    new Set(
      sessions.flatMap((session) =>
        (session.exercises || []).map((exercise) => String(exercise?.exerciseName || '').trim()).filter(Boolean)
      )
    )
  );

const normalizeDifficulty = (value: string | null | undefined) => {
  const normalized = String(value || '').trim().toLowerCase();

  switch (normalized) {
    case 'קשה':
    case 'hard':
      return 'hard';
    case 'כשל':
    case 'failure':
      return 'failure';
    case 'קל':
    case 'easy':
      return 'easy';
    case 'סבבה':
    case 'good':
      return 'good';
    default:
      return null;
  }
};

const calculatePerformanceFlag = (
  workoutHistory: SavedWorkoutSession[],
  recentSessions: SavedWorkoutSession[]
): PerformanceSummary => {
  const exerciseNames = getUniqueExerciseNames(recentSessions);
  const results = exerciseNames
    .map((exerciseName) => ({
      exerciseName,
      result: calculateExerciseProgress(exerciseName, workoutHistory),
    }))
    .filter((item) => item.result.trend !== 'insufficient_data');

  if (results.length < 2) {
    return {
      flag: 'unknown',
      trend: 'unknown',
      downCount: 0,
      upCount: 0,
      validExercisesCount: results.length,
    };
  }

  const downCount = results.filter((item) => item.result.trend === 'down').length;
  const upCount = results.filter((item) => item.result.trend === 'up').length;
  const trend = downCount > upCount ? 'down' : upCount > downCount ? 'up' : 'stable';

  return {
    flag: downCount >= 2 ? 'on' : 'off',
    trend,
    downCount,
    upCount,
    validExercisesCount: results.length,
  };
};

const calculateEffortFlag = (
  recentSessions: SavedWorkoutSession[],
  performanceSummary: PerformanceSummary
): TrainingLoadFlags['effortFlag'] => {
  const validSets = recentSessions.flatMap((session) =>
    (session.exercises || []).flatMap((exercise) =>
      (exercise.sets || [])
        .map((set) => normalizeDifficulty(set?.difficulty))
        .filter((difficulty): difficulty is 'easy' | 'good' | 'hard' | 'failure' => Boolean(difficulty))
    )
  );

  if (validSets.length < 8 || performanceSummary.trend === 'unknown') {
    return 'unknown';
  }

  const hardSets = validSets.filter((difficulty) => difficulty === 'hard' || difficulty === 'failure').length;
  const failureSets = validSets.filter((difficulty) => difficulty === 'failure').length;
  const effortRatio = hardSets / validSets.length;
  const failureRatio = failureSets / validSets.length;

  if (performanceSummary.trend === 'up') {
    if (effortRatio >= 0.4 || failureRatio >= 0.2) {
      return 'moderate';
    }

    return 'off';
  }

  if (performanceSummary.trend === 'down') {
    if (effortRatio >= 0.4 || failureRatio >= 0.2) {
      return 'strong';
    }

    if (effortRatio >= 0.25 || failureRatio >= 0.1) {
      return 'moderate';
    }

    return 'off';
  }

  if (effortRatio >= 0.4 || failureRatio >= 0.1) {
    return 'moderate';
  }

  return 'off';
};

const calculateEnergyFlag = (recentSessions: SavedWorkoutSession[]): TrainingLoadFlags['energyFlag'] => {
  const energyValues = recentSessions
    .map((session) => String(session?.energyLevel || '').trim().toLowerCase())
    .filter(Boolean);

  if (energyValues.length < 2) {
    return 'unknown';
  }

  const lowCount = energyValues.filter((value) => value === 'low' || value === 'נמוכה').length;
  return lowCount >= 2 ? 'on' : 'off';
};

const calculateExecutionFlag = (recentSessions: SavedWorkoutSession[]): TrainingLoadFlags['executionFlag'] => {
  const sessionsWithExerciseData = recentSessions.filter((session) => Array.isArray(session.exercises) && session.exercises.length > 0);

  if (sessionsWithExerciseData.length < 2) {
    return 'unknown';
  }

  const skippedCounts = sessionsWithExerciseData.map((session) =>
    (session.exercises || []).filter((exercise) => exercise.completed === false || (exercise.sets || []).length === 0).length
  );
  const smallSkipSessions = skippedCounts.filter((count) => count >= 1).length;
  const largeSkipSession = skippedCounts.some((count) => count >= 2);
  const highReorder = sessionsWithExerciseData.some((session) => Number(session.reorderCount || 0) >= 3);

  return largeSkipSession || smallSkipSessions >= 2 || highReorder ? 'on' : 'off';
};

const calculateDurationFlag = (
  workoutHistory: SavedWorkoutSession[],
  recentSessions: SavedWorkoutSession[]
): TrainingLoadFlags['durationFlag'] => {
  const orderedHistory = [...(workoutHistory || [])].sort((left, right) => buildDateTimeKey(left).localeCompare(buildDateTimeKey(right)));
  const recentKeys = new Set(recentSessions.map((session) => buildDateTimeKey(session)));
  const previousDurations = orderedHistory
    .filter((session) => !recentKeys.has(buildDateTimeKey(session)))
    .map((session) => Number(session.durationSeconds || 0))
    .filter((duration) => duration > 0);
  const recentDurations = recentSessions
    .map((session) => Number(session.durationSeconds || 0))
    .filter((duration) => duration > 0);

  if (previousDurations.length < 2 || recentDurations.length === 0) {
    return 'unknown';
  }

  const baseline = previousDurations.reduce((sum, duration) => sum + duration, 0) / previousDurations.length;
  const latestDuration = recentDurations[recentDurations.length - 1];
  const elevatedCount = recentDurations.filter((duration) => duration >= baseline * 1.15).length;

  if (latestDuration >= baseline * 1.2 || elevatedCount >= 2) {
    return 'on';
  }

  return 'off';
};

const buildLabel = (status: TrainingLoadStatus): TrainingLoadResult['label'] => {
  if (status === 'low_load') return 'עומס נמוך';
  if (status === 'medium_load') return 'עומס בינוני';
  if (status === 'high_load') return 'עומס גבוה';
  return 'אין מספיק נתונים';
};

const getOnCount = (flags: TrainingLoadFlags) => {
  let count = 0;
  if (flags.performanceFlag === 'on') count += 1;
  if (flags.energyFlag === 'on') count += 1;
  if (flags.executionFlag === 'on') count += 1;
  if (flags.durationFlag === 'on') count += 1;
  if (flags.effortFlag === 'strong') count += 1;
  return count;
};

const getUnknownCount = (flags: TrainingLoadFlags) =>
  [
    flags.performanceFlag === 'unknown',
    flags.effortFlag === 'unknown',
    flags.energyFlag === 'unknown',
    flags.executionFlag === 'unknown',
    flags.durationFlag === 'unknown',
  ].filter(Boolean).length;

const getReason = (status: TrainingLoadStatus, flags: TrainingLoadFlags): string => {
  if (status === 'insufficient_data') {
    return 'אין מספיק נתונים כדי להעריך עומס.';
  }

  if (
    flags.performanceFlag === 'on' &&
    flags.effortFlag === 'strong' &&
    flags.energyFlag === 'on'
  ) {
    return 'יש ירידה בביצועים יחד עם מאמץ גבוה ואנרגיה נמוכה.';
  }

  if (flags.durationFlag === 'on' && (flags.effortFlag === 'strong' || flags.effortFlag === 'moderate')) {
    return 'האימונים האחרונים היו קשים וארוכים מהרגיל.';
  }

  if (status === 'high_load') {
    return 'יש כמה סימנים לכך שהעומס מהאימונים האחרונים מתחיל לפגוע בהתאוששות.';
  }

  if (status === 'medium_load') {
    return 'יש סימני עומס קלים באימונים האחרונים.';
  }

  return 'הביצועים יציבים והעומס נראה מאוזן באימונים האחרונים.';
};

const getConfidence = (recentSessionsCount: number, unknownCount: number): TrainingLoadConfidence => {
  if (recentSessionsCount >= 3 && unknownCount <= 1) {
    return 'high';
  }

  if (recentSessionsCount >= 2 && unknownCount <= 2) {
    return 'medium';
  }

  return 'low';
};

export const calculateTrainingLoad = (
  workoutHistory: SavedWorkoutSession[]
): TrainingLoadResult => {
  const recentSessions = getRecentSessions(workoutHistory);
  const workoutQuality = assessWorkoutDataQuality(workoutHistory);
  const validRecentSessions = recentSessions.filter(isWorkoutValidForAnalysis);

  if (validRecentSessions.length < 2 || workoutQuality.status === 'invalid') {
    return {
      status: 'insufficient_data',
      label: 'אין מספיק נתונים',
      reason: workoutQuality.reason,
      confidence: 'low',
      flags: {
        performanceFlag: 'unknown',
        effortFlag: 'unknown',
        energyFlag: 'unknown',
        executionFlag: 'unknown',
        durationFlag: 'unknown',
      },
    };
  }

  const performanceSummary = calculatePerformanceFlag(workoutHistory, validRecentSessions);
  const flags: TrainingLoadFlags = {
    performanceFlag: performanceSummary.flag,
    effortFlag: calculateEffortFlag(validRecentSessions, performanceSummary),
    energyFlag: calculateEnergyFlag(validRecentSessions),
    executionFlag: calculateExecutionFlag(validRecentSessions),
    durationFlag: calculateDurationFlag(workoutHistory, validRecentSessions),
  };

  const unknownCount = getUnknownCount(flags);
  const onCount = getOnCount(flags);
  const confidence =
    workoutQuality.status === 'partial' ? 'low' : getConfidence(validRecentSessions.length, unknownCount);

  let status: TrainingLoadStatus = 'low_load';

  if (validRecentSessions.length < 2 || unknownCount >= 3) {
    status = 'insufficient_data';
  } else if (
    onCount >= 3 ||
    (flags.performanceFlag === 'on' && flags.effortFlag === 'strong' && flags.energyFlag === 'on')
  ) {
    status = 'high_load';
  } else if (
    onCount >= 2 ||
    (flags.effortFlag === 'moderate' &&
      [flags.performanceFlag, flags.energyFlag, flags.executionFlag, flags.durationFlag].includes('on'))
  ) {
    status = 'medium_load';
  } else {
    status = 'low_load';
  }

  return {
    status,
    label: buildLabel(status),
    reason: getReason(status, flags),
    confidence,
    flags,
  };
};
