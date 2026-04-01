export const getDailyRecommendation = ({
  performanceTrend,
  fatigue,
  bodyweightTrend,
}) => {
  let recommendation;

  if (performanceTrend === 'up' && fatigue === false) {
    recommendation = {
      status: 'increase',
      title: 'תתאמן כבד היום',
      action: 'נסה להעלות משקלים בתרגילים המרכזיים',
      explanation: 'התקדמות יציבה והתאוששות טובה',
    };
  } else if (performanceTrend === 'stable') {
    recommendation = {
      status: 'maintain',
      title: 'שמור על עומס',
      action: 'שמור על אותם משקלים',
      explanation: 'אין שינוי משמעותי בביצועים',
    };
  } else {
    recommendation = {
      status: 'reduce',
      title: 'תוריד עומס היום',
      action: 'התמקד בטכניקה או הורד משקל',
      explanation: 'ירידה בביצועים או עומס גבוה',
    };
  }

  if (bodyweightTrend !== 'up' && performanceTrend !== 'up') {
    return {
      ...recommendation,
      nutritionNote: 'תוסיף כ-150 קלוריות ביום',
    };
  }

  return recommendation;
};
