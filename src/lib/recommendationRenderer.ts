// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * All known template variable keys. Only these can appear in {placeholders}.
 * Add new keys here when adding new templates that need new variables.
 */
export type TemplateVariableMap = {
  goalLabel: string;
  weeklyTarget: string;
  lastWeekCompleted: string;
  completedThisWeek: string;
  todayWorkoutName: string;
  exerciseDownCount: string;
  consistencyPct: string;
};

export type RecommendationTemplate = {
  id: string;
  type: 'daily' | 'weekly' | 'recovery';
  priority: number;  // higher = selected first when multiple match
  enabled: boolean;

  conditions: {
    requiresWorkoutDay?: boolean;       // must be todayIsWorkoutDay
    requiresRestDay?: boolean;           // must NOT be todayIsWorkoutDay
    requiresTodayWorkoutDone?: boolean;  // today's workout already done
    requiresGoal?: Array<'bulk' | 'cut' | 'maintain'>;
    requiresExerciseTrend?: Array<'up' | 'stable' | 'down' | 'insufficient_data'>;
    requiresDecliningExercise?: boolean;
    requiresPlateauExercise?: boolean;
    requiresImprovingExercise?: boolean;
    requiresNutritionStatus?: Array<'good' | 'partial' | 'poor' | 'insufficient_data'>;
    requiresWeightTrend?: Array<'up' | 'stable' | 'down' | 'insufficient_data'>;
    requiresFatigueDetected?: boolean;
    requiresConsistencyIssue?: boolean;
    requiresGoalKpiNegative?: boolean;
    requiresProgressStatus?: Array<'on_track' | 'partial' | 'off_track' | 'insufficient_data'>;
    requiresTopGapType?: Array<'weight' | 'nutrition' | 'workout'>;
    requiresHasTodayWeight?: boolean;
    requiresHasTodayNutritionLog?: boolean;
    requiresHighGap?: boolean;
  };

  /** Variable keys used in title/body — documentation only, not enforced at runtime */
  variables: Array<keyof TemplateVariableMap>;

  title: string;
  body: string;
  ctaLabel?: string;
  ctaHref?: string;
};

export type RenderedRecommendation = {
  id: string;
  type: 'daily' | 'weekly' | 'recovery';
  title: string;
  body: string;
  cta: { label: string; href: string } | null;
};

// ─── Renderer ─────────────────────────────────────────────────────────────────

/**
 * Replaces {key} placeholders in template strings with values from the variable map.
 * Unknown keys are left as empty string (never throws).
 */
export const renderRecommendationTemplate = (
  template: RecommendationTemplate,
  variables: Partial<TemplateVariableMap>
): RenderedRecommendation => {
  const fill = (text: string): string =>
    text.replace(
      /\{(\w+)\}/g,
      (_, key: string) => String(variables[key as keyof TemplateVariableMap] ?? '')
    );

  return {
    id: template.id,
    type: template.type,
    title: fill(template.title),
    body: fill(template.body),
    cta:
      template.ctaLabel && template.ctaHref
        ? { label: fill(template.ctaLabel), href: template.ctaHref }
        : null,
  };
};
