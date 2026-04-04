import type { GoalType } from './goalDefinitions';
import type { ProgressStatusResult } from './progressStatus';
import type { NutritionAdherenceResult } from './nutritionAdherence';
import type { TrainingLoadResult } from './trainingLoad';
import type { GoalKPIStatusResult } from './goalKpiStatus';
import type { WorkoutConsistencyResult } from './workoutConsistency';

// ─── Types ────────────────────────────────────────────────────────────────────

export type InsightDomain =
  | 'fatigue'
  | 'nutrition'
  | 'weight_trend'
  | 'consistency'
  | 'progress'
  | 'data_quality';

export type SupportingSignal = {
  key: string;
  label: string;
  value?: string | number;
};

export type ScoreFactors = {
  impact: number;        // 0–1: how much this blocks the goal
  confidence: number;    // 0–1: how reliable the conclusion is
  persistence: number;   // 0–1: one-off vs. repeated pattern
  urgency: number;       // 0–1: needs action now
  actionability: number; // 0–1: concrete CTA available
};

export type CandidateInsight = {
  id: string;
  domain: InsightDomain;
  title: string;
  message: string;
  reason: string;
  reasonCode: string;
  cta: { label: string; href: string };
  scoreFactors: ScoreFactors;
  supportingSignals: SupportingSignal[];
  /** Low-priority nudge — only wins if no real insight passes MIN_SCORE_THRESHOLD */
  isReminder?: true;
};

export type HomeRecommendation = {
  id: string;
  domain: InsightDomain;
  title: string;
  message: string;
  reason: string;
  reasonCode: string;
  cta: { label: string; href: string };
  score: number;
  confidence: number;
  scoreVector: ScoreFactors;
  supportingSignals: SupportingSignal[];
};

export type PriorityEngineInput = {
  goal: GoalType;
  progressStatus: ProgressStatusResult;
  nutritionAdherence: NutritionAdherenceResult;
  trainingLoad: TrainingLoadResult;
  goalKpiStatus: GoalKPIStatusResult;
  workoutConsistency: WorkoutConsistencyResult;
  hasTodayNutritionLog: boolean;
  hasTodayWeight: boolean;
};

// ─── Weights & Constants ──────────────────────────────────────────────────────

const WEIGHTS = {
  impact: 0.35,
  confidence: 0.25,
  persistence: 0.20,
  urgency: 0.15,
  actionability: 0.05,
} as const;

const MIN_SCORE_THRESHOLD = 0.25;

// ─── Helpers ──────────────────────────────────────────────────────────────────

const levelToNumber = (level: 'low' | 'medium' | 'high'): number =>
  level === 'high' ? 1.0 : level === 'medium' ? 0.6 : 0.3;

const round2 = (n: number): number => Math.round(n * 100) / 100;

export const calculateScore = (f: ScoreFactors): number =>
  f.impact       * WEIGHTS.impact       +
  f.confidence   * WEIGHTS.confidence   +
  f.persistence  * WEIGHTS.persistence  +
  f.urgency      * WEIGHTS.urgency      +
  f.actionability * WEIGHTS.actionability;

// ─── Candidate Builders ───────────────────────────────────────────────────────

const buildFatigueCandidate = (trainingLoad: TrainingLoadResult): CandidateInsight | null => {
  // Gate: only emit when status is high AND confidence is not low
  if (trainingLoad.status !== 'high_load') return null;
  if (trainingLoad.confidence === 'low') return null;

  const flags = trainingLoad.flags;
  const signals: SupportingSignal[] = [];
  if (flags.performanceFlag === 'on')  signals.push({ key: 'performance_drop',  label: 'ירידת ביצועים' });
  if (flags.energyFlag === 'on')       signals.push({ key: 'low_energy',         label: 'אנרגיה נמוכה' });
  if (flags.executionFlag === 'on')    signals.push({ key: 'fewer_exercises',    label: 'פחות תרגילים הושלמו' });
  if (flags.durationFlag === 'on')     signals.push({ key: 'shorter_session',    label: 'אימון קצר יותר' });
  if (flags.effortFlag === 'strong')   signals.push({ key: 'high_effort_reported', label: 'מאמץ גבוה דווח' });

  const hasPerformanceDrop = flags.performanceFlag === 'on';
  const reasonCode = hasPerformanceDrop
    ? 'fatigue_high_load_with_performance_drop'
    : 'fatigue_high_load';

  return {
    id: 'fatigue_high',
    domain: 'fatigue',
    title: 'זמן להתאושש',
    message: 'האימונים האחרונים מציגים סימני עומס גבוה. מנוחה תסייע לביצועים.',
    reason: trainingLoad.reason,
    reasonCode,
    cta: { label: 'היסטוריית אימונים', href: '/workout-history' },
    scoreFactors: {
      impact: 0.85,
      confidence: levelToNumber(trainingLoad.confidence),
      persistence: Math.min(signals.length / 3, 1.0),
      urgency: 0.9,
      actionability: 0.7,
    },
    supportingSignals: signals,
  };
};

const buildNutritionCandidate = (
  nutritionAdherence: NutritionAdherenceResult,
  goal: GoalType,
  hasTodayNutritionLog: boolean
): CandidateInsight | null => {
  if (nutritionAdherence.status === 'insufficient_data') {
    if (hasTodayNutritionLog) return null;
    return {
      id: 'nutrition_no_log',
      domain: 'data_quality',
      title: 'תעד את התזונה היום',
      message: 'לא נמצא לוג תזונה להיום. מעקב יומי עוזר להגיע למטרה.',
      reason: 'אין נתוני תזונה להיום',
      reasonCode: 'nutrition_missing_log',
      cta: { label: 'הוסף ארוחה', href: '/nutrition' },
      scoreFactors: {
        impact: 0.5,
        confidence: 0.9,
        persistence: 0.3,
        urgency: 0.6,
        actionability: 1.0,
      },
      supportingSignals: [
        { key: 'no_nutrition_log_today', label: 'אין לוג תזונה להיום' },
      ],
    };
  }

  if (nutritionAdherence.status === 'good') return null;

  const isPoor = nutritionAdherence.status === 'poor';
  const goalUrgency = goal === 'cut' ? 1.0 : goal === 'bulk' ? 0.8 : 0.65;
  const persistence = Math.min((nutritionAdherence.totalTrackedDays ?? 0) / 7, 1.0);

  const reasonCode = isPoor
    ? goal === 'cut'  ? 'nutrition_low_adherence_cut'
    : goal === 'bulk' ? 'nutrition_low_adherence_bulk'
    :                   'nutrition_low_adherence'
    : 'nutrition_partial_adherence';

  return {
    id: isPoor ? 'nutrition_poor' : 'nutrition_partial',
    domain: 'nutrition',
    title: isPoor ? 'תזונה לא עומדת ביעד' : 'תזונה חלקית',
    message: isPoor
      ? 'רוב הימים האחרונים לא עמדת ביעדי החלבון/קלוריות. זה משפיע ישירות על ההתקדמות.'
      : 'חלק מהימים האחרונים לא עמדת ביעדים. שיפור קטן יכול לעשות הבדל.',
    reason: nutritionAdherence.reason,
    reasonCode,
    cta: { label: 'הוסף ארוחה', href: '/nutrition' },
    scoreFactors: {
      impact: isPoor ? 0.8 : 0.55,
      confidence: levelToNumber(nutritionAdherence.confidence),
      persistence,
      urgency: isPoor ? goalUrgency : goalUrgency * 0.6,
      actionability: 0.9,
    },
    supportingSignals: [
      { key: 'protein_days_met',       label: 'ימי חלבון שעמדו ביעד',    value: nutritionAdherence.proteinDaysMet },
      { key: 'calorie_days_in_range',  label: 'ימי קלוריות שעמדו ביעד', value: nutritionAdherence.calorieDaysInRange },
      { key: 'total_tracked_days',     label: 'ימים מעוקבים',             value: nutritionAdherence.totalTrackedDays },
    ],
  };
};

const buildWeightTrendCandidate = (
  goalKpiStatus: GoalKPIStatusResult,
  goal: GoalType
): CandidateInsight | null => {
  // Gate: need a negative signal with at least partial data and non-low confidence
  if (goalKpiStatus.status !== 'negative') return null;
  if (goalKpiStatus.dataQuality === 'missing') return null;
  if (goalKpiStatus.confidence === 'low') return null;

  const contentByGoal: Record<string, { title: string; message: string; reasonCode: string }> = {
    bulk:     { title: 'משקל לא עולה',  message: 'בתקופת מסה, ציפי לעלייה קלה. ייתכן שיש מחסור קלורי.',            reasonCode: 'weight_not_gaining_bulk' },
    cut:      { title: 'משקל לא יורד', message: 'בתקופת חיטוב, המשקל לא יורד לפי הצפי. בדוק את צריכת הקלוריות.', reasonCode: 'weight_not_losing_cut' },
    maintain: { title: 'משקל לא יציב', message: 'בתקופת שמירה, המשקל משתנה יותר מהרצוי.',                          reasonCode: 'weight_unstable_maintain' },
  };
  const content = contentByGoal[goal] ?? {
    title: 'מגמת משקל לא תואמת',
    message: 'מגמת המשקל לא תואמת את המטרה הנוכחית.',
    reasonCode: 'weight_misaligned',
  };

  return {
    id: `weight_misaligned_${goal || 'unknown'}`,
    domain: 'weight_trend',
    title: content.title,
    message: content.message,
    reason: goalKpiStatus.reason,
    reasonCode: content.reasonCode,
    cta: { label: 'עדכן תזונה', href: '/nutrition' },
    scoreFactors: {
      impact: 0.75,
      confidence: levelToNumber(goalKpiStatus.confidence),
      persistence: 0.7,
      urgency: 0.6,
      actionability: 0.75,
    },
    supportingSignals: [
      { key: 'primary_kpi',     label: 'KPI ראשי',     value: goalKpiStatus.primaryKPI ?? 'unknown' },
      { key: 'data_quality',    label: 'איכות נתונים', value: goalKpiStatus.dataQuality },
      { key: 'kpi_reason',      label: 'סיבה',          value: goalKpiStatus.reason },
    ],
  };
};

const buildConsistencyCandidate = (
  workoutConsistency: WorkoutConsistencyResult
): CandidateInsight | null => {
  const target = workoutConsistency.weeklyTarget;
  const completed = workoutConsistency.lastWeek?.completed ?? 0;
  const ratio = target > 0 ? completed / target : null;

  if (ratio === null || ratio >= 0.7) return null;

  const isLow = ratio < 0.4;

  return {
    id: isLow ? 'consistency_low' : 'consistency_medium',
    domain: 'consistency',
    title: isLow ? 'עקביות נמוכה' : 'עקביות חלקית',
    message: `שבוע שעבר בוצעו ${completed} מתוך ${target} אימונים מתוכננים.`,
    reason: workoutConsistency.reason,
    reasonCode: 'consistency_below_threshold',
    cta: { label: 'התחל אימון', href: '/workout' },
    scoreFactors: {
      impact: isLow ? 0.75 : 0.5,
      confidence: levelToNumber(workoutConsistency.confidence),
      persistence: isLow ? 0.8 : 0.5,
      urgency: 0.6,
      actionability: 0.85,
    },
    supportingSignals: [
      { key: 'last_week_completed', label: 'אימונים שבוצעו שבוע שעבר', value: completed },
      { key: 'weekly_target',       label: 'יעד שבועי',                value: target },
      { key: 'completion_ratio',    label: 'אחוז ביצוע',               value: `${Math.round(ratio * 100)}%` },
    ],
  };
};

const buildProgressCandidate = (
  progressStatus: ProgressStatusResult,
  goalKpiStatus: GoalKPIStatusResult
): CandidateInsight | null => {
  if (progressStatus.status !== 'off_track') return null;
  // Gate: require valid KPI and baseline — avoid emitting on pure data gaps
  if (goalKpiStatus.status === 'insufficient_data') return null;
  if (progressStatus.confidence === 'low') return null;

  const breakdown = progressStatus.breakdown;
  const signals: SupportingSignal[] = [];
  if (breakdown.exercise.trend !== 'insufficient_data')
    signals.push({ key: 'exercise_trend',   label: 'מגמת תרגילים',  value: breakdown.exercise.trend });
  if (breakdown.nutrition !== 'insufficient_data')
    signals.push({ key: 'nutrition_status', label: 'תזונה',          value: breakdown.nutrition });
  if (breakdown.consistency !== 'insufficient_data')
    signals.push({ key: 'consistency',      label: 'עקביות',         value: breakdown.consistency });
  if (breakdown.weight !== 'insufficient_data')
    signals.push({ key: 'weight_trend',     label: 'מגמת משקל',     value: breakdown.weight });

  return {
    id: 'progress_off_track',
    domain: 'progress',
    title: 'לא בכיוון הנכון',
    message: progressStatus.reason,
    reason: progressStatus.reason,
    reasonCode: 'progress_off_track',
    cta: { label: 'סקור תוכנית', href: '/profile' },
    scoreFactors: {
      impact: 0.7,
      confidence: levelToNumber(progressStatus.confidence),
      persistence: 0.65,
      urgency: 0.55,
      actionability: 0.6,
    },
    supportingSignals: signals,
  };
};

const buildMissingWeightCandidate = (hasTodayWeight: boolean): CandidateInsight | null => {
  if (hasTodayWeight) return null;
  return {
    id: 'weight_no_log',
    domain: 'data_quality',
    title: 'תעד משקל היום',
    message: 'לא נמצא מדידת משקל להיום. מעקב יומי מאפשר ניתוח מדויק יותר.',
    reason: 'אין נתוני משקל להיום',
    reasonCode: 'reminder_log_weight',
    cta: { label: 'הוסף משקל', href: '/home' },
    scoreFactors: {
      impact: 0.2,
      confidence: 0.95,
      persistence: 0.25,
      urgency: 0.35,
      actionability: 1.0,
    },
    supportingSignals: [
      { key: 'no_weight_log_today', label: 'אין מדידת משקל להיום' },
    ],
    isReminder: true,
  };
};

// ─── Fallbacks ────────────────────────────────────────────────────────────────

const makeFallback = (
  id: string,
  title: string,
  message: string,
  reasonCode: string,
  ctaLabel: string
): HomeRecommendation => ({
  id,
  domain: 'data_quality',
  title,
  message,
  reason: message,
  reasonCode,
  cta: { label: ctaLabel, href: '/home' },
  score: 0,
  confidence: 0,
  scoreVector: { impact: 0, confidence: 0, persistence: 0, urgency: 0, actionability: 0 },
  supportingSignals: [],
});

const FALLBACK_INSUFFICIENT_DATA = makeFallback(
  'insufficient_data',
  'נדרשים נתונים ראשוניים',
  'עדיין אין מספיק נתונים לניתוח. התחל לתעד אימונים, תזונה ומשקל.',
  'fallback_insufficient_data',
  'התחל לתעד'
);

const FALLBACK_KEEP_LOGGING = makeFallback(
  'keep_logging',
  'המשך לתעד',
  'יש כבר נתונים ראשוניים — המשך לתעד כדי לקבל המלצות מדויקות יותר.',
  'fallback_keep_logging',
  'הוסף נתונים'
);

const FALLBACK_MAINTAIN_COURSE = makeFallback(
  'maintain_course',
  'המשך כך',
  'כל המדדים נראים תקינים. המשך לפי התוכנית.',
  'fallback_maintain_course',
  'לאימון'
);

FALLBACK_MAINTAIN_COURSE.cta = { label: 'לאימון', href: '/workout' };

// ─── Fallback Selection ───────────────────────────────────────────────────────

const selectFallback = (input: PriorityEngineInput): HomeRecommendation => {
  const { progressStatus, nutritionAdherence, trainingLoad, goalKpiStatus } = input;

  const insufficientDomains = [
    progressStatus.status === 'insufficient_data',
    nutritionAdherence.status === 'insufficient_data',
    trainingLoad.status === 'insufficient_data',
    goalKpiStatus.status === 'insufficient_data',
  ].filter(Boolean).length;

  // All 4 domains have no data → brand-new user or never logged
  if (insufficientDomains >= 4) return FALLBACK_INSUFFICIENT_DATA;

  // Majority of data missing or overall confidence too low to conclude
  if (insufficientDomains >= 2 || progressStatus.confidence === 'low') return FALLBACK_KEEP_LOGGING;

  return FALLBACK_MAINTAIN_COURSE;
};

// ─── Tie-break ────────────────────────────────────────────────────────────────

const DOMAIN_ORDER: Record<InsightDomain, number> = {
  fatigue: 1,
  nutrition: 2,
  weight_trend: 3,
  consistency: 4,
  progress: 5,
  data_quality: 6,
};

type ScoredInsight = CandidateInsight & { score: number };

const tieBreak = (a: ScoredInsight, b: ScoredInsight): number => {
  if (b.score !== a.score)
    return b.score - a.score;
  if (b.scoreFactors.impact !== a.scoreFactors.impact)
    return b.scoreFactors.impact - a.scoreFactors.impact;
  if (b.scoreFactors.confidence !== a.scoreFactors.confidence)
    return b.scoreFactors.confidence - a.scoreFactors.confidence;
  if (b.scoreFactors.urgency !== a.scoreFactors.urgency)
    return b.scoreFactors.urgency - a.scoreFactors.urgency;
  if (b.scoreFactors.actionability !== a.scoreFactors.actionability)
    return b.scoreFactors.actionability - a.scoreFactors.actionability;
  if (DOMAIN_ORDER[a.domain] !== DOMAIN_ORDER[b.domain])
    return DOMAIN_ORDER[a.domain] - DOMAIN_ORDER[b.domain];
  return a.id.localeCompare(b.id);
};

// ─── Main Engine ──────────────────────────────────────────────────────────────

export const getHomePriorityRecommendation = (
  input: PriorityEngineInput
): HomeRecommendation => {
  const {
    goal, progressStatus, nutritionAdherence,
    trainingLoad, goalKpiStatus, workoutConsistency,
    hasTodayNutritionLog, hasTodayWeight,
  } = input;

  const raw: Array<CandidateInsight | null> = [
    buildFatigueCandidate(trainingLoad),
    buildNutritionCandidate(nutritionAdherence, goal, hasTodayNutritionLog),
    buildWeightTrendCandidate(goalKpiStatus, goal),
    buildConsistencyCandidate(workoutConsistency),
    buildProgressCandidate(progressStatus, goalKpiStatus),
    buildMissingWeightCandidate(hasTodayWeight),
  ];

  const scored: ScoredInsight[] = raw
    .filter((c): c is CandidateInsight => c !== null)
    .map((c) => ({ ...c, score: calculateScore(c.scoreFactors) }));

  // Real insights: non-reminder candidates above threshold
  const realInsights = scored
    .filter((c) => !c.isReminder && c.score >= MIN_SCORE_THRESHOLD)
    .sort(tieBreak);

  // Reminders only win when no real insight passes threshold
  const reminders = scored
    .filter((c) => c.isReminder && c.score >= MIN_SCORE_THRESHOLD)
    .sort(tieBreak);

  const winner = realInsights[0] ?? reminders[0];
  if (!winner) return selectFallback(input);

  return {
    id: winner.id,
    domain: winner.domain,
    title: winner.title,
    message: winner.message,
    reason: winner.reason,
    reasonCode: winner.reasonCode,
    cta: winner.cta,
    score: round2(winner.score),
    confidence: round2(winner.scoreFactors.confidence),
    scoreVector: {
      impact:        round2(winner.scoreFactors.impact),
      confidence:    round2(winner.scoreFactors.confidence),
      persistence:   round2(winner.scoreFactors.persistence),
      urgency:       round2(winner.scoreFactors.urgency),
      actionability: round2(winner.scoreFactors.actionability),
    },
    supportingSignals: winner.supportingSignals,
  };
};
