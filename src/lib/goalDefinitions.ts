export type GoalType = 'bulk' | 'cut' | 'maintain' | '';
export type CanonicalGoalType = Exclude<GoalType, ''>;
export type GoalKPI = 'performance_trend' | 'weight_trend' | 'stability';
export type GoalSignal = 'nutrition_adherence' | 'workout_consistency' | 'performance_stability' | 'bodyweight_support';

export type GoalDefinition = {
  type: CanonicalGoalType;
  label: string;
  description: string;
  primaryObjective: string;
  primaryKPI: GoalKPI;
  supportingSignals: GoalSignal[];
  successCriteria: string[];
  failureCriteria: string[];
  preferredWeightTrend: 'up' | 'down' | 'stable' | null;
  preferredPerformanceTrend: 'up' | 'stable';
};

export const GOAL_DEFINITIONS: Record<CanonicalGoalType, GoalDefinition> = {
  cut: {
    type: 'cut',
    label: 'חיטוב',
    description: 'ירידה במשקל או שומן תוך ניסיון לשמור על ביצועים.',
    primaryObjective: 'לרדת במשקל או באחוז שומן בלי לאבד ביצועים בצורה מהותית.',
    primaryKPI: 'weight_trend',
    supportingSignals: ['performance_stability', 'nutrition_adherence', 'workout_consistency'],
    successCriteria: [
      'מגמת המשקל יורדת בהתאם למטרה.',
      'הביצועים נשמרים יציבים או משתפרים מעט.',
      'התזונה והעקביות תומכות בחיטוב לאורך זמן.',
    ],
    failureCriteria: [
      'המשקל לא יורד לאורך זמן.',
      'יש ירידה בביצועים יחד עם תזונה או עקביות חלשות.',
    ],
    preferredWeightTrend: 'down',
    preferredPerformanceTrend: 'stable',
  },
  bulk: {
    type: 'bulk',
    label: 'מסה',
    description: 'בניית שריר ושיפור ביצועים לאורך זמן עם תזונה תומכת.',
    primaryObjective: 'לשפר ביצועים ולבנות מסת שריר לאורך זמן.',
    primaryKPI: 'performance_trend',
    supportingSignals: ['nutrition_adherence', 'workout_consistency', 'bodyweight_support'],
    successCriteria: [
      'הביצועים במגמת עלייה.',
      'התזונה והעקביות תומכות בהתקדמות.',
      'המשקל יכול לתמוך, אבל הוא לא המדד הראשי.',
    ],
    failureCriteria: [
      'הביצועים לא עולים לאורך זמן.',
      'יש עלייה במשקל בלי התקדמות בביצועים.',
    ],
    preferredWeightTrend: 'up',
    preferredPerformanceTrend: 'up',
  },
  maintain: {
    type: 'maintain',
    label: 'שמירה',
    description: 'שמירה על משקל, ביצועים והרגלים בטווח יציב.',
    primaryObjective: 'לשמור על יציבות במשקל, בביצועים ובהרגלי האימון.',
    primaryKPI: 'stability',
    supportingSignals: ['performance_stability', 'workout_consistency', 'nutrition_adherence'],
    successCriteria: [
      'המשקל נשאר יציב בטווח.',
      'הביצועים נשארים יציבים.',
      'יש עקביות טובה בהרגלים.',
    ],
    failureCriteria: [
      'המשקל זז מהטווח היציב לאורך זמן.',
      'יש ירידה בביצועים יחד עם חוסר עקביות.',
    ],
    preferredWeightTrend: 'stable',
    preferredPerformanceTrend: 'stable',
  },
};

const GOAL_ALIASES: Record<string, CanonicalGoalType> = {
  bulk: 'bulk',
  muscle_gain: 'bulk',
  mass: 'bulk',
  'מסה': 'bulk',
  cut: 'cut',
  fat_loss: 'cut',
  shred: 'cut',
  'חיטוב': 'cut',
  maintain: 'maintain',
  maintenance: 'maintain',
  'שמירה': 'maintain',
};

export const normalizeGoalType = (goal: string | null | undefined): GoalType => {
  const normalized = String(goal || '').trim().toLowerCase();
  return GOAL_ALIASES[normalized] || '';
};

export const getGoalDefinition = (goal: string | GoalType | null | undefined): GoalDefinition | null => {
  const normalizedGoal = normalizeGoalType(goal);

  if (!normalizedGoal) {
    return null;
  }

  return GOAL_DEFINITIONS[normalizedGoal];
};

export const getGoalLabel = (goal: string | GoalType | null | undefined) =>
  getGoalDefinition(goal)?.label || 'לא הוגדרה מטרה';
