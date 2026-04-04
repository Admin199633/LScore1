import type { RecommendationTemplate } from './recommendationRenderer';

/**
 * Daily recommendation templates — shown in Box 1.
 * Ordered by priority within the file for readability; actual selection uses the
 * `priority` field. Higher priority = selected first when multiple templates match.
 *
 * To add a new template: append an entry here with a unique id and conditions.
 */
export const DAILY_TEMPLATES: RecommendationTemplate[] = [
  // ── High-signal workout-day templates ─────────────────────────────────────

  {
    id: 'daily_workout_day_declining',
    type: 'daily',
    priority: 120,
    enabled: true,
    conditions: {
      requiresWorkoutDay: true,
      requiresDecliningExercise: true,
    },
    variables: ['todayWorkoutName'],
    title: 'שים לב לביצועים היום',
    body: 'יש ירידה בביצועים בתרגילים מסוימים. כדאי להתמקד בטכניקה ובעומס היום ולא לדחוף יותר מדי.',
    ctaLabel: 'לאימון',
    ctaHref: '/workout',
  },

  {
    id: 'daily_workout_day_plateau',
    type: 'daily',
    priority: 115,
    enabled: true,
    conditions: {
      requiresWorkoutDay: true,
      requiresPlateauExercise: true,
    },
    variables: ['todayWorkoutName'],
    title: 'שבור את התקיעות היום',
    body: 'אתה תקוע בביצועים בתרגיל אחד לפחות. כדאי לנסות שינוי קטן — עומס שונה, מנוחה ארוכה יותר, או גרסה אחרת של התרגיל.',
    ctaLabel: 'לאימון',
    ctaHref: '/workout',
  },

  {
    id: 'daily_workout_day_fatigue',
    type: 'daily',
    priority: 110,
    enabled: true,
    conditions: {
      requiresWorkoutDay: true,
      requiresFatigueDetected: true,
    },
    variables: [],
    title: 'אימון קל היום',
    body: 'נרשמו סימני עומס מהאימונים האחרונים. כדאי לאמן היום בעצימות נמוכה יותר ולהתמקד בטכניקה.',
    ctaLabel: 'לאימון',
    ctaHref: '/workout',
  },

  {
    id: 'daily_workout_day_consistency_issue',
    type: 'daily',
    priority: 105,
    enabled: true,
    conditions: {
      requiresWorkoutDay: true,
      requiresConsistencyIssue: true,
    },
    variables: [],
    title: 'זמן לחזור לעקביות',
    body: 'שבוע שעבר פוספסו אימונים. היום הוא הזדמנות להחזיר את המומנטום — אל תדלג.',
    ctaLabel: 'לאימון',
    ctaHref: '/workout',
  },

  {
    id: 'daily_workout_day_ready',
    type: 'daily',
    priority: 95,
    enabled: true,
    conditions: {
      requiresWorkoutDay: true,
    },
    variables: ['todayWorkoutName'],
    title: 'יום אימון — קדימה!',
    body: 'היום בתוכנית: {todayWorkoutName}. סיום אימון היום ישמור על העקביות וידחוף את ההתקדמות.',
    ctaLabel: 'לאימון',
    ctaHref: '/workout',
  },

  // ── Post-workout templates ─────────────────────────────────────────────────

  {
    id: 'daily_workout_done_log_nutrition',
    type: 'daily',
    priority: 90,
    enabled: true,
    conditions: {
      requiresTodayWorkoutDone: true,
      requiresHasTodayNutritionLog: false,
    },
    variables: [],
    title: 'כל הכבוד — עכשיו תזון!',
    body: 'סיימת אימון היום. חשוב לתדלק את הגוף עם חלבון וקלוריות מספיקות כדי לאפשר התאוששות מיטבית.',
    ctaLabel: 'הוסף ארוחה',
    ctaHref: '/nutrition',
  },

  {
    id: 'daily_workout_done_great',
    type: 'daily',
    priority: 80,
    enabled: true,
    conditions: {
      requiresTodayWorkoutDone: true,
    },
    variables: [],
    title: 'אימון הושלם!',
    body: 'כל הכבוד על האימון. עכשיו חשוב לתזונה, שתייה ומנוחה כדי להתאושש ולהתחזק.',
    ctaLabel: 'הוסף ארוחה',
    ctaHref: '/nutrition',
  },

  // ── Rest-day templates ─────────────────────────────────────────────────────

  {
    id: 'daily_rest_day_fatigue',
    type: 'daily',
    priority: 100,
    enabled: true,
    conditions: {
      requiresFatigueDetected: true,
    },
    variables: [],
    title: 'הגוף צריך מנוחה',
    body: 'נרשמו סימני עומס מהאימונים האחרונים. יום מנוחה פעילה — הליכה קלה, שינה, תזונה טובה — יסייע להתאוששות.',
    ctaLabel: 'עדכן תזונה',
    ctaHref: '/nutrition',
  },

  {
    id: 'daily_rest_day_nutrition_issue',
    type: 'daily',
    priority: 88,
    enabled: true,
    conditions: {
      requiresRestDay: true,
      requiresNutritionStatus: ['poor', 'partial'],
    },
    variables: [],
    title: 'יום מנוחה — התמקד בתזונה',
    body: 'היום לא יום אימון — זה זמן טוב להשלים את תיעוד התזונה ולוודא שהגעת לדרישות החלבון.',
    ctaLabel: 'עדכן תזונה',
    ctaHref: '/nutrition',
  },

  {
    id: 'daily_rest_day_log_weight',
    type: 'daily',
    priority: 75,
    enabled: true,
    conditions: {
      requiresRestDay: true,
      requiresHasTodayWeight: false,
    },
    variables: [],
    title: 'יום מנוחה — תעד משקל',
    body: 'יום מנוחה הוא זמן טוב לשקילה. מעקב עקבי עוזר לזהות מגמות ולדייק את ההמלצות.',
    ctaLabel: 'הזן משקל',
    ctaHref: '/home',
  },

  {
    id: 'daily_rest_day_recovery',
    type: 'daily',
    priority: 65,
    enabled: true,
    conditions: {
      requiresRestDay: true,
    },
    variables: [],
    title: 'יום מנוחה — התאושש',
    body: 'יום מנוחה הוא חלק בלתי נפרד מהאימון. נצל אותו לתזונה טובה, שינה מספקת ומנוחה.',
    ctaLabel: 'עדכן תזונה',
    ctaHref: '/nutrition',
  },

  // ── Goal-specific fallback ────────────────────────────────────────────────

  {
    id: 'daily_cut_nutrition_focus',
    type: 'daily',
    priority: 85,
    enabled: true,
    conditions: {
      requiresGoal: ['cut'],
      requiresNutritionStatus: ['poor', 'partial'],
    },
    variables: [],
    title: 'תזונה קריטית לחיטוב',
    body: 'בתקופת חיטוב, תזונה מדויקת היא המפתח. כדאי לתעד היום את כל הארוחות ולשמור על גירעון קלורי.',
    ctaLabel: 'עדכן תזונה',
    ctaHref: '/nutrition',
  },

  {
    id: 'daily_bulk_weight_not_gaining',
    type: 'daily',
    priority: 85,
    enabled: true,
    conditions: {
      requiresGoal: ['bulk'],
      requiresGoalKpiNegative: true,
    },
    variables: [],
    title: 'בדוק את הצריכה הקלורית',
    body: 'במסה, חשוב לשמור על עודף קלורי. המשקל לא מראה עלייה צפויה — כדאי לבדוק את הצריכה הקלורית היומית.',
    ctaLabel: 'עדכן תזונה',
    ctaHref: '/nutrition',
  },
];

/**
 * Daily fallback — shown when no template matches.
 * Uses the lowest possible priority so it never competes with real templates.
 */
export const DAILY_FALLBACK: RecommendationTemplate = {
  id: 'daily_fallback',
  type: 'daily',
  priority: 0,
  enabled: true,
  conditions: {},
  variables: [],
  title: 'המשך לפי התוכנית',
  body: 'המשך לתעד אימונים, תזונה ומשקל. ככל שיש יותר נתונים, ההמלצות יהיו מדויקות יותר.',
  ctaLabel: 'לאימון',
  ctaHref: '/workout',
};
