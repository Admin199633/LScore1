export const getLast7BodyweightEntries = (bodyweightLogs = []) => {
  if (!Array.isArray(bodyweightLogs)) {
    return [];
  }

  return bodyweightLogs.slice(-7);
};

export const calculateBodyweightTrend = (bodyweightLogs = []) => {
  if (!Array.isArray(bodyweightLogs)) {
    return 'stable';
  }

  const recentEntries = getLast7BodyweightEntries(bodyweightLogs);

  if (recentEntries.length < 2) {
    return 'stable';
  }

  const firstWeight = recentEntries[0]?.weight || 0;
  const lastWeight = recentEntries[recentEntries.length - 1]?.weight || 0;
  const difference = lastWeight - firstWeight;

  if (difference > 0.3) {
    return 'up';
  }

  if (difference < -0.3) {
    return 'down';
  }

  return 'stable';
};
