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
  cta: { label: string; href: string };
  scoreFactors: ScoreFactors;
  supportingSignals: string[];
};

export type HomeRecommendation = {
  id: string;
  domain: InsightDomain;
  title: string;
  message: string;
  reason: string;
  cta: { label: string; href: string };
  score: number;
  confidence: number;
  supportingSignals: string[];
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

export const calculateScore = (f: ScoreFactors): number =>
  f.impact * WEIGHTS.impact +
  f.confidence * WEIGHTS.confidence +
  f.persistence * WEIGHTS.persistence +
  f.urgency * WEIGHTS.urgency +
  f.actionability * WEIGHTS.actionability;

// ─── Candidate Builders ───────────────────────────────────────────────────────

const buildFatigueCandidate = (trainingLoad: TrainingLoadResult): CandidateInsight | null => {
  if (trainingLoad.status !== 'high_load') return null;

  const flags = trainingLoad.flags;
  const onFlags: string[] = [];
  if (flags.performanceFlag === 'on') onFlags.push('ירידת ביצועים');
  if (flags.energyFlag === 'on') onFlags.push('אנרגיה נמוכה');
  if (flags.executionFlag === 'on') onFlags.push('פחות תרגילים הושלמו');
  if (flags.durationFlag === 'on') onFlags.push('אימון קצר יותר');
  if (flags.effortFlag === 'strong') onFlags.push('מאמץ גבוה דווח');

  return {
    id: 'fatigue_high',
    domain: 'fatigue',
    title: 'זמן להתאושש',
    message: 'האימונים האחרונים מציגים סימני עומס גבוה. מנוחה תסייע לביצועים.',
    reason: trainingLoad.reason,
    cta: { label: 'היסטוריית אימונים', href: '/workout-history' },
    scoreFactors: {
      impact: 0.85,
      confidence: levelToNumber(trainingLoad.confidence),
      persistence: Math.min(onFlags.length / 3, 1.0),
      urgency: 0.9,
      actionability: 0.7,
    },
    supportingSignals: onFlags,
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
      cta: { label: 'הוסף ארוחה', href: '/nutrition' },
      scoreFactors: {
        impact: 0.5,
        confidence: 0.9,
        persistence: 0.3,
        urgency: 0.6,
        actionability: 1.0,
      },
      supportingSignals: ['no_nutrition_log_today'],
    };
  }

  if (nutritionAdherence.status === 'good') return null;

  const isPoor = nutritionAdherence.status === 'poor';
  const goalUrgency = goal === 'cut' ? 1.0 : goal === 'bulk' ? 0.8 : 0.65;
  const persistence = Math.min((nutritionAdherence.totalTrackedDays ?? 0) / 7, 1.0);

  return {
    id: isPoor ? 'nutrition_poor' : 'nutrition_partial',
    domain: 'nutrition',
    title: isPoor ? 'תזונה לא עומדת ביעד' : 'תזונה חלקית',
    message: isPoor
      ? 'רוב הימים האחרונים לא עמדת ביעדי החלבון/קלוריות. זה משפיע ישירות על ההתקדמות.'
      : 'חלק מהימים האחרונים לא עמדת ביעדים. שיפור קטן יכול לעשות הבדל.',
    reason: nutritionAdherence.reason,
    cta: { label: 'הוסף ארוחה', href: '/nutrition' },
    scoreFactors: {
      impact: isPoor ? 0.8 : 0.55,
      confidence: levelToNumber(nutritionAdherence.confidence),
      persistence,
      urgency: isPoor ? goalUrgency : goalUrgency * 0.6,
      actionability: 0.9,
    },
    supportingSignals: [
      `ימי חלבון שעמדו ביעד: ${nutritionAdherence.proteinDaysMet}`,
      `ימי קלוריות שעמדו ביעד: ${nutritionAdherence.calorieDaysInRange}`,
      `ימים מעוקבים: ${nutritionAdherence.totalTrackedDays}`,
    ],
  };
};

const buildWeightTrendCandidate = (
  goalKpiStatus: GoalKPIStatusResult,
  goal: GoalType
): CandidateInsight | null => {
  if (goalKpiStatus.status !== 'negative') return null;
  if (goalKpiStatus.dataQuality === 'missing') return null;

  const contentByGoal: Record<string, { title: string; message: string }> = {
    bulk:     { title: 'משקל לא עולה',  message: 'בתקופת מסה, ציפי לעלייה קלה. ייתכן שיש מחסור קלורי.' },
    cut:      { title: 'משקל לא יורד', message: 'בתקופת חיטוב, המשקל לא יורד לפי הצפי. בדוק את צריכת הקלוריות.' },
    maintain: { title: 'משקל לא יציב', message: 'בתקופת שמירה, המשקל משתנה יותר מהרצוי.' },
  };
  const content = contentByGoal[goal] ?? {
    title: 'מגמת משקל לא תואמת',
    message: 'מגמת המשקל לא תואמת את המטרה הנוכחית.',
  };

  return {
    id: `weight_misaligned_${goal || 'unknown'}`,
    domain: 'weight_trend',
    title: content.title,
    message: content.message,
    reason: goalKpiStatus.reason,
    cta: { label: 'עדכן תזונה', href: '/nutrition' },
    scoreFactors: {
      impact: 0.75,
      confidence: levelToNumber(goalKpiStatus.confidence),
      persistence: 0.7,
      urgency: 0.6,
      actionability: 0.75,
    },
    supportingSignals: [
      `kpi: ${goalKpiStatus.primaryKPI ?? 'unknown'}`,
      goalKpiStatus.reason,
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
    cta: { label: 'התחל אימון', href: '/workout' },
    scoreFactors: {
      impact: isLow ? 0.75 : 0.5,
      confidence: levelToNumber(workoutConsistency.confidence),
      persistence: isLow ? 0.8 : 0.5,
      urgency: 0.6,
      actionability: 0.85,
    },
    supportingSignals: [
      `שבוע שעבר: ${completed}/${target} אימונים`,
    ],
  };
};

const buildProgressCandidate = (
  progressStatus: ProgressStatusResult
): CandidateInsight | null => {
  if (progressStatus.status !== 'off_track') return null;

  const breakdown = progressStatus.breakdown;
  const signals = [
    breakdown.exercise.trend !== 'insufficient_data' ? `תרגילים: ${breakdown.exercise.trend}` : null,
    breakdown.nutrition !== 'insufficient_data' ? `תזונה: ${breakdown.nutrition}` : null,
    breakdown.consistency !== 'insufficient_data' ? `עקביות: ${breakdown.consistency}` : null,
    breakdown.weight !== 'insufficient_data' ? `משקל: ${breakdown.weight}` : null,
  ].filter((s): s is string => s !== null);

  return {
    id: 'progress_off_track',
    domain: 'progress',
    title: 'לא בכיוון הנכון',
    message: progressStatus.reason,
    reason: progressStatus.reason,
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
    cta: { label: 'הוסף משקל', href: '/home' },
    scoreFactors: {
      impact: 0.35,
      confidence: 0.95,
      persistence: 0.3,
      urgency: 0.5,
      actionability: 1.0,
    },
    supportingSignals: ['no_weight_log_today'],
  };
};

// ─── Fallback ─────────────────────────────────────────────────────────────────

const FALLBACK: HomeRecommendation = {
  id: 'maintain_course',
  domain: 'progress',
  title: 'המשך כך',
  message: 'כל המדדים נראים תקינים. המשך לפי התוכנית.',
  reason: 'לא זוהתה בעיה בולטת',
  cta: { label: 'לאימון', href: '/workout' },
  score: 0,
  confidence: 0.5,
  supportingSignals: [],
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
  if (b.score !== a.score) return b.score - a.score;
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

  const candidates: Array<CandidateInsight | null> = [
    buildFatigueCandidate(trainingLoad),
    buildNutritionCandidate(nutritionAdherence, goal, hasTodayNutritionLog),
    buildWeightTrendCandidate(goalKpiStatus, goal),
    buildConsistencyCandidate(workoutConsistency),
    buildProgressCandidate(progressStatus),
    buildMissingWeightCandidate(hasTodayWeight),
  ];

  const scored: ScoredInsight[] = candidates
    .filter((c): c is CandidateInsight => c !== null)
    .map((c) => ({ ...c, score: calculateScore(c.scoreFactors) }))
    .filter((c) => c.score >= MIN_SCORE_THRESHOLD)
    .sort(tieBreak);

  const winner = scored[0];
  if (!winner) return FALLBACK;

  return {
    id: winner.id,
    domain: winner.domain,
    title: winner.title,
    message: winner.message,
    reason: winner.reason,
    cta: winner.cta,
    score: Math.round(winner.score * 100) / 100,
    confidence: Math.round(winner.scoreFactors.confidence * 100) / 100,
    supportingSignals: winner.supportingSignals,
  };
};
