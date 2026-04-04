import type { RecommendationContext } from './recommendationContext';
import type { RecommendationTemplate, RenderedRecommendation } from './recommendationRenderer';
import { renderRecommendationTemplate } from './recommendationRenderer';
import { DAILY_TEMPLATES, DAILY_FALLBACK } from './recommendationTemplates.daily';
import { WEEKLY_TEMPLATES, WEEKLY_FALLBACK } from './recommendationTemplates.weekly';
import { RECOVERY_TEMPLATES } from './recommendationTemplates.recovery';

// ─── Condition Matching ───────────────────────────────────────────────────────

const conditionsMatch = (
  cond: RecommendationTemplate['conditions'],
  ctx: RecommendationContext
): boolean => {
  if (cond.requiresWorkoutDay === true && !ctx.todayIsWorkoutDay) return false;
  if (cond.requiresRestDay === true && ctx.todayIsWorkoutDay) return false;
  if (cond.requiresTodayWorkoutDone === true && !ctx.todayWorkoutDone) return false;
  if (cond.requiresTodayWorkoutDone === false && ctx.todayWorkoutDone) return false;
  if (cond.requiresGoal && !cond.requiresGoal.includes(ctx.goal as 'bulk' | 'cut' | 'maintain')) return false;
  if (cond.requiresExerciseTrend && !cond.requiresExerciseTrend.includes(ctx.exerciseTrend)) return false;
  if (cond.requiresDecliningExercise === true && !ctx.hasDecliningExercise) return false;
  if (cond.requiresPlateauExercise === true && !ctx.hasPlateauExercise) return false;
  if (cond.requiresImprovingExercise === true && !ctx.hasImprovingExercise) return false;
  if (cond.requiresNutritionStatus && !cond.requiresNutritionStatus.includes(ctx.nutritionStatus)) return false;
  if (cond.requiresWeightTrend && !cond.requiresWeightTrend.includes(ctx.weightTrend)) return false;
  if (cond.requiresFatigueDetected === true && !ctx.fatigueDetected) return false;
  if (cond.requiresConsistencyIssue === true && !ctx.hasConsistencyIssue) return false;
  if (cond.requiresGoalKpiNegative === true && !ctx.goalKpiNegative) return false;
  if (cond.requiresProgressStatus && !cond.requiresProgressStatus.includes(ctx.progressStatusLevel)) return false;
  if (cond.requiresTopGapType && (ctx.topGapType === null || !cond.requiresTopGapType.includes(ctx.topGapType))) return false;
  if (cond.requiresHasTodayWeight === true && !ctx.hasTodayWeight) return false;
  if (cond.requiresHasTodayWeight === false && ctx.hasTodayWeight) return false;
  if (cond.requiresHasTodayNutritionLog === true && !ctx.hasTodayNutritionLog) return false;
  if (cond.requiresHasTodayNutritionLog === false && ctx.hasTodayNutritionLog) return false;
  if (cond.requiresHighGap === true && !ctx.hasHighGap) return false;
  return true;
};

// ─── Variable Builder ─────────────────────────────────────────────────────────

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

// ─── Generic Selector ─────────────────────────────────────────────────────────

const selectTemplate = (
  templates: RecommendationTemplate[],
  ctx: RecommendationContext
): RecommendationTemplate | null => {
  const candidates = templates
    .filter((t) => t.enabled && conditionsMatch(t.conditions, ctx))
    .sort((a, b) => b.priority - a.priority);
  return candidates[0] ?? null;
};

// ─── Public Selectors ─────────────────────────────────────────────────────────

/**
 * Selects and renders the best-matching daily recommendation template.
 * Always returns a result (falls back to DAILY_FALLBACK).
 */
export const selectDailyRecommendation = (ctx: RecommendationContext): RenderedRecommendation => {
  const template = selectTemplate(DAILY_TEMPLATES, ctx) ?? DAILY_FALLBACK;
  return renderRecommendationTemplate(template, buildVariables(ctx));
};

/**
 * Selects and renders the best-matching weekly recommendation template.
 * Always returns a result (falls back to WEEKLY_FALLBACK).
 */
export const selectWeeklyRecommendation = (ctx: RecommendationContext): RenderedRecommendation => {
  const template = selectTemplate(WEEKLY_TEMPLATES, ctx) ?? WEEKLY_FALLBACK;
  return renderRecommendationTemplate(template, buildVariables(ctx));
};

/**
 * Selects and renders the best-matching recovery recommendation.
 * Returns null when there are no significant data gaps.
 *
 * Rules:
 * - High gap → show high-priority template for that gap type.
 * - Medium gap and overall status != complete → show medium template.
 * - No gaps → null (Box 3 hidden).
 */
export const selectRecoveryRecommendation = (
  ctx: RecommendationContext,
  overallStatus: 'complete' | 'partial' | 'poor'
): RenderedRecommendation | null => {
  if (ctx.topGapType === null) return null;

  // High gaps: check high-priority templates
  if (ctx.hasHighGap) {
    const template = selectTemplate(RECOVERY_TEMPLATES, ctx);
    if (template) return renderRecommendationTemplate(template, buildVariables(ctx));
  }

  // Medium gaps: only show when data is not complete
  if (!ctx.hasHighGap && overallStatus !== 'complete') {
    const template = selectTemplate(RECOVERY_TEMPLATES, ctx);
    if (template) return renderRecommendationTemplate(template, buildVariables(ctx));
  }

  return null;
};
