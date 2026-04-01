'use client';

import { useEffect, useMemo, useState } from 'react';
import { fetchBodyweightLogs, upsertBodyweightLog } from '@/lib/repositories/bodyweightRepository';
import { fetchNutritionLogs } from '@/lib/repositories/nutritionLogRepository';
import { fetchSavedWorkoutSessions } from '@/lib/repositories/workoutSessionRepository';
import {
  calculateBodyweightTrend,
  calculatePerformanceTrend,
  detectFatigue,
  getBestSet,
  getDailyRecommendation,
} from '@shared-engines/index';

const getTodayDate = () => new Date().toISOString().slice(0, 10);
const hasValidBestSet = (
  session: { sets?: Array<{ weight?: number | string; reps?: number | string }> } | null | undefined
) => {
  const bestSet = getBestSet(session?.sets || []);
  return Boolean(bestSet && (Number(bestSet.weight) || 0) * (Number(bestSet.reps) || 0) > 0);
};

const groupSessionsByExercise = (
  sessions: Array<{
    exercise: string;
    date: string;
    sets: Array<{ weight: number; reps: number; difficulty: string }>;
  }>
) =>
  sessions.reduce<Record<string, typeof sessions>>((groups, session) => {
    if (!session.exercise) {
      return groups;
    }

    const currentGroup = groups[session.exercise] || [];
    return {
      ...groups,
      [session.exercise]: [...currentGroup, session],
    };
  }, {});

const buildExerciseEvaluations = (
  sessions: Array<{
    exercise: string;
    date: string;
    sets: Array<{ weight: number; reps: number; difficulty: string }>;
  }>
) =>
  Object.entries(groupSessionsByExercise(sessions))
    .map(([exercise, history]) => {
      const recentHistory = history.slice(-3);
      const recentValidCount = recentHistory.filter(hasValidBestSet).length;

      if (recentValidCount < 2) {
        return null;
      }

      return {
        exercise,
        performanceTrend: calculatePerformanceTrend(recentHistory),
        fatigue: detectFatigue(recentHistory),
      };
    })
    .filter(Boolean) as Array<{ exercise: string; performanceTrend: string; fatigue: boolean }>;

export const useHomeData = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [bodyweightLogs, setBodyweightLogs] = useState<Array<{ date: string; weight: number }>>([]);
  const [nutritionLogs, setNutritionLogs] = useState<Array<{ date: string; totalProteinGrams: number }>>([]);
  const [workoutSessions, setWorkoutSessions] = useState<
    Array<{
      date: string;
      dayName: string;
      exercises: Array<{
        exerciseName: string;
        sets: Array<{ weight: string; reps: string; difficulty: string }>;
      }>;
    }>
  >([]);

  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      setIsLoading(true);
      setLoadError('');

      try {
        const [nextBodyweightLogs, nextNutritionLogs, nextWorkoutSessions] = await Promise.all([
          fetchBodyweightLogs(),
          fetchNutritionLogs(),
          fetchSavedWorkoutSessions(),
        ]);

        if (!isMounted) {
          return;
        }

        setBodyweightLogs(nextBodyweightLogs);
        setNutritionLogs(nextNutritionLogs);
        setWorkoutSessions(nextWorkoutSessions);
      } catch (error) {
        if (isMounted) {
          setLoadError(error instanceof Error ? error.message : 'טעינת הנתונים נכשלה.');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    load();

    return () => {
      isMounted = false;
    };
  }, []);

  const flattenedWorkoutSessions = useMemo(
    () =>
      workoutSessions.flatMap((workout) =>
        workout.exercises
          .filter((exercise) => exercise.exerciseName)
          .map((exercise) => ({
            date: workout.date,
            dayName: workout.dayName,
            exercise: exercise.exerciseName,
            sets: exercise.sets.map((setItem) => ({
              weight: Number(setItem.weight),
              reps: Number(setItem.reps),
              difficulty: setItem.difficulty,
            })),
          }))
      ),
    [workoutSessions]
  );

  const recommendation = useMemo(() => {
    const exerciseEvaluations = buildExerciseEvaluations(flattenedWorkoutSessions);

    if (exerciseEvaluations.length === 0) {
      return null;
    }

    const upCount = exerciseEvaluations.filter((item) => item.performanceTrend === 'up').length;
    const downCount = exerciseEvaluations.filter((item) => item.performanceTrend === 'down').length;
    const performanceTrend = downCount > upCount ? 'down' : upCount > downCount ? 'up' : 'stable';

    return getDailyRecommendation({
      performanceTrend,
      fatigue: exerciseEvaluations.some((item) => item.fatigue),
      bodyweightTrend: calculateBodyweightTrend(bodyweightLogs),
    });
  }, [bodyweightLogs, flattenedWorkoutSessions]);

  const saveBodyweight = async (date: string, weight: number) => {
    const savedEntry = await upsertBodyweightLog({ date, weight });
    setBodyweightLogs((current) =>
      [...current.filter((item) => item.date !== savedEntry.date), savedEntry].sort((left, right) =>
        left.date.localeCompare(right.date)
      )
    );
    return savedEntry;
  };

  return {
    isLoading,
    loadError,
    bodyweightLogs,
    nutritionLogs,
    workoutSessions,
    recommendation,
    saveBodyweight,
  };
};
