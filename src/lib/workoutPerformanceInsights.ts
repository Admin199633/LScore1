import type { DataConfidence, DataStatus } from '@/lib/dataReliability';
import type { SavedWorkoutSession } from '@/lib/repositories/workoutSessionRepository';
import {
  calculateWorkoutPerformanceScore,
  type WorkoutPerformanceScoreResult,
} from '@/lib/workoutPerformanceScore';

export type StartTimeBucket = 'בוקר' | 'צהריים' | 'ערב' | 'לילה';
export type DurationBucket = 'קצר' | 'בינוני' | 'ארוך';
export type RestBucket = '0-1' | '2' | '3+';
export type TimeConsistencyLevel = 'גבוהה' | 'בינונית' | 'נמוכה';

export type WorkoutPerformanceSnapshot = {
  workoutId: string;
  date: string;
  weekday: string;
  startTime: string;
  startTimeBucket: StartTimeBucket | null;
  durationMinutes: number | null;
  durationBucket: DurationBucket | null;
  energyLevel: string | null;
  restDaysSincePreviousWorkout: number | null;
  restBucket: RestBucket | null;
  performanceScore: number | null;
  dataStatus: DataStatus;
  confidence: DataConfidence;
};

type InsightBase = {
  confidence: DataConfidence;
  dataStatus: DataStatus;
  reason: string;
};

export type BestWeekdayInsight = InsightBase & {
  bestWeekday: string | null;
  averageScore: number | null;
};

export type BestStartTimeInsight = InsightBase & {
  bestStartTimeBucket: StartTimeBucket | null;
  averageScore: number | null;
};

export type BestDurationInsight = InsightBase & {
  bestDurationBucket: DurationBucket | null;
  averageScore: number | null;
};

export type BestEnergyInsight = InsightBase & {
  bestEnergyLevel: string | null;
  averageScore: number | null;
  comparisonSummary: string;
};

export type BestRestInsight = InsightBase & {
  bestRestBucket: RestBucket | null;
  averageScore: number | null;
};

export type TimeConsistencyInsight = InsightBase & {
  consistencyLevel: TimeConsistencyLevel | null;
  dominantTimeBucket: StartTimeBucket | null;
};

export type WorkoutPerformanceInsightsResult = {
  snapshots: WorkoutPerformanceSnapshot[];
  overallConfidence: DataConfidence;
  dataStatus: DataStatus;
  validWorkoutsCount: number;
  bestWeekday: BestWeekdayInsight;
  bestStartTime: BestStartTimeInsight;
  bestDuration: BestDurationInsight;
  bestEnergy: BestEnergyInsight;
  bestRest: BestRestInsight;
  timeConsistency: TimeConsistencyInsight;
};

type BucketEntry<T extends string> = {
  bucket: T;
  score: number;
};

const WEEKDAY_LABELS = ['יום ראשון', 'יום שני', 'יום שלישי', 'יום רביעי', 'יום חמישי', 'יום שישי', 'שבת'];

const normalizeDate = (value: string) => {
  const normalized = String(value || '').trim();
  const [year, month, day] = normalized.slice(0, 10).split('-').map(Number);

  if (!year || !month || !day) {
    return null;
  }

  return new Date(Date.UTC(year, month - 1, day));
};

const buildDateTimeKey = (date: string, startedAt: string) => `${String(date || '').slice(0, 10)}T${String(startedAt || '00:00:00')}`;

const roundScore = (value: number) => Math.round(value * 100) / 100;

const diffDays = (currentDate: string, previousDate: string) => {
  const current = normalizeDate(currentDate);
  const previous = normalizeDate(previousDate);

  if (!current || !previous) {
    return null;
  }

  return Math.floor((current.getTime() - previous.getTime()) / (24 * 60 * 60 * 1000));
};

const getWeekday = (date: string) => {
  const normalized = normalizeDate(date);

  if (!normalized) {
    return null;
  }

  return WEEKDAY_LABELS[normalized.getUTCDay()] || null;
};

export const getStartTimeBucket = (startTime: string | null | undefined): StartTimeBucket | null => {
  const normalized = String(startTime || '').trim();
  const [hoursRaw] = normalized.split(':');
  const hours = Number(hoursRaw);

  if (!Number.isFinite(hours) || hours < 0 || hours > 23) {
    return null;
  }

  if (hours >= 5 && hours <= 11) {
    return 'בוקר';
  }

  if (hours >= 12 && hours <= 16) {
    return 'צהריים';
  }

  if (hours >= 17 && hours <= 21) {
    return 'ערב';
  }

  return 'לילה';
};

export const getDurationBucket = (durationMinutes: number | null): DurationBucket | null => {
  if (!durationMinutes || durationMinutes <= 0) {
    return null;
  }

  if (durationMinutes <= 45) {
    return 'קצר';
  }

  if (durationMinutes <= 75) {
    return 'בינוני';
  }

  return 'ארוך';
};

export const getRestBucket = (restDaysSincePreviousWorkout: number | null): RestBucket | null => {
  if (restDaysSincePreviousWorkout === null || restDaysSincePreviousWorkout < 0) {
    return null;
  }

  if (restDaysSincePreviousWorkout <= 1) {
    return '0-1';
  }

  if (restDaysSincePreviousWorkout === 2) {
    return '2';
  }

  return '3+';
};

const mapEnergyLevel = (value: string | null | undefined) => {
  const normalized = String(value || '').trim().toLowerCase();

  if (normalized === 'low' || normalized === 'נמוכה') {
    return 'נמוכה';
  }

  if (normalized === 'high' || normalized === 'גבוהה') {
    return 'גבוהה';
  }

  if (normalized === 'normal' || normalized === 'good' || normalized === 'סבבה') {
    return 'סבבה';
  }

  return null;
};

const getBucketAverage = <T extends string>(entries: BucketEntry<T>[]) => {
  const grouped = new Map<T, number[]>();

  entries.forEach((entry) => {
    const current = grouped.get(entry.bucket) || [];
    current.push(entry.score);
    grouped.set(entry.bucket, current);
  });

  const eligibleBuckets = Array.from(grouped.entries())
    .filter(([, scores]) => scores.length >= 2)
    .map(([bucket, scores]) => ({
      bucket,
      count: scores.length,
      averageScore: roundScore(scores.reduce((sum, score) => sum + score, 0) / scores.length),
    }))
    .sort((left, right) => right.averageScore - left.averageScore || right.count - left.count);

  return {
    grouped,
    eligibleBuckets,
    winner: eligibleBuckets[0] || null,
  };
};

const getInsightQuality = (eligibleBucketCount: number, validEntriesCount: number): Pick<InsightBase, 'dataStatus' | 'confidence'> => {
  if (validEntriesCount < 2 || eligibleBucketCount === 0) {
    return {
      dataStatus: 'missing',
      confidence: 'low',
    };
  }

  if (eligibleBucketCount === 1 || validEntriesCount < 5) {
    return {
      dataStatus: 'partial',
      confidence: 'medium',
    };
  }

  return {
    dataStatus: 'complete',
    confidence: 'high',
  };
};

export const buildWorkoutPerformanceSnapshots = (
  workoutHistory: SavedWorkoutSession[]
): WorkoutPerformanceSnapshot[] => {
  const orderedHistory = [...(workoutHistory || [])].sort((left, right) =>
    buildDateTimeKey(left.date, left.startedAt).localeCompare(buildDateTimeKey(right.date, right.startedAt))
  );

  return orderedHistory.map((session, index) => {
    const scoreResult: WorkoutPerformanceScoreResult = calculateWorkoutPerformanceScore(session);
    const previousSession = index > 0 ? orderedHistory[index - 1] : null;
    const restDaysSincePreviousWorkout =
      previousSession && session.date && previousSession.date ? diffDays(session.date, previousSession.date) : null;
    const durationMinutes =
      Number.isFinite(Number(session.durationSeconds)) && Number(session.durationSeconds) > 0
        ? Math.round(Number(session.durationSeconds) / 60)
        : null;

    return {
      workoutId: `${session.date}-${session.dayId || session.dayName || index}`,
      date: session.date || '',
      weekday: getWeekday(session.date) || '',
      startTime: session.startedAt || '',
      startTimeBucket: getStartTimeBucket(session.startedAt),
      durationMinutes,
      durationBucket: getDurationBucket(durationMinutes),
      energyLevel: mapEnergyLevel(session.energyLevel),
      restDaysSincePreviousWorkout,
      restBucket: getRestBucket(restDaysSincePreviousWorkout),
      performanceScore: scoreResult.score,
      dataStatus: scoreResult.dataStatus,
      confidence: scoreResult.confidence,
    };
  });
};

const getValidSnapshots = (snapshots: WorkoutPerformanceSnapshot[]) =>
  snapshots.filter((snapshot) => snapshot.performanceScore !== null && snapshot.dataStatus !== 'missing');

const buildMissingInsight = <T extends object>(extra: T, reason: string): T & InsightBase => ({
  ...extra,
  dataStatus: 'missing',
  confidence: 'low',
  reason,
});

const calculateBestWeekdayInsight = (snapshots: WorkoutPerformanceSnapshot[]): BestWeekdayInsight => {
  const entries = snapshots
    .filter((snapshot) => snapshot.weekday && snapshot.performanceScore !== null)
    .map((snapshot) => ({ bucket: snapshot.weekday, score: snapshot.performanceScore as number }));
  const { eligibleBuckets, winner } = getBucketAverage(entries);
  const quality = getInsightQuality(eligibleBuckets.length, entries.length);

  if (!winner) {
    return buildMissingInsight(
      { bestWeekday: null, averageScore: null },
      'אין מספיק אימונים תקפים כדי לזהות יום חזק במיוחד.'
    );
  }

  return {
    bestWeekday: winner.bucket,
    averageScore: winner.averageScore,
    ...quality,
    reason: `ממוצע הביצועים הגבוה ביותר מופיע ב-${winner.bucket}.`,
  };
};

const calculateBestStartTimeInsight = (snapshots: WorkoutPerformanceSnapshot[]): BestStartTimeInsight => {
  const entries = snapshots
    .filter((snapshot) => snapshot.startTimeBucket && snapshot.performanceScore !== null)
    .map((snapshot) => ({ bucket: snapshot.startTimeBucket as StartTimeBucket, score: snapshot.performanceScore as number }));
  const { eligibleBuckets, winner } = getBucketAverage(entries);
  const quality = getInsightQuality(eligibleBuckets.length, entries.length);

  if (!winner) {
    return buildMissingInsight(
      { bestStartTimeBucket: null, averageScore: null },
      'אין מספיק נתונים כדי לזהות חלון זמן חזק במיוחד.'
    );
  }

  return {
    bestStartTimeBucket: winner.bucket,
    averageScore: winner.averageScore,
    ...quality,
    reason: `הביצועים הגבוהים ביותר מגיעים בדרך כלל כשאתה מתחיל אימון ב${winner.bucket}.`,
  };
};

const calculateBestDurationInsight = (snapshots: WorkoutPerformanceSnapshot[]): BestDurationInsight => {
  const entries = snapshots
    .filter((snapshot) => snapshot.durationBucket && snapshot.performanceScore !== null)
    .map((snapshot) => ({ bucket: snapshot.durationBucket as DurationBucket, score: snapshot.performanceScore as number }));
  const { eligibleBuckets, winner } = getBucketAverage(entries);
  const quality = getInsightQuality(eligibleBuckets.length, entries.length);

  if (!winner) {
    return buildMissingInsight(
      { bestDurationBucket: null, averageScore: null },
      'אין מספיק נתונים כדי לזהות משך אימון מיטבי.'
    );
  }

  return {
    bestDurationBucket: winner.bucket,
    averageScore: winner.averageScore,
    ...quality,
    reason: `הביצועים הטובים ביותר מופיעים לרוב באימונים ${winner.bucket === 'קצר' ? 'קצרים' : winner.bucket === 'בינוני' ? 'באורך בינוני' : 'ארוכים'}.`,
  };
};

const calculateBestEnergyInsight = (snapshots: WorkoutPerformanceSnapshot[]): BestEnergyInsight => {
  const entries = snapshots
    .filter((snapshot) => snapshot.energyLevel && snapshot.performanceScore !== null)
    .map((snapshot) => ({ bucket: snapshot.energyLevel as string, score: snapshot.performanceScore as number }));
  const { eligibleBuckets, winner } = getBucketAverage(entries);
  const quality = getInsightQuality(eligibleBuckets.length, entries.length);

  if (!winner) {
    return buildMissingInsight(
      { bestEnergyLevel: null, averageScore: null, comparisonSummary: 'אין מספיק נתונים להשוואה.' },
      'אין מספיק נתונים כדי לזהות השפעת אנרגיה.'
    );
  }

  return {
    bestEnergyLevel: winner.bucket,
    averageScore: winner.averageScore,
    comparisonSummary: `ממוצע הביצועים הגבוה ביותר מופיע ברמת אנרגיה ${winner.bucket}.`,
    ...quality,
    reason: `הביצועים הטובים ביותר מופיעים כשאתה מתחיל אימון עם אנרגיה ${winner.bucket}.`,
  };
};

const calculateBestRestInsight = (snapshots: WorkoutPerformanceSnapshot[]): BestRestInsight => {
  const entries = snapshots
    .filter((snapshot) => snapshot.restBucket && snapshot.performanceScore !== null)
    .map((snapshot) => ({ bucket: snapshot.restBucket as RestBucket, score: snapshot.performanceScore as number }));
  const { eligibleBuckets, winner } = getBucketAverage(entries);
  const quality = getInsightQuality(eligibleBuckets.length, entries.length);

  if (!winner) {
    return buildMissingInsight(
      { bestRestBucket: null, averageScore: null },
      'אין מספיק נתונים כדי לזהות השפעת מנוחה בין אימונים.'
    );
  }

  return {
    bestRestBucket: winner.bucket,
    averageScore: winner.averageScore,
    ...quality,
    reason:
      winner.bucket === '2'
        ? 'הביצועים הטובים ביותר מגיעים בדרך כלל אחרי יומיים מנוחה.'
        : winner.bucket === '3+'
          ? 'הביצועים הטובים ביותר מגיעים בדרך כלל אחרי 3 ימים ומעלה של מנוחה.'
          : 'הביצועים הטובים ביותר מגיעים בדרך כלל כשהמרווח בין האימונים קצר.',
  };
};

const calculateTimeConsistencyInsight = (snapshots: WorkoutPerformanceSnapshot[]): TimeConsistencyInsight => {
  const entries = snapshots.filter((snapshot) => snapshot.startTimeBucket).map((snapshot) => snapshot.startTimeBucket as StartTimeBucket);

  if (entries.length < 3) {
    return buildMissingInsight(
      { consistencyLevel: null, dominantTimeBucket: null },
      'אין מספיק נתונים כדי לזהות עקביות בזמני אימון.'
    );
  }

  const grouped = new Map<StartTimeBucket, number>();
  entries.forEach((entry) => grouped.set(entry, (grouped.get(entry) || 0) + 1));
  const dominant = Array.from(grouped.entries()).sort((left, right) => right[1] - left[1])[0];

  if (!dominant) {
    return buildMissingInsight(
      { consistencyLevel: null, dominantTimeBucket: null },
      'אין מספיק נתונים כדי לזהות עקביות בזמני אימון.'
    );
  }

  const share = dominant[1] / entries.length;
  const consistencyLevel: TimeConsistencyLevel =
    share >= 0.7 ? 'גבוהה' : share >= 0.45 ? 'בינונית' : 'נמוכה';
  const dataStatus: DataStatus = entries.length >= 5 ? 'complete' : 'partial';
  const confidence: DataConfidence = entries.length >= 6 ? 'high' : 'medium';
  const reason =
    consistencyLevel === 'גבוהה'
      ? `רוב האימונים שלך מתחילים ב${dominant[0]}, ולכן זמני האימון שלך עקביים.`
      : consistencyLevel === 'בינונית'
        ? `יש נטייה להתאמן ב${dominant[0]}, אבל עדיין יש פיזור בין חלונות הזמן.`
        : 'שעות האימון שלך משתנות לעיתים קרובות.';

  return {
    consistencyLevel,
    dominantTimeBucket: dominant[0],
    dataStatus,
    confidence,
    reason,
  };
};

const getOverallDataStatus = (validWorkoutsCount: number, completeInsightsCount: number, partialInsightsCount: number): DataStatus => {
  if (validWorkoutsCount < 3 || completeInsightsCount === 0) {
    return 'missing';
  }

  if (completeInsightsCount >= 4) {
    return 'complete';
  }

  if (completeInsightsCount + partialInsightsCount >= 3) {
    return 'partial';
  }

  return 'missing';
};

const getOverallConfidence = (completeInsightsCount: number, partialInsightsCount: number): DataConfidence => {
  if (completeInsightsCount >= 4) {
    return 'high';
  }

  if (completeInsightsCount + partialInsightsCount >= 3) {
    return 'medium';
  }

  return 'low';
};

export const calculateWorkoutPerformanceInsights = (
  workoutHistory: SavedWorkoutSession[]
): WorkoutPerformanceInsightsResult => {
  const snapshots = buildWorkoutPerformanceSnapshots(workoutHistory);
  const validSnapshots = getValidSnapshots(snapshots);

  const bestWeekday = calculateBestWeekdayInsight(validSnapshots);
  const bestStartTime = calculateBestStartTimeInsight(validSnapshots);
  const bestDuration = calculateBestDurationInsight(validSnapshots);
  const bestEnergy = calculateBestEnergyInsight(validSnapshots);
  const bestRest = calculateBestRestInsight(validSnapshots);
  const timeConsistency = calculateTimeConsistencyInsight(validSnapshots);

  const insights = [bestWeekday, bestStartTime, bestDuration, bestEnergy, bestRest, timeConsistency];
  const completeInsightsCount = insights.filter((insight) => insight.dataStatus === 'complete').length;
  const partialInsightsCount = insights.filter((insight) => insight.dataStatus === 'partial').length;

  return {
    snapshots,
    validWorkoutsCount: validSnapshots.length,
    overallConfidence: getOverallConfidence(completeInsightsCount, partialInsightsCount),
    dataStatus: getOverallDataStatus(validSnapshots.length, completeInsightsCount, partialInsightsCount),
    bestWeekday,
    bestStartTime,
    bestDuration,
    bestEnergy,
    bestRest,
    timeConsistency,
  };
};
