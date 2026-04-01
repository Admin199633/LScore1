export const getBestSet = (sets = []) => {
  if (!Array.isArray(sets) || sets.length === 0) {
    return null;
  }

  return sets.reduce((bestSet, currentSet) => {
    const bestScore = (bestSet.weight || 0) * (bestSet.reps || 0);
    const currentScore = (currentSet.weight || 0) * (currentSet.reps || 0);
    return currentScore > bestScore ? currentSet : bestSet;
  });
};

const PERFORMANCE_TOLERANCE = 0.05;

const getSessionBestScore = (session) => {
  const bestSet = getBestSet(session?.sets || []);
  return bestSet ? (bestSet.weight || 0) * (bestSet.reps || 0) : null;
};

const getValidRecentScores = (exerciseHistory = []) =>
  exerciseHistory
    .slice(-3)
    .map(getSessionBestScore)
    .filter((score) => typeof score === 'number' && score > 0);

const compareScores = (previousScore, nextScore, tolerance = PERFORMANCE_TOLERANCE) => {
  if (nextScore > previousScore * (1 + tolerance)) {
    return 'up';
  }

  if (nextScore < previousScore * (1 - tolerance)) {
    return 'down';
  }

  return 'stable';
};

export const calculatePerformanceTrend = (exerciseHistory = []) => {
  if (!Array.isArray(exerciseHistory)) {
    return 'stable';
  }

  const scores = getValidRecentScores(exerciseHistory);

  if (scores.length < 2) {
    return 'stable';
  }

  const latestScore = scores[scores.length - 1];
  const earlierScores = scores.slice(0, -1);
  const consecutiveComparisons = scores
    .slice(1)
    .map((score, index) => compareScores(scores[index], score));

  const isUp =
    earlierScores.every((score) => compareScores(score, latestScore) === 'up') &&
    consecutiveComparisons.every((comparison) => comparison === 'up' || comparison === 'stable') &&
    consecutiveComparisons.some((comparison) => comparison === 'up');

  if (isUp) {
    return 'up';
  }

  const isDown =
    earlierScores.every((score) => compareScores(score, latestScore) === 'down') &&
    consecutiveComparisons.every(
      (comparison) => comparison === 'down' || comparison === 'stable'
    ) &&
    consecutiveComparisons.some((comparison) => comparison === 'down');

  if (isDown) {
    return 'down';
  }

  return 'stable';
};

export const getSessionBestScoreForEngine = getSessionBestScore;
export const compareSessionScoresWithTolerance = compareScores;
