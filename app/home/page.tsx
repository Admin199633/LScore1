'use client';

import type { CSSProperties } from 'react';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { ProtectedPage } from '@/components/ProtectedPage';
import { BodyweightChart } from '@/components/BodyweightChart';
import { fetchBodyweightLogs, upsertBodyweightLog } from '@/lib/repositories/bodyweightRepository';
import { fetchCurrentProfile } from '@/lib/repositories/profileRepository';
import { fetchNutritionLogs } from '@/lib/repositories/nutritionLogRepository';
import { fetchSavedWorkoutSessions } from '@/lib/repositories/workoutSessionRepository';
import { useSessionContext } from '@/lib/session';
import {
  calculateBodyweightTrend,
  calculatePerformanceTrend,
  detectFatigue,
  getBestSet,
  getDailyRecommendation,
} from '@shared-engines/index';

const getTodayDate = () => new Date().toISOString().slice(0, 10);
const formatDisplayDate = (value: string) => {
  const [year, month, day] = value.split('-');
  return year && month && day ? `${day}.${month}.${year}` : value;
};

const hasValidBestSet = (
  session: { sets?: Array<{ weight?: number | string; reps?: number | string }> } | null | undefined
) => {
  const bestSet = getBestSet(session?.sets || []);
  return Boolean(bestSet && (Number(bestSet.weight) || 0) * (Number(bestSet.reps) || 0) > 0);
};

const groupSessionsByExercise = (
  sessions: Array<{ exercise: string; date: string; sets: Array<{ weight: number; reps: number; difficulty: string }> }>
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
  sessions: Array<{ exercise: string; date: string; sets: Array<{ weight: number; reps: number; difficulty: string }> }>
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

type Recommendation = {
  status: string;
  title: string;
  action: string;
  explanation: string;
  nutritionNote?: string;
};

export default function HomePage() {
  const { user } = useSessionContext();
  const [isLoading, setIsLoading] = useState(true);
  const [bodyweightLogs, setBodyweightLogs] = useState<Array<{ date: string; weight: number }>>([]);
  const [nutritionLogs, setNutritionLogs] = useState<Array<{ date: string; totalProteinGrams: number; totalCalories: number | null }>>([]);
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
  const [selectedDate, setSelectedDate] = useState(getTodayDate);
  const [weightInput, setWeightInput] = useState('');
  const [isSavingWeight, setIsSavingWeight] = useState(false);
  const [bodyweightError, setBodyweightError] = useState('');
  const [bodyweightMessage, setBodyweightMessage] = useState('');
  const [loadError, setLoadError] = useState('');
  const [userProfile, setUserProfile] = useState<{ age: number; height: number; gender: string; goal: string } | null>(null);

  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      setIsLoading(true);
      setLoadError('');

      try {
        const [nextBodyweightLogs, nextNutritionLogs, nextWorkoutSessions, profile] = await Promise.all([
          fetchBodyweightLogs(),
          fetchNutritionLogs(),
          fetchSavedWorkoutSessions(),
          fetchCurrentProfile().catch(() => null),
        ]);

        if (!isMounted) {
          return;
        }

        setBodyweightLogs(nextBodyweightLogs);
        setNutritionLogs(nextNutritionLogs);
        setWorkoutSessions(nextWorkoutSessions);
        if (profile) {
          setUserProfile({
            age: profile.age,
            height: profile.height,
            gender: (profile as any).gender || '',
            goal: profile.goal,
          });
        }
      } catch (error) {
        if (isMounted) {
          setLoadError(error instanceof Error ? error.message : 'טעינת נתוני הבית נכשלה.');
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

  const todayEntry = useMemo(
    () => bodyweightLogs.find((entry) => entry.date === getTodayDate()) || null,
    [bodyweightLogs]
  );
  const selectedDateEntry = useMemo(
    () => bodyweightLogs.find((entry) => entry.date === selectedDate) || null,
    [bodyweightLogs, selectedDate]
  );
  const todayNutritionLog = useMemo(
    () => nutritionLogs.find((entry) => entry.date === getTodayDate()) || null,
    [nutritionLogs]
  );
  const todayWorkoutDone = useMemo(
    () => workoutSessions.some((session) => session.date === getTodayDate()),
    [workoutSessions]
  );

  const dailyCalorieTarget = useMemo(() => {
    if (!userProfile) return null;
    const { age, height, gender, goal } = userProfile;
    const latestWeight = bodyweightLogs.length ? bodyweightLogs[bodyweightLogs.length - 1].weight : 0;
    if (!latestWeight || !height || !age) return null;
    const base = 10 * latestWeight + 6.25 * height - 5 * age;
    const bmr = gender === 'female' ? base - 161 : base + 5;
    const tdee = bmr * 1.375;
    if (goal === 'cut') return Math.round(tdee - 400);
    if (goal === 'bulk') return Math.round(tdee + 300);
    return Math.round(tdee);
  }, [userProfile, bodyweightLogs]);

  const todayCaloriesEaten = useMemo(
    () => todayNutritionLog?.totalCalories ?? null,
    [todayNutritionLog]
  );

  const dailyProteinTarget = useMemo(() => {
    if (!userProfile) return null;
    const latestWeight = bodyweightLogs.length ? bodyweightLogs[bodyweightLogs.length - 1].weight : 0;
    if (!latestWeight) return null;
    const multiplier = userProfile.goal === 'cut' ? 2.0 : userProfile.goal === 'bulk' ? 1.8 : 1.6;
    return Math.round(latestWeight * multiplier);
  }, [userProfile, bodyweightLogs]);

  useEffect(() => {
    setWeightInput(selectedDateEntry ? String(selectedDateEntry.weight) : '');
    setBodyweightError('');
    setBodyweightMessage('');
  }, [selectedDateEntry]);

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

  const recommendation = useMemo<Recommendation | null>(() => {
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

  const handleSaveBodyweight = async () => {
    const numericWeight = Number(String(weightInput).replace(',', '.'));
    if (!numericWeight || Number.isNaN(numericWeight) || numericWeight <= 0) {
      setBodyweightError('יש להזין משקל גוף חיובי ותקין.');
      setBodyweightMessage('');
      return;
    }

    setIsSavingWeight(true);
    setBodyweightError('');
    setBodyweightMessage('');

    try {
      const savedEntry = await upsertBodyweightLog({
        date: selectedDate,
        weight: numericWeight,
      });

      setBodyweightLogs((current) =>
        [...current.filter((item) => item.date !== savedEntry.date), savedEntry].sort((left, right) =>
          left.date.localeCompare(right.date)
        )
      );
      setBodyweightMessage('משקל הגוף נשמר.');
    } catch (error) {
      setBodyweightError(error instanceof Error ? error.message : 'שמירת משקל הגוף נכשלה.');
    } finally {
      setIsSavingWeight(false);
    }
  };

  if (isLoading) {
    return (
      <ProtectedPage>
        <div style={{ color: 'var(--text-muted)' }}>טוען בית...</div>
      </ProtectedPage>
    );
  }

  return (
    <ProtectedPage>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {loadError ? <div style={{ color: 'var(--danger)' }}>{loadError}</div> : null}

        <div style={{ display: 'flex', gap: 8 }}>
          <StatusCard
            label="משקל נוכחי"
            value={bodyweightLogs.length ? `${bodyweightLogs[bodyweightLogs.length - 1].weight}` : '--'}
            valueColor="var(--accent)"
          />
          <CaloriesCard
            eaten={todayNutritionLog ? Math.round(todayNutritionLog.totalProteinGrams) : 0}
            target={dailyProteinTarget}
            label="חלבון היום"
          />
          <CaloriesCard eaten={todayCaloriesEaten ?? 0} target={dailyCalorieTarget} label="קלוריות היום" />
        </div>

        <div
          style={{
            background: 'var(--surface)',
            borderRadius: 20,
            padding: 20,
            display: 'grid',
            gap: 12,
          }}
        >
          <div style={{ fontSize: 20, fontWeight: 800 }}>רישום משקל</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type="number"
              inputMode="decimal"
              placeholder="80.5"
              value={weightInput}
              onChange={(e) => {
                setWeightInput(e.target.value);
                setBodyweightError('');
                setBodyweightMessage('');
              }}
              style={{ ...inputStyle, flex: '0 0 80px' }}
            />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              style={{ ...inputStyle, flex: 1 }}
            />
            <button
              type="button"
              onClick={handleSaveBodyweight}
              disabled={isSavingWeight}
              style={{
                border: 0,
                borderRadius: 14,
                background: 'var(--accent)',
                color: '#fff',
                padding: '12px 16px',
                fontWeight: 800,
                cursor: isSavingWeight ? 'default' : 'pointer',
                opacity: isSavingWeight ? 0.7 : 1,
                whiteSpace: 'nowrap',
              }}
            >
              {isSavingWeight ? '...' : 'שמור'}
            </button>
          </div>
          <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>
            {selectedDateEntry
              ? `משקל שמור ל-${formatDisplayDate(selectedDate)}: ${selectedDateEntry.weight}`
              : todayEntry
                ? `משקל שמור להיום: ${todayEntry.weight}`
                : 'עדיין לא נשמר משקל'}
          </div>
          {bodyweightError ? <div style={{ color: 'var(--danger)' }}>{bodyweightError}</div> : null}
          {bodyweightMessage ? <div style={{ color: 'var(--success)' }}>{bodyweightMessage}</div> : null}
        </div>

        <div
          style={{
            background: 'var(--surface)',
            borderRadius: 20,
            padding: 20,
            display: 'grid',
            gap: 12,
          }}
        >
          <div style={{ fontSize: 20, fontWeight: 800 }}>מעקב משקל</div>
          <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>תצוגת התקדמות לפי שקילות שנשמרו.</div>
          <BodyweightChart logs={bodyweightLogs} />
        </div>

 {recommendation ? (
  <div
    style={{
      background: 'var(--surface)',
      borderRadius: 20,
      padding: 20,
      display: 'grid',
      gap: 8,
    }}
  >
    <div style={{ color: 'var(--text-muted)', fontSize: 13, fontWeight: 700 }}>המלצה יומית</div>
    <div style={{ fontSize: 20, fontWeight: 800 }}>{recommendation.title}</div>
    <div style={{ color: 'var(--text-muted)' }}>{recommendation.action}</div>
    <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>{recommendation.explanation}</div>
    {recommendation.nutritionNote ? (
      <div style={{ color: 'var(--accent)', fontSize: 14, fontWeight: 700 }}>
        {recommendation.nutritionNote}
      </div>
    ) : null}
  </div>
) : null}

        <div style={{ textAlign: 'center', marginTop: 6 }}>
          <Link href="/home-v2" style={{ fontWeight: 700, color: 'var(--accent)' }}>
            Explore Home V2 → 
          </Link>
        </div>

      </div>
    </ProtectedPage>
  );
}

function CaloriesCard({ eaten, target, label }: { eaten: number; target: number | null; label: string }) {
  const pct = target ? Math.min(eaten / target, 1) : 0;
  const isOver = target !== null && eaten > target;
  const valueColor = target === null
    ? 'var(--text-muted)'
    : isOver
      ? 'var(--danger)'
      : 'var(--accent)';

  return (
    <div style={{ flex: 1, minWidth: 0, background: 'var(--surface)', borderRadius: 16, padding: '12px 10px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
      <div style={{ overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
        <span style={{ fontSize: 17, fontWeight: 800, color: valueColor }}>
          {target !== null ? eaten : '--'}
        </span>
        {target !== null && (
          <span style={{ fontSize: 17, fontWeight: 800, color: 'var(--text-muted)' }}>/{target}</span>
        )}
      </div>
      {target !== null && (
        <div style={{ marginTop: 5, height: 3, borderRadius: 999, background: 'var(--surface-2)', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${pct * 100}%`, borderRadius: 999, background: isOver ? 'var(--danger)' : 'var(--accent)' }} />
        </div>
      )}
      <div style={{ color: 'var(--text-muted)', fontSize: 11, fontWeight: 600, marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {label}
      </div>
    </div>
  );
}

function StatusCard({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <div style={{ flex: 1, minWidth: 0, background: 'var(--surface)', borderRadius: 16, padding: '12px 10px' }}>
      <div
        style={{
          fontSize: 20,
          fontWeight: 800,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          color: valueColor,
        }}
      >
        {value}
      </div>
      <div style={{ color: 'var(--text-muted)', fontSize: 11, fontWeight: 600, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {label}
      </div>
    </div>
  );
}

const inputStyle: CSSProperties = {
  width: '100%',
  borderRadius: 14,
  border: '1px solid var(--border)',
  background: 'var(--surface-2)',
  color: 'var(--text)',
  padding: 12,
};

const primaryButtonStyle = (disabled: boolean): CSSProperties => ({
  border: 0,
  borderRadius: 16,
  background: 'var(--accent)',
  color: '#fff',
  padding: '12px 16px',
  fontWeight: 800,
  cursor: disabled ? 'default' : 'pointer',
  opacity: disabled ? 0.7 : 1,
});
