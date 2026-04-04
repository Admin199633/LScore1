import type { DataCompletenessResult, DataGap } from './dataCompleteness';

// ─── Types ────────────────────────────────────────────────────────────────────

export type SecondaryRecommendation = {
  id: string;
  title: string;
  message: string;
  cta: { label: string; href: string } | null;
  severity: 'high' | 'medium';
};

// ─── Gap → Recommendation ─────────────────────────────────────────────────────

const gapToRecommendation = (gap: DataGap): SecondaryRecommendation => {
  if (gap.type === 'weight') {
    return {
      id: 'secondary_weight',
      title: 'עדכן נתוני משקל',
      message: 'לא הוזן משקל בימים האחרונים, ולכן חלק מהתובנות עשויות להיות פחות מדויקות.',
      cta: { label: 'הזן משקל', href: '/home' },
      severity: gap.severity,
    };
  }

  if (gap.type === 'nutrition') {
    return {
      id: 'secondary_nutrition',
      title: 'עדכן נתוני תזונה',
      message: 'חסרים נתוני תזונה מהימים האחרונים. השלמתם תשפר את דיוק ההמלצות.',
      cta: { label: 'עדכן תזונה', href: '/nutrition' },
      severity: gap.severity,
    };
  }

  // workout
  const noProgram = gap.cta.href === '/profile';
  return {
    id: noProgram ? 'secondary_workout_no_plan' : 'secondary_workout_log',
    title: noProgram ? 'הגדר תוכנית אימונים' : 'תעד את האימון הבא',
    message: noProgram
      ? 'אין תוכנית אימונים פעילה, ולכן קשה לעקוב בצורה מדויקת אחרי ההתקדמות שלך.'
      : 'חסר תיעוד של אימונים מהתקופה האחרונה. כדאי לשמור את האימון הבא באפליקציה.',
    cta: gap.cta,
    severity: gap.severity,
  };
};

// ─── Main ─────────────────────────────────────────────────────────────────────

export const getSecondaryHomeRecommendation = (
  completeness: DataCompletenessResult
): SecondaryRecommendation | null => {
  const { gaps, overallStatus } = completeness;

  if (gaps.length === 0) return null;

  // gaps are already sorted: high before medium, weight→nutrition→workout within each tier
  const firstHigh = gaps.find((g) => g.severity === 'high');
  if (firstHigh) return gapToRecommendation(firstHigh);

  // medium only shown when status is not complete
  if (overallStatus !== 'complete') {
    const firstMedium = gaps.find((g) => g.severity === 'medium');
    if (firstMedium) return gapToRecommendation(firstMedium);
  }

  return null;
};
