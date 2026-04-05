'use client';

import type { CSSProperties } from 'react';
import Link from 'next/link';
import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { ProtectedPage } from '@/components/ProtectedPage';
import { PageSpinner } from '@/components/PageSpinner';
import { BodyweightChart } from '@/components/BodyweightChart';
import { fetchBodyweightLogs, upsertBodyweightLog } from '@/lib/repositories/bodyweightRepository';
import { fetchCurrentProfile } from '@/lib/repositories/profileRepository';
import { fetchNutritionLogs, type SavedNutritionLog } from '@/lib/repositories/nutritionLogRepository';
import { fetchSavedWorkoutSessions, type SavedWorkoutSession } from '@/lib/repositories/workoutSessionRepository';
import { fetchActiveWorkoutProgram, type WorkoutProgram } from '@/lib/repositories/programRepository';
import { useSessionContext } from '@/lib/session';
import {
  getDailyCalorieTarget,
  getDailyProteinTarget,
  buildProgressStatus,
  type ProgressStatusResult,
} from '@/lib/progressStatus';
import { calculateWorkoutConsistency, type WorkoutConsistencyResult } from '@/lib/workoutConsistency';
import { calculateNutritionAdherence, type NutritionAdherenceResult } from '@/lib/nutritionAdherence';
import { calculateTrainingLoad, type TrainingLoadResult } from '@/lib/trainingLoad';
import { getGoalKPIStatus, type GoalKPIStatusResult } from '@/lib/goalKpiStatus';
import { normalizeGoalType, type GoalType } from '@/lib/goalDefinitions';
import { calculateDataCompleteness, type DataCompletenessResult } from '@/lib/dataCompleteness';
import { buildRecommendationContext } from '@/lib/recommendationContext';
import {
  selectDailyRecommendation,
  selectRecoveryRecommendation,
} from '@/lib/recommendationSelector';
import type { RenderedRecommendation } from '@/lib/recommendationRenderer';
import { parseRecoveryParam } from '@/lib/recoveryContext';
import { RecoveryBanner } from '@/components/RecoveryBanner';
import { selectStableWeeklyRecommendation } from '@/lib/weeklyRecommendationEngine';
import type { WeeklyGoalSnapshot } from '@/lib/weeklyGoalSnapshots';
import { syncCurrentWeeklyGoalSnapshot } from '@/lib/weeklyGoalSnapshotService';

const getTodayDate = () => new Date().toISOString().slice(0, 10);
const formatDisplayDate = (value: string) => {
  const [year, month, day] = value.split('-');
  return year && month && day ? `${day}.${month}.${year}` : value;
};

function HomePageContent() {
  const { user } = useSessionContext();
  const searchParams = useSearchParams();
  const recoveryType = parseRecoveryParam(searchParams.get('recovery'));
  const [recoveryDismissed, setRecoveryDismissed] = useState(false);
  const weightInputRef = useRef<HTMLInputElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [bodyweightLogs, setBodyweightLogs] = useState<Array<{ date: string; weight: number }>>([]);
  const [nutritionLogs, setNutritionLogs] = useState<Array<{ date: string; totalProteinGrams: number; totalCalories: number | null }>>([]);
  const [fullNutritionLogs, setFullNutritionLogs] = useState<SavedNutritionLog[]>([]);
  const [workoutSessions, setWorkoutSessions] = useState<SavedWorkoutSession[]>([]);
  const [workoutProgram, setWorkoutProgram] = useState<WorkoutProgram>({ id: '', days: [] });
  const [selectedDate, setSelectedDate] = useState(getTodayDate);
  const [weightInput, setWeightInput] = useState('');
  const [isSavingWeight, setIsSavingWeight] = useState(false);
  const [bodyweightError, setBodyweightError] = useState('');
  const [bodyweightMessage, setBodyweightMessage] = useState('');
  const [loadError, setLoadError] = useState('');
  const [userProfile, setUserProfile] = useState<{ age: number; height: number; gender: string; goal: string } | null>(null);
  const [weeklySnapshot, setWeeklySnapshot] = useState<WeeklyGoalSnapshot | null>(null);

  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      setIsLoading(true);
      setLoadError('');

      try {
        const [nextBodyweightLogs, nextNutritionLogs, nextWorkoutSessions, profile, activeProgram] = await Promise.all([
          fetchBodyweightLogs(),
          fetchNutritionLogs(),
          fetchSavedWorkoutSessions(),
          fetchCurrentProfile().catch(() => null),
          fetchActiveWorkoutProgram().catch(() => ({ id: '', days: [] })),
        ]);

        if (!isMounted) {
          return;
        }

        setBodyweightLogs(nextBodyweightLogs);
        setFullNutritionLogs(nextNutritionLogs);
        setNutritionLogs(
          nextNutritionLogs.map((entry) => ({
            date: entry.date,
            totalProteinGrams: entry.totalProteinGrams,
            totalCalories: entry.totalCalories,
          }))
        );
        setWorkoutSessions(nextWorkoutSessions);
        setWorkoutProgram(activeProgram);
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
  const normalizedGoal = useMemo<GoalType>(() => normalizeGoalType(userProfile?.goal), [userProfile]);

  const dailyCalorieTarget = useMemo(() => {
    return getDailyCalorieTarget(userProfile, bodyweightLogs);
  }, [userProfile, bodyweightLogs]);

  const todayCaloriesEaten = useMemo(
    () => todayNutritionLog?.totalCalories ?? null,
    [todayNutritionLog]
  );

  const dailyProteinTarget = useMemo(() => {
    return getDailyProteinTarget(userProfile, bodyweightLogs);
  }, [userProfile, bodyweightLogs]);

  useEffect(() => {
    setWeightInput(selectedDateEntry ? String(selectedDateEntry.weight) : '');
    setBodyweightError('');
    setBodyweightMessage('');
  }, [selectedDateEntry]);

  useEffect(() => {
    if (recoveryType === 'weight' && !recoveryDismissed && !isLoading) {
      weightInputRef.current?.focus();
    }
  }, [recoveryType, recoveryDismissed, isLoading]);

  const exerciseNames = useMemo(() => {
    const fromProgram = Array.from(
      new Set(
        (workoutProgram.days || [])
          .flatMap((day) => day.rows || [])
          .map((row) => String(row.exercise || '').trim())
          .filter(Boolean)
      )
    );

    if (fromProgram.length > 0) {
      return fromProgram;
    }

    return Array.from(
      new Set(
        workoutSessions.flatMap((session) =>
          (session.exercises || []).map((exercise) => String(exercise.exerciseName || '').trim()).filter(Boolean)
        )
      )
    );
  }, [workoutProgram, workoutSessions]);

  const workoutConsistency = useMemo<WorkoutConsistencyResult>(() => {
    return calculateWorkoutConsistency(workoutProgram, workoutSessions);
  }, [workoutProgram, workoutSessions]);

  const nutritionAdherence = useMemo<NutritionAdherenceResult>(() => {
    return calculateNutritionAdherence({
      goal: normalizedGoal,
      nutritionLogs: fullNutritionLogs,
      profile: userProfile,
      bodyweightLogs,
    });
  }, [normalizedGoal, userProfile, fullNutritionLogs, bodyweightLogs]);

  const trainingLoad = useMemo<TrainingLoadResult>(() => {
    return calculateTrainingLoad(workoutSessions);
  }, [workoutSessions]);

  const goalKpiStatus = useMemo<GoalKPIStatusResult>(() => {
    return getGoalKPIStatus({
      goal: normalizedGoal,
      bodyweightLogs,
      workoutHistory: workoutSessions,
    });
  }, [normalizedGoal, bodyweightLogs, workoutSessions]);

  const progressStatus = useMemo<ProgressStatusResult>(() => {
    return buildProgressStatus({
      goal: normalizedGoal,
      exerciseNames,
      workoutHistory: workoutSessions,
      bodyweightLogs,
      nutritionLogs: fullNutritionLogs,
      profile: userProfile,
      workoutConsistency,
    });
  }, [normalizedGoal, userProfile, exerciseNames, workoutSessions, bodyweightLogs, fullNutritionLogs, workoutConsistency]);

  const dataCompleteness = useMemo<DataCompletenessResult>(() => {
    return calculateDataCompleteness({
      bodyweightLogs,
      nutritionLogs: fullNutritionLogs,
      workoutSessions,
      workoutProgram,
    });
  }, [bodyweightLogs, fullNutritionLogs, workoutSessions, workoutProgram]);

  const recommendationCtx = useMemo(
    () =>
      buildRecommendationContext({
        goal: normalizedGoal,
        progressStatus,
        nutritionAdherence,
        trainingLoad,
        goalKpiStatus,
        workoutConsistency,
        dataCompleteness,
        workoutSessions,
        workoutProgram,
        hasTodayNutritionLog: Boolean(todayNutritionLog),
        hasTodayWeight: Boolean(todayEntry),
        todayWorkoutDone,
      }),
    [
      normalizedGoal, progressStatus, nutritionAdherence, trainingLoad,
      goalKpiStatus, workoutConsistency, dataCompleteness,
      workoutSessions, workoutProgram, todayNutritionLog, todayEntry, todayWorkoutDone,
    ]
  );

  const dailyRec = useMemo<RenderedRecommendation>(
    () => selectDailyRecommendation(recommendationCtx),
    [recommendationCtx]
  );

  const weeklyRec = useMemo<RenderedRecommendation>(
    () =>
      selectStableWeeklyRecommendation({
        goal: normalizedGoal,
        recommendationContext: recommendationCtx,
        progressStatus,
        nutritionAdherence,
        goalKpiStatus,
        workoutConsistency,
        bodyweightLogs,
        nutritionLogs: fullNutritionLogs,
        workoutSessions,
      }),
    [
      normalizedGoal,
      recommendationCtx,
      progressStatus,
      nutritionAdherence,
      goalKpiStatus,
      workoutConsistency,
      bodyweightLogs,
      fullNutritionLogs,
      workoutSessions,
    ]
  );

  useEffect(() => {
    if (isLoading || !user?.id) {
      return;
    }

    let isMounted = true;

    syncCurrentWeeklyGoalSnapshot({
      userId: user.id,
      goal: normalizedGoal,
      recommendation: weeklyRec,
      recommendationContext: recommendationCtx,
      progressStatus,
      nutritionAdherence,
      goalKpiStatus,
      workoutConsistency,
      bodyweightLogs,
      nutritionLogs: fullNutritionLogs,
      workoutSessions,
      profile: userProfile,
    })
      .then((snapshot) => {
        if (isMounted) {
          setWeeklySnapshot(snapshot);
        }
      })
      .catch((error) => {
        if (process.env.NODE_ENV === 'development') {
          console.error('[WeeklyGoalSnapshot]', error);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [
    isLoading,
    user,
    normalizedGoal,
    weeklyRec,
    recommendationCtx,
    progressStatus,
    nutritionAdherence,
    goalKpiStatus,
    workoutConsistency,
    bodyweightLogs,
    fullNutritionLogs,
    workoutSessions,
    userProfile,
  ]);

  const displayedWeeklyRec = useMemo<RenderedRecommendation>(
    () =>
      weeklySnapshot
        ? {
            id: weeklySnapshot.templateId || weeklySnapshot.id,
            type: 'weekly',
            title: weeklySnapshot.title,
            body: weeklySnapshot.body,
            cta: weeklyRec.cta,
          }
        : weeklyRec,
    [weeklySnapshot, weeklyRec]
  );

  const recoveryRec = useMemo<RenderedRecommendation | null>(
    () => selectRecoveryRecommendation(recommendationCtx, dataCompleteness.overallStatus),
    [recommendationCtx, dataCompleteness]
  );

  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.log('[RecommendationEngine]', {
        daily: dailyRec.id,
        weekly: weeklyRec.id,
        recovery: recoveryRec?.id ?? null,
        todayIsWorkoutDay: recommendationCtx.todayIsWorkoutDay,
        progressStatus: recommendationCtx.progressStatusLevel,
      });
    }
  }, [dailyRec, weeklyRec, recoveryRec, recommendationCtx]);

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
      setRecoveryDismissed(true);
    } catch (error) {
      setBodyweightError(error instanceof Error ? error.message : 'שמירת משקל הגוף נכשלה.');
    } finally {
      setIsSavingWeight(false);
    }
  };

  if (isLoading) {
    return <ProtectedPage><PageSpinner /></ProtectedPage>;
  }

  return (
    <ProtectedPage>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
          paddingTop: 'calc(16px + var(--safe-area-top))',
        }}
      >
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
            ...(recoveryType === 'weight' && !recoveryDismissed
              ? { outline: '2px solid var(--accent)', outlineOffset: 2 }
              : {}),
          }}
        >
          {recoveryType === 'weight' && !recoveryDismissed ? (
            <RecoveryBanner message="כדאי לעדכן משקל כדי לשפר את דיוק התובנות וההמלצות." />
          ) : null}
          <div style={{ fontSize: 20, fontWeight: 800 }}>רישום משקל</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              ref={weightInputRef}
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

        {/* ── Box 1: המלצה יומית ראשית ─────────────────────────────────── */}
        <div
          style={{
            background: 'var(--surface)',
            borderRadius: 20,
            padding: 20,
            display: 'grid',
            gap: 12,
          }}
        >
          <div style={{ color: 'var(--text-muted)', fontSize: 13, fontWeight: 700 }}>המלצה יומית</div>
          <div style={{ fontSize: 22, fontWeight: 800 }}>{dailyRec.title}</div>
          <div style={{ color: 'var(--text)', fontSize: 14, lineHeight: 1.6 }}>{dailyRec.body}</div>
          {dailyRec.cta ? (
            <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
              <Link
                href={dailyRec.cta.href as Parameters<typeof Link>[0]['href']}
                style={{ ...primaryButtonStyle(false), textDecoration: 'none' }}
              >
                {dailyRec.cta.label}
              </Link>
            </div>
          ) : null}
        </div>

        {/* ── Box 2: מטרת השבוע ─────────────────────────────────────────── */}
        <div
          style={{
            background: 'var(--surface)',
            borderRadius: 20,
            padding: 20,
            display: 'grid',
            gap: 10,
          }}
        >
          <div style={{ color: 'var(--text-muted)', fontSize: 13, fontWeight: 700 }}>מטרת השבוע</div>
          <div style={{ fontSize: 18, fontWeight: 800 }}>{displayedWeeklyRec.title}</div>
          <div style={{ color: 'var(--text)', fontSize: 14, lineHeight: 1.6 }}>{displayedWeeklyRec.body}</div>
          {displayedWeeklyRec.cta && weeklyRec.cta ? (
            <Link
              href={displayedWeeklyRec.cta.href as Parameters<typeof Link>[0]['href']}
              style={{
                fontSize: 13,
                fontWeight: 700,
                color: 'var(--accent)',
                textDecoration: 'none',
                alignSelf: 'flex-start',
              }}
            >
              {weeklyRec.cta.label} ←
            </Link>
          ) : null}
        </div>

        {/* ── Box 3: השלמת נתונים — מוצג רק אם יש gap ──────────────────── */}
        {recoveryRec ? (
          <div
            style={{
              background: 'var(--surface-2)',
              borderRadius: 20,
              padding: 16,
              display: 'grid',
              gap: 8,
              border: '1px solid var(--border)',
            }}
          >
            <div style={{ color: 'var(--text-muted)', fontSize: 12, fontWeight: 700 }}>השלמת נתונים</div>
            <div style={{ fontSize: 15, fontWeight: 700 }}>{recoveryRec.title}</div>
            <div style={{ color: 'var(--text-muted)', fontSize: 13, lineHeight: 1.5 }}>{recoveryRec.body}</div>
            {recoveryRec.cta ? (
              <Link
                href={recoveryRec.cta.href as Parameters<typeof Link>[0]['href']}
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: 'var(--accent)',
                  textDecoration: 'none',
                  alignSelf: 'flex-start',
                }}
              >
                {recoveryRec.cta.label} ←
              </Link>
            ) : null}
          </div>
        ) : null}

        <DataCompletenessCard completeness={dataCompleteness} />

      </div>
    </ProtectedPage>
  );
}

const STATUS_LABEL: Record<string, string> = {
  complete: 'מלא',
  partial:  'חלקי',
  poor:     'חסר',
};

const STATUS_COLOR: Record<string, string> = {
  complete: 'var(--success)',
  partial:  'var(--accent)',
  poor:     'var(--danger)',
};

function DataCompletenessCard({ completeness }: { completeness: DataCompletenessResult }) {
  const topGaps = completeness.gaps.slice(0, 2);
  return (
    <div
      style={{
        background: 'var(--surface)',
        borderRadius: 20,
        padding: 20,
        display: 'grid',
        gap: 12,
      }}
    >
      <div style={{ color: 'var(--text-muted)', fontSize: 13, fontWeight: 700 }}>מצב נתונים</div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span
          style={{
            fontSize: 15,
            fontWeight: 800,
            color: STATUS_COLOR[completeness.overallStatus],
          }}
        >
          {STATUS_LABEL[completeness.overallStatus]}
        </span>
        <span style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 700 }}>
          {completeness.score}%
        </span>
      </div>

      {/* score bar */}
      <div style={{ height: 4, borderRadius: 999, background: 'var(--surface-2)', overflow: 'hidden' }}>
        <div
          style={{
            height: '100%',
            width: `${completeness.score}%`,
            borderRadius: 999,
            background: STATUS_COLOR[completeness.overallStatus],
            transition: 'width 0.3s',
          }}
        />
      </div>

      {topGaps.length === 0 ? (
        <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>
          כל הנתונים עדכניים. המערכת יכולה לתת לך תובנות מדויקות.
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 8 }}>
          {topGaps.map((gap) => (
            <div
              key={gap.type}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 8,
              }}
            >
              <span style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.4, flex: 1 }}>
                {gap.message}
              </span>
              <Link
                href={gap.cta.href as Parameters<typeof Link>[0]['href']}
                style={{
                  border: 0,
                  borderRadius: 10,
                  background: 'var(--surface-2)',
                  color: 'var(--text)',
                  padding: '6px 12px',
                  fontWeight: 700,
                  fontSize: 12,
                  whiteSpace: 'nowrap',
                  textDecoration: 'none',
                  flexShrink: 0,
                }}
              >
                {gap.cta.label}
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
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

export default function HomePage() {
  return (
    <Suspense fallback={<PageSpinner />}>
      <HomePageContent />
    </Suspense>
  );
}
