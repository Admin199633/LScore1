import {
  compareSessionScoresWithTolerance,
  getSessionBestScoreForEngine,
} from './performanceEngine';

export const detectFatigue = (exerciseHistory = []) => {
  if (!Array.isArray(exerciseHistory) || exerciseHistory.length === 0) {
    return false;
  }

  const recentSessions = exerciseHistory.slice(-3);
  const scores = recentSessions
    .map(getSessionBestScoreForEngine)
    .filter((score) => typeof score === 'number' && score > 0);

  const hasPerformanceDrop =
    scores.length >= 3 &&
    compareSessionScoresWithTolerance(scores[0], scores[1]) === 'down' &&
    compareSessionScoresWithTolerance(scores[1], scores[2]) === 'down';

  const hardSetCount = recentSessions
    .flatMap((session) => session?.sets || [])
    .filter((setItem) => setItem?.difficulty === 'hard' || setItem?.difficulty === 'failure')
    .length;

  return hasPerformanceDrop || hardSetCount >= 3;
};
