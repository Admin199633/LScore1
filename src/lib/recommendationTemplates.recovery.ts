import type { RecommendationTemplate } from './recommendationRenderer';

/**
 * Recovery / data-gap templates — shown in Box 3 only when there is a gap.
 * These map directly to DataGap types from dataCompleteness.ts.
 *
 * To add a new template: append an entry with the relevant requiresTopGapType.
 */
export const RECOVERY_TEMPLATES: RecommendationTemplate[] = [
  {
    id: 'recovery_weight_missing',
    type: 'recovery',
    priority: 100,
    enabled: true,
    conditions: {
      requiresTopGapType: ['weight'],
      requiresHighGap: true,
    },
    variables: [],
    title: 'עדכן משקל גוף',
    body: 'לא הוזן משקל בימים האחרונים. עדכון קצר ישפר את דיוק התובנות וההמלצות.',
    ctaLabel: 'הזן משקל',
    ctaHref: '/home?recovery=weight',
  },

  {
    id: 'recovery_nutrition_missing',
    type: 'recovery',
    priority: 100,
    enabled: true,
    conditions: {
      requiresTopGapType: ['nutrition'],
      requiresHighGap: true,
    },
    variables: [],
    title: 'השלם תיעוד תזונה',
    body: 'חסרים נתוני תזונה מהימים האחרונים. השלמתם תשפר את דיוק ההמלצות.',
    ctaLabel: 'עדכן תזונה',
    ctaHref: '/nutrition?recovery=nutrition',
  },

  {
    id: 'recovery_workout_missing',
    type: 'recovery',
    priority: 100,
    enabled: true,
    conditions: {
      requiresTopGapType: ['workout'],
      requiresHighGap: true,
    },
    variables: [],
    title: 'תעד את האימון הבא',
    body: 'חסר תיעוד אימון מהתקופה האחרונה. שמירת האימון הבא תשפר את המעקב ואת דיוק ההמלצות.',
    ctaLabel: 'לאימון',
    ctaHref: '/workout?recovery=workout',
  },

  // Medium severity (shown only when overall status is not complete)
  {
    id: 'recovery_weight_partial',
    type: 'recovery',
    priority: 60,
    enabled: true,
    conditions: {
      requiresTopGapType: ['weight'],
    },
    variables: [],
    title: 'כדאי לעדכן משקל',
    body: 'לא הוזן משקל לאחרונה. מעקב עקבי עוזר לזהות מגמות ולדייק את ההמלצות.',
    ctaLabel: 'הזן משקל',
    ctaHref: '/home?recovery=weight',
  },

  {
    id: 'recovery_nutrition_partial',
    type: 'recovery',
    priority: 60,
    enabled: true,
    conditions: {
      requiresTopGapType: ['nutrition'],
    },
    variables: [],
    title: 'כדאי להשלים תיעוד תזונה',
    body: 'חסרים כמה ימי תיעוד תזונה. השלמה תעזור לקבל תמונה מדויקת יותר.',
    ctaLabel: 'עדכן תזונה',
    ctaHref: '/nutrition?recovery=nutrition',
  },

  {
    id: 'recovery_workout_partial',
    type: 'recovery',
    priority: 60,
    enabled: true,
    conditions: {
      requiresTopGapType: ['workout'],
    },
    variables: [],
    title: 'כדאי לתעד אימון',
    body: 'חסר תיעוד של אימון לאחרונה. שמירת האימון הבא תשפר את המעקב.',
    ctaLabel: 'לאימון',
    ctaHref: '/workout?recovery=workout',
  },
];
