import type { RecommendationTemplate } from './recommendationRenderer';

/**
 * Weekly recommendation templates — shown in Box 2.
 * These describe a single weekly focus goal, not a daily tip.
 * Higher priority = selected first when multiple templates match.
 *
 * To add a new template: append an entry here with a unique id and conditions.
 */
export const WEEKLY_TEMPLATES: RecommendationTemplate[] = [
  {
    id: 'weekly_declining_exercise_focus',
    type: 'weekly',
    priority: 120,
    enabled: true,
    conditions: {
      requiresDecliningExercise: true,
    },
    variables: [],
    title: 'מטרת השבוע: שפר ביצועים',
    body: 'יש ירידה בביצועים בתרגילים מסוימים. המטרה השבוע היא לחזור למגמה עולה — התמקד בעומס נכון ובמנוחה מספקת.',
    ctaLabel: 'לאימון',
    ctaHref: '/workout',
  },

  {
    id: 'weekly_plateau_break',
    type: 'weekly',
    priority: 115,
    enabled: true,
    conditions: {
      requiresPlateauExercise: true,
    },
    variables: [],
    title: 'מטרת השבוע: שבור את התקיעות',
    body: 'אתה תקוע בביצועים בתרגיל אחד לפחות. נסה שינוי קטן השבוע — עומס אחר, טווח חזרות שונה, או גרסה אחרת של התרגיל.',
    ctaLabel: 'לאימון',
    ctaHref: '/workout',
  },

  {
    id: 'weekly_off_track_recovery',
    type: 'weekly',
    priority: 110,
    enabled: true,
    conditions: {
      requiresProgressStatus: ['off_track'],
    },
    variables: [],
    title: 'מטרת השבוע: חזור למסלול',
    body: 'מספר מדדים מראים שאתה לא במסלול. המטרה השבוע היא לשפר לפחות גורם אחד — עקביות, תזונה, או ביצועים.',
    ctaLabel: 'סקור תוכנית',
    ctaHref: '/profile',
  },

  {
    id: 'weekly_consistency_goal',
    type: 'weekly',
    priority: 105,
    enabled: true,
    conditions: {
      requiresConsistencyIssue: true,
    },
    variables: ['weeklyTarget'],
    title: 'מטרת השבוע: עקביות',
    body: 'שבוע שעבר לא הושלמו כל האימונים. המטרה השבוע היא להגיע לכל {weeklyTarget} האימונים המתוכננים.',
    ctaLabel: 'לאימון',
    ctaHref: '/workout',
  },

  {
    id: 'weekly_cut_nutrition_discipline',
    type: 'weekly',
    priority: 100,
    enabled: true,
    conditions: {
      requiresGoal: ['cut'],
      requiresNutritionStatus: ['poor', 'partial'],
    },
    variables: [],
    title: 'מטרת השבוע: תזונה מדויקת',
    body: 'בחיטוב, תזונה עקבית היא המפתח. המטרה השבוע: לתעד כל ארוחה, לשמור על גירעון קלורי ולפגוע ביעד החלבון.',
    ctaLabel: 'עדכן תזונה',
    ctaHref: '/nutrition',
  },

  {
    id: 'weekly_bulk_calorie_surplus',
    type: 'weekly',
    priority: 100,
    enabled: true,
    conditions: {
      requiresGoal: ['bulk'],
      requiresGoalKpiNegative: true,
    },
    variables: [],
    title: 'מטרת השבוע: הגדל צריכה קלורית',
    body: 'אין עלייה צפויה במשקל. השבוע המטרה היא להכניס יותר קלוריות ולוודא עודף קלורי יומי עקבי.',
    ctaLabel: 'עדכן תזונה',
    ctaHref: '/nutrition',
  },

  {
    id: 'weekly_weight_stabilize',
    type: 'weekly',
    priority: 90,
    enabled: true,
    conditions: {
      requiresGoal: ['maintain'],
      requiresGoalKpiNegative: true,
    },
    variables: [],
    title: 'מטרת השבוע: ייצב משקל',
    body: 'המשקל משתנה יותר מהרצוי. בשמירה, המטרה היא לשמור על טווח יציב — בדוק קלוריות ועקביות.',
    ctaLabel: 'עדכן תזונה',
    ctaHref: '/nutrition',
  },

  {
    id: 'weekly_improving_keep_momentum',
    type: 'weekly',
    priority: 70,
    enabled: true,
    conditions: {
      requiresImprovingExercise: true,
      requiresProgressStatus: ['on_track'],
    },
    variables: [],
    title: 'מטרת השבוע: שמור על המומנטום',
    body: 'הביצועים עולים ואתה במסלול. המטרה השבוע היא לשמור על העקביות ולדחוף מעט יותר בכל תרגיל.',
    ctaLabel: 'לאימון',
    ctaHref: '/workout',
  },
];

/**
 * Weekly fallback — shown when no template matches.
 */
export const WEEKLY_FALLBACK: RecommendationTemplate = {
  id: 'weekly_fallback',
  type: 'weekly',
  priority: 0,
  enabled: true,
  conditions: {},
  variables: [],
  title: 'מטרת השבוע: המשך כך',
  body: 'המשך לאמן, לתעד ולשמור על עקביות. ככל שתתעד יותר, כך ההמלצות יהיו מדויקות יותר.',
  ctaLabel: 'לאימון',
  ctaHref: '/workout',
};
