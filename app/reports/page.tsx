'use client';

import { useEffect, useMemo, useState } from 'react';
import { ProtectedPage } from '@/components/ProtectedPage';
import { ExerciseProgressChart } from '@/components/ExerciseProgressChart';
import { PageSpinner } from '@/components/PageSpinner';
import { fetchBodyweightLogs, fetchLatestBodyweight } from '@/lib/repositories/bodyweightRepository';
import {
  calculateExerciseProgress,
  getExerciseOccurrencesFromWorkoutHistory,
  type ExerciseExerciseOccurrence,
  type ExerciseProgressResult,
} from '@/lib/exerciseProgress';
import {
  buildProgressStatus,
  type ProgressStatusResult,
} from '@/lib/progressStatus';
import {
  calculateProgressRecommendation,
  type ProgressRecommendation,
} from '@/lib/progressRecommendation';
import { fetchCurrentProfile } from '@/lib/repositories/profileRepository';
import { fetchActiveWorkoutProgram, type WorkoutProgram } from '@/lib/repositories/programRepository';
import { fetchNutritionLogs, type SavedNutritionLog } from '@/lib/repositories/nutritionLogRepository';
import { fetchSavedWorkoutSessions, type SavedWorkoutSession } from '@/lib/repositories/workoutSessionRepository';
import {
  calculateWorkoutConsistency,
  type WorkoutConsistencyResult,
} from '@/lib/workoutConsistency';
import {
  calculateWorkoutPerformanceInsights,
  type WorkoutPerformanceInsightsResult,
} from '@/lib/workoutPerformanceInsights';
import {
  calculateNutritionAdherence,
  type NutritionAdherenceResult,
} from '@/lib/nutritionAdherence';
import {
  calculateTrainingLoad,
  type TrainingLoadResult,
} from '@/lib/trainingLoad';

type ProfileData = {
  age: number;
  height: number;
  gender: string;
  goal: string;
  weight: number;
};

const calculateBMR = ({ weight, height, age, gender }: ProfileData): number | null => {
  if (!weight || !height || !age) return null;
  const base = 10 * weight + 6.25 * height - 5 * age;
  return gender === 'female' ? base - 161 : base + 5;
};

const getMissingFields = ({ weight, height, age, gender }: ProfileData): string[] => {
  const missing = [];
  if (!weight) missing.push('משקל');
  if (!height) missing.push('גובה');
  if (!age) missing.push('גיל');
  if (!gender) missing.push('מגדר');
  return missing;
};

const exerciseTrendContent: Record<
  ExerciseProgressResult['trend'],
  { icon: string; accent: string }
> = {
  up: {
    icon: '↗',
    accent: 'var(--success)',
  },
  stable: {
    icon: '➖',
    accent: 'var(--text-muted)',
  },
  down: {
    icon: '↘',
    accent: 'var(--danger)',
  },
  insufficient_data: {
    icon: '•',
    accent: 'var(--text-muted)',
  },
};

const getExerciseProgressReason = (result: ExerciseProgressResult | null) => {
  if (!result) {
    return 'אין מספיק נתונים להשוואה';
  }

  if (result.trend === 'insufficient_data') {
    return 'צריך לפחות 2 אימונים של אותו תרגיל כדי לחשב מגמת התקדמות';
  }

  return result.reason;
};

const formatDeltaPercentage = (value: number | null) => {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return null;
  }

  return `${value > 0 ? '+' : ''}${value.toFixed(1)}%`;
};

const formatBestSetSummary = (set: ExerciseProgressResult['currentBestSet']) => {
  if (!set) {
    return null;
  }

  return `${set.weight}kg x ${set.reps}`;
};

export default function ReportsPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [workoutProgram, setWorkoutProgram] = useState<WorkoutProgram>({ id: '', days: [] });
  const [exerciseOptions, setExerciseOptions] = useState<string[]>([]);
  const [selectedExercise, setSelectedExercise] = useState('');
  const [bodyweightLogs, setBodyweightLogs] = useState<Array<{ date: string; weight: number }>>([]);
  const [nutritionLogs, setNutritionLogs] = useState<SavedNutritionLog[]>([]);
  const [workoutHistory, setWorkoutHistory] = useState<SavedWorkoutSession[]>([]);
  const [isWorkoutHistoryLoading, setIsWorkoutHistoryLoading] = useState(true);
  const [workoutHistoryError, setWorkoutHistoryError] = useState('');

  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      setIsLoading(true);
      setIsWorkoutHistoryLoading(true);
      setError('');
      setWorkoutHistoryError('');

      try {
        const [profileData, latestBodyweight, activeProgram, nextBodyweightLogs, nextNutritionLogs] = await Promise.all([
          fetchCurrentProfile(),
          fetchLatestBodyweight().catch(() => null),
          fetchActiveWorkoutProgram().catch(() => ({ id: '', days: [] })),
          fetchBodyweightLogs().catch(() => []),
          fetchNutritionLogs().catch(() => []),
        ]);

        if (!isMounted) return;

        const nextExerciseOptions = Array.from(
          new Set(
            (activeProgram.days || [])
              .flatMap((day) => day.rows || [])
              .map((row) => row.exercise.trim())
              .filter(Boolean)
          )
        );

        setProfile({
          age: profileData?.age || 0,
          height: profileData?.height || 0,
          gender: (profileData as any)?.gender || '',
          goal: profileData?.goal || '',
          weight: latestBodyweight?.weight || 0,
        });
        setWorkoutProgram(activeProgram);
        setBodyweightLogs(nextBodyweightLogs);
        setNutritionLogs(nextNutritionLogs);
        setExerciseOptions(nextExerciseOptions);
        setSelectedExercise((current) =>
          current && nextExerciseOptions.includes(current) ? current : nextExerciseOptions[0] || ''
        );
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'טעינת הנתונים נכשלה.');
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }

      try {
        const savedWorkoutSessions = await fetchSavedWorkoutSessions();

        if (!isMounted) return;

        setWorkoutHistory(savedWorkoutSessions);
      } catch (historyError) {
        if (isMounted) {
          setWorkoutHistoryError(
            historyError instanceof Error ? historyError.message : 'טעינת היסטוריית האימונים נכשלה.'
          );
        }
      } finally {
        if (isMounted) setIsWorkoutHistoryLoading(false);
      }
    };

    load();
    return () => {
      isMounted = false;
    };
  }, []);

  const bmr = profile ? calculateBMR(profile) : null;
  const missingFields = profile ? getMissingFields(profile) : [];

  const exerciseProgress = useMemo(() => {
    if (!selectedExercise.trim()) {
      return null;
    }

    return calculateExerciseProgress(selectedExercise, workoutHistory);
  }, [selectedExercise, workoutHistory]);

  const exerciseOccurrences = useMemo<ExerciseExerciseOccurrence[]>(() => {
    if (!selectedExercise.trim()) {
      return [];
    }

    return getExerciseOccurrencesFromWorkoutHistory(selectedExercise, workoutHistory);
  }, [selectedExercise, workoutHistory]);

  const workoutConsistency = useMemo<WorkoutConsistencyResult>(() => {
    return calculateWorkoutConsistency(workoutProgram, workoutHistory);
  }, [workoutProgram, workoutHistory]);

  const workoutPerformanceInsights = useMemo<WorkoutPerformanceInsightsResult>(() => {
    return calculateWorkoutPerformanceInsights(workoutHistory);
  }, [workoutHistory]);

  const nutritionAdherence = useMemo<NutritionAdherenceResult>(() => {
    return calculateNutritionAdherence({
      goal: (profile?.goal || '') as 'bulk' | 'cut' | 'maintain' | '',
      nutritionLogs,
      profile,
      bodyweightLogs,
    });
  }, [profile, nutritionLogs, bodyweightLogs]);

  const trainingLoad = useMemo<TrainingLoadResult>(() => {
    return calculateTrainingLoad(workoutHistory);
  }, [workoutHistory]);

  const progressStatus = useMemo<ProgressStatusResult>(() => {
    return buildProgressStatus({
      goal: (profile?.goal || '') as 'bulk' | 'cut' | 'maintain' | '',
      exerciseNames: exerciseOptions,
      workoutHistory,
      bodyweightLogs,
      nutritionLogs,
      profile,
      workoutConsistency,
    });
  }, [profile, exerciseOptions, workoutHistory, bodyweightLogs, nutritionLogs, workoutConsistency]);

  const progressRecommendation = useMemo<ProgressRecommendation>(() => {
    return calculateProgressRecommendation({
      goal: (profile?.goal || '') as 'bulk' | 'cut' | 'maintain' | '',
      progressStatus,
    });
  }, [profile, progressStatus]);

  if (isLoading) {
    return (
      <ProtectedPage>
        <PageSpinner />
      </ProtectedPage>
    );
  }

  return (
    <ProtectedPage>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ background: 'var(--surface)', borderRadius: 20, padding: 20 }}>
          <div style={{ color: 'var(--text-muted)', fontSize: 13, fontWeight: 700, marginBottom: 4 }}>דוחות</div>
          <div style={{ fontSize: 24, fontWeight: 800 }}>נתונים אישיים וניתוח התקדמות</div>
        </div>

        {error ? (
          <div style={{ color: 'var(--danger)', fontSize: 14, padding: '0 4px' }}>{error}</div>
        ) : null}

        <BmrAccordion bmr={bmr} profile={profile} missingFields={missingFields} />
        <ExerciseProgressAccordion
          exerciseOptions={exerciseOptions}
          selectedExercise={selectedExercise}
          onSelectExercise={setSelectedExercise}
          isLoading={isWorkoutHistoryLoading}
          error={workoutHistoryError}
          result={exerciseProgress}
          occurrences={exerciseOccurrences}
        />
        <WorkoutConsistencyAccordion
          isLoading={isWorkoutHistoryLoading}
          error={workoutHistoryError}
          result={workoutConsistency}
        />
        <WorkoutPerformanceInsightsAccordion
          isLoading={isWorkoutHistoryLoading}
          error={workoutHistoryError}
          result={workoutPerformanceInsights}
        />
        <NutritionAdherenceAccordion
          isLoading={isLoading}
          error={error}
          result={nutritionAdherence}
        />
        <TrainingLoadAccordion
          isLoading={isWorkoutHistoryLoading}
          error={workoutHistoryError}
          result={trainingLoad}
        />
        <ProgressStatusAccordion
          isLoading={isWorkoutHistoryLoading}
          error={workoutHistoryError}
          result={progressStatus}
          recommendation={progressRecommendation}
        />
      </div>
    </ProtectedPage>
  );
}

function WorkoutPerformanceInsightsAccordion({
  isLoading,
  error,
  result,
}: {
  isLoading: boolean;
  error: string;
  result: WorkoutPerformanceInsightsResult;
}) {
  const [open, setOpen] = useState(false);
  const overallConfidenceLabel =
    result.overallConfidence === 'high'
      ? 'גבוהה'
      : result.overallConfidence === 'medium'
        ? 'בינונית'
        : 'נמוכה';

  const rows = [
    {
      label: 'היום החזק ביותר',
      value: result.bestWeekday.bestWeekday || 'אין מספיק נתונים',
      reason: result.bestWeekday.reason,
    },
    {
      label: 'חלון הזמן החזק ביותר',
      value: result.bestStartTime.bestStartTimeBucket || 'אין מספיק נתונים',
      reason: result.bestStartTime.reason,
    },
    {
      label: 'משך אימון מיטבי',
      value: result.bestDuration.bestDurationBucket || 'אין מספיק נתונים',
      reason: result.bestDuration.reason,
    },
    {
      label: 'רמת אנרגיה מיטבית',
      value: result.bestEnergy.bestEnergyLevel || 'אין מספיק נתונים',
      reason: result.bestEnergy.reason,
    },
    {
      label: 'הביצועים הטובים ביותר מגיעים אחרי',
      value: result.bestRest.bestRestBucket ? `${result.bestRest.bestRestBucket} ימי מנוחה` : 'אין מספיק נתונים',
      reason: result.bestRest.reason,
    },
    {
      label: 'עקביות זמני אימון',
      value: result.timeConsistency.consistencyLevel || 'אין מספיק נתונים',
      reason: result.timeConsistency.reason,
    },
  ];

  return (
    <div style={{ background: 'var(--surface)', borderRadius: 20, overflow: 'hidden' }}>
      <button
        type='button'
        onClick={() => setOpen((prev) => !prev)}
        style={{
          width: '100%',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: 20,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          color: 'var(--text)',
        }}
      >
        <div style={{ textAlign: 'right', flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 18, fontWeight: 800 }}>תובנות ביצועים</div>
          <div style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 2 }}>
            {result.dataStatus === 'missing' ? 'אין מספיק נתונים' : `${result.validWorkoutsCount} אימונים תקפים נותחו`}
          </div>
        </div>
        <span
          style={{
            fontSize: 18,
            color: 'var(--text-muted)',
            transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.2s',
            flexShrink: 0,
          }}
        >
          ג–¼
        </span>
      </button>

      {open ? (
        <div style={{ padding: '0 20px 20px' }}>
          <div style={{ display: 'grid', gap: 16 }}>
            <div>
              <div style={{ fontSize: 20, fontWeight: 800 }}>תובנות ביצועים</div>
              <div style={{ color: 'var(--text-muted)', fontSize: 14, lineHeight: 1.6, marginTop: 6 }}>
                הדוח מזהה באילו תנאים אתה משיג את הביצועים הכי טובים באימונים.
              </div>
            </div>

            {isLoading ? (
              <div style={{ background: 'var(--surface-2)', borderRadius: 16, padding: 18, display: 'grid', gap: 10 }}>
                <div style={{ fontSize: 20, fontWeight: 800 }}>תובנות ביצועים</div>
                <div style={{ color: 'var(--text-muted)', fontSize: 14, lineHeight: 1.6 }}>
                  טוען היסטוריית אימונים לניתוח ביצועים...
                </div>
              </div>
            ) : error ? (
              <div style={{ background: 'var(--surface-2)', borderRadius: 16, padding: 18, display: 'grid', gap: 10 }}>
                <div style={{ fontSize: 20, fontWeight: 800 }}>תובנות ביצועים</div>
                <div style={{ color: 'var(--danger)', fontSize: 14, lineHeight: 1.6 }}>{error}</div>
              </div>
            ) : (
              <>
                <div
                  style={{
                    background: 'var(--surface-2)',
                    borderRadius: 16,
                    padding: 18,
                    display: 'grid',
                    gap: 8,
                  }}
                >
                  <div style={{ color: 'var(--text-muted)', fontSize: 13, fontWeight: 700 }}>רמת אמינות</div>
                  <div style={{ fontSize: 18, fontWeight: 800 }}>
                    {result.dataStatus === 'complete' ? 'מלאה' : result.dataStatus === 'partial' ? 'חלקית' : 'חסרה'}
                  </div>
                  <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>רמת ביטחון: {overallConfidenceLabel}</div>
                </div>

                <div
                  style={{
                    background: 'var(--surface-2)',
                    borderRadius: 16,
                    padding: 18,
                    display: 'grid',
                    gap: 12,
                  }}
                >
                  <div style={{ color: 'var(--text-muted)', fontSize: 13, fontWeight: 700 }}>תובנות</div>
                  {rows.map((row) => (
                    <div key={row.label} style={{ display: 'grid', gap: 4 }}>
                      <div style={{ fontSize: 15, fontWeight: 700 }}>{row.label}: {row.value}</div>
                      <div style={{ color: 'var(--text-muted)', fontSize: 13, lineHeight: 1.5 }}>{row.reason}</div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function NutritionAdherenceAccordion({
  isLoading,
  error,
  result,
}: {
  isLoading: boolean;
  error: string;
  result: NutritionAdherenceResult;
}) {
  const [open, setOpen] = useState(false);
  const statusAccent =
    result.status === 'good'
      ? 'var(--success)'
      : result.status === 'partial'
        ? 'var(--accent)'
        : result.status === 'poor'
          ? 'var(--danger)'
          : 'var(--text-muted)';
  const confidenceLabel =
    result.confidence === 'high' ? 'גבוהה' : result.confidence === 'medium' ? 'בינונית' : 'נמוכה';

  return (
    <div style={{ background: 'var(--surface)', borderRadius: 20, overflow: 'hidden' }}>
      <button
        type='button'
        onClick={() => setOpen((prev) => !prev)}
        style={{
          width: '100%',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: 20,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          color: 'var(--text)',
        }}
      >
        <div style={{ textAlign: 'right', flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 18, fontWeight: 800 }}>עמידה בתזונה</div>
          <div style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 2 }}>{result.label}</div>
        </div>
        <span
          style={{
            fontSize: 18,
            color: 'var(--text-muted)',
            transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.2s',
            flexShrink: 0,
          }}
        >
          ג–¼
        </span>
      </button>

      {open ? (
        <div style={{ padding: '0 20px 20px' }}>
          <div style={{ display: 'grid', gap: 16 }}>
            <div>
              <div style={{ fontSize: 20, fontWeight: 800 }}>עמידה בתזונה</div>
              <div style={{ color: 'var(--text-muted)', fontSize: 14, lineHeight: 1.6, marginTop: 6 }}>
                הדוח בודק האם עמדת ביעדי התזונה שלך ב-7 הימים האחרונים, לפי קלוריות, חלבון, פחמימות ושומן.
              </div>
            </div>

            {isLoading ? (
              <div style={{ background: 'var(--surface-2)', borderRadius: 16, padding: 18, display: 'grid', gap: 10 }}>
                <div style={{ fontSize: 20, fontWeight: 800 }}>עמידה בתזונה</div>
                <div style={{ color: 'var(--text-muted)', fontSize: 14, lineHeight: 1.6 }}>
                  טוען נתוני תזונה...
                </div>
              </div>
            ) : error ? (
              <div style={{ background: 'var(--surface-2)', borderRadius: 16, padding: 18, display: 'grid', gap: 10 }}>
                <div style={{ fontSize: 20, fontWeight: 800 }}>עמידה בתזונה</div>
                <div style={{ color: 'var(--danger)', fontSize: 14, lineHeight: 1.6 }}>{error}</div>
              </div>
            ) : (
              <>
                <div
                  style={{
                    background: 'var(--surface-2)',
                    borderRadius: 16,
                    padding: 18,
                    display: 'grid',
                    gap: 10,
                  }}
                >
                  <div style={{ color: 'var(--text-muted)', fontSize: 13, fontWeight: 700 }}>תוצאה מסכמת</div>
                  <div style={{ fontSize: 26, fontWeight: 800, color: statusAccent }}>{result.label}</div>
                  <div style={{ color: 'var(--text-muted)', fontSize: 14, lineHeight: 1.6 }}>{result.reason}</div>
                  <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>רמת ביטחון: {confidenceLabel}</div>
                </div>

                <div
                  style={{
                    background: 'var(--surface-2)',
                    borderRadius: 16,
                    padding: 18,
                    display: 'grid',
                    gap: 8,
                  }}
                >
                  <div style={{ color: 'var(--text-muted)', fontSize: 13, fontWeight: 700 }}>סיכום שבועי</div>
                  <div style={{ color: 'var(--text)', fontSize: 15 }}>חלבון: {result.proteinDaysMet}/7 ימים</div>
                  <div style={{ color: 'var(--text)', fontSize: 15 }}>קלוריות: {result.calorieDaysInRange}/7 ימים</div>
                  <div style={{ color: 'var(--text)', fontSize: 15 }}>ימים מתועדים: {result.totalTrackedDays}/7</div>
                </div>

                <div
                  style={{
                    background: 'var(--surface-2)',
                    borderRadius: 16,
                    padding: 18,
                    display: 'grid',
                    gap: 8,
                  }}
                >
                  <div style={{ color: 'var(--text-muted)', fontSize: 13, fontWeight: 700 }}>ממוצעים</div>
                  <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>ממוצע קלוריות: {result.averages.calories}</div>
                  <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>ממוצע חלבון: {result.averages.protein} גרם</div>
                  <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>ממוצע פחמימות: {result.averages.carbs} גרם</div>
                  <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>ממוצע שומן: {result.averages.fat} גרם</div>
                </div>
              </>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function TrainingLoadAccordion({
  isLoading,
  error,
  result,
}: {
  isLoading: boolean;
  error: string;
  result: TrainingLoadResult;
}) {
  const [open, setOpen] = useState(false);
  const statusAccent =
    result.status === 'low_load'
      ? 'var(--success)'
      : result.status === 'medium_load'
        ? 'var(--accent)'
        : result.status === 'high_load'
          ? 'var(--danger)'
          : 'var(--text-muted)';
  const confidenceLabel =
    result.confidence === 'high' ? 'גבוהה' : result.confidence === 'medium' ? 'בינונית' : 'נמוכה';
  const flagLabels = {
    performance: result.flags.performanceFlag === 'on' ? 'פעיל' : result.flags.performanceFlag === 'off' ? 'תקין' : 'לא ידוע',
    effort:
      result.flags.effortFlag === 'strong'
        ? 'גבוה'
        : result.flags.effortFlag === 'moderate'
          ? 'בינוני'
          : result.flags.effortFlag === 'off'
            ? 'תקין'
            : 'לא ידוע',
    energy: result.flags.energyFlag === 'on' ? 'נמוכה' : result.flags.energyFlag === 'off' ? 'תקין' : 'לא ידוע',
    execution: result.flags.executionFlag === 'on' ? 'פעיל' : result.flags.executionFlag === 'off' ? 'תקין' : 'לא ידוע',
    duration: result.flags.durationFlag === 'on' ? 'ארוך מהרגיל' : result.flags.durationFlag === 'off' ? 'תקין' : 'לא ידוע',
  };

  return (
    <div style={{ background: 'var(--surface)', borderRadius: 20, overflow: 'hidden' }}>
      <button
        type='button'
        onClick={() => setOpen((prev) => !prev)}
        style={{
          width: '100%',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: 20,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          color: 'var(--text)',
        }}
      >
        <div style={{ textAlign: 'right', flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 18, fontWeight: 800 }}>עומס / עייפות</div>
          <div style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 2 }}>{result.label}</div>
        </div>
        <span
          style={{
            fontSize: 18,
            color: 'var(--text-muted)',
            transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.2s',
            flexShrink: 0,
          }}
        >
          ג–¼
        </span>
      </button>

      {open ? (
        <div style={{ padding: '0 20px 20px' }}>
          <div style={{ display: 'grid', gap: 16 }}>
            <div>
              <div style={{ fontSize: 20, fontWeight: 800 }}>עומס / עייפות</div>
              <div style={{ color: 'var(--text-muted)', fontSize: 14, lineHeight: 1.6, marginTop: 6 }}>
                הדוח מעריך האם יש סימנים לכך שהעומס מהאימונים האחרונים מתחיל לפגוע בהתאוששות ובביצועים.
              </div>
            </div>

            {isLoading ? (
              <div style={{ background: 'var(--surface-2)', borderRadius: 16, padding: 18, display: 'grid', gap: 10 }}>
                <div style={{ fontSize: 20, fontWeight: 800 }}>עומס / עייפות</div>
                <div style={{ color: 'var(--text-muted)', fontSize: 14, lineHeight: 1.6 }}>
                  טוען היסטוריית אימונים...
                </div>
              </div>
            ) : error ? (
              <div style={{ background: 'var(--surface-2)', borderRadius: 16, padding: 18, display: 'grid', gap: 10 }}>
                <div style={{ fontSize: 20, fontWeight: 800 }}>עומס / עייפות</div>
                <div style={{ color: 'var(--danger)', fontSize: 14, lineHeight: 1.6 }}>{error}</div>
              </div>
            ) : (
              <>
                <div
                  style={{
                    background: 'var(--surface-2)',
                    borderRadius: 16,
                    padding: 18,
                    display: 'grid',
                    gap: 10,
                  }}
                >
                  <div style={{ color: 'var(--text-muted)', fontSize: 13, fontWeight: 700 }}>תוצאה מסכמת</div>
                  <div style={{ fontSize: 26, fontWeight: 800, color: statusAccent }}>{result.label}</div>
                  <div style={{ color: 'var(--text-muted)', fontSize: 14, lineHeight: 1.6 }}>{result.reason}</div>
                  <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>רמת ביטחון: {confidenceLabel}</div>
                </div>

                <div
                  style={{
                    background: 'var(--surface-2)',
                    borderRadius: 16,
                    padding: 18,
                    display: 'grid',
                    gap: 8,
                  }}
                >
                  <div style={{ color: 'var(--text-muted)', fontSize: 13, fontWeight: 700 }}>פירוק דגלים</div>
                  <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>ביצועים: {flagLabels.performance}</div>
                  <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>מאמץ: {flagLabels.effort}</div>
                  <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>אנרגיה: {flagLabels.energy}</div>
                  <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>השלמת אימון: {flagLabels.execution}</div>
                  <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>משך אימון: {flagLabels.duration}</div>
                </div>
              </>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ProgressStatusAccordion({
  isLoading,
  error,
  result,
  recommendation,
}: {
  isLoading: boolean;
  error: string;
  result: ProgressStatusResult;
  recommendation: ProgressRecommendation;
}) {
  const [open, setOpen] = useState(false);
  const statusAccent =
    result.status === 'on_track'
      ? 'var(--success)'
      : result.status === 'partial'
        ? 'var(--accent)'
        : result.status === 'off_track'
          ? 'var(--danger)'
          : 'var(--text-muted)';

  const exerciseLabel =
    result.summaries.exerciseProgress.trend === 'up'
      ? 'בעלייה'
      : result.summaries.exerciseProgress.trend === 'stable'
        ? 'יציב'
        : result.summaries.exerciseProgress.trend === 'down'
          ? 'בירידה'
          : 'אין מספיק נתונים';
  const weightLabel =
    result.summaries.weightTrend.trend === 'up'
      ? 'בעלייה'
      : result.summaries.weightTrend.trend === 'stable'
        ? 'יציב'
        : result.summaries.weightTrend.trend === 'down'
          ? 'בירידה'
          : 'אין מספיק נתונים';
  const nutritionLabel =
    result.summaries.nutritionAdherence.result === 'good'
      ? 'טובה'
      : result.summaries.nutritionAdherence.result === 'partial'
        ? 'חלקית'
        : result.summaries.nutritionAdherence.result === 'poor'
          ? 'חלשה'
          : 'אין מספיק נתונים';
  const consistencyLabel =
    result.summaries.workoutConsistency === 'high'
      ? 'גבוהה'
      : result.summaries.workoutConsistency === 'medium'
        ? 'בינונית'
        : result.summaries.workoutConsistency === 'low'
          ? 'נמוכה'
          : 'אין מספיק נתונים';
  const confidenceLabel =
    result.confidence === 'high' ? 'גבוהה' : result.confidence === 'medium' ? 'בינונית' : 'נמוכה';
  const goalKpiLabel =
    result.summaries.goalKPIStatus.status === 'positive'
      ? 'חיובי'
      : result.summaries.goalKPIStatus.status === 'neutral'
        ? 'ניטרלי'
        : result.summaries.goalKPIStatus.status === 'negative'
          ? 'שלילי'
          : 'אין מספיק נתונים';
  const recommendationPriorityColor =
    recommendation.priority === 'high'
      ? 'var(--danger)'
      : recommendation.priority === 'medium'
        ? 'var(--accent)'
        : 'var(--text-muted)';

  return (
    <div style={{ background: 'var(--surface)', borderRadius: 20, overflow: 'hidden' }}>
      <button
        type='button'
        onClick={() => setOpen((prev) => !prev)}
        style={{
          width: '100%',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: 20,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          color: 'var(--text)',
        }}
      >
        <div style={{ textAlign: 'right', flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 18, fontWeight: 800 }}>סטטוס התקדמות</div>
          <div style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 2 }}>
            {result.label}
          </div>
        </div>
        <span
          style={{
            fontSize: 18,
            color: 'var(--text-muted)',
            transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.2s',
            flexShrink: 0,
          }}
        >
          ▼
        </span>
      </button>

      {open ? (
        <div style={{ padding: '0 20px 20px' }}>
          <div style={{ display: 'grid', gap: 16 }}>
            <div>
              <div style={{ fontSize: 20, fontWeight: 800 }}>סטטוס התקדמות</div>
              <div style={{ color: 'var(--text-muted)', fontSize: 14, lineHeight: 1.6, marginTop: 6 }}>
                הדוח מסכם האם אתה מתקדם לפי המטרה שלך, על בסיס ביצועים, משקל, תזונה ועקביות אימונים.
              </div>
            </div>

            {isLoading ? (
              <ConsistencyInfoCard tone='muted' text='טוען נתונים לחישוב סטטוס התקדמות...' />
            ) : error ? (
              <ConsistencyInfoCard tone='danger' text={error} />
            ) : (
              <>
                <div
                  style={{
                    background: 'var(--surface-2)',
                    borderRadius: 16,
                    padding: 18,
                    display: 'grid',
                    gap: 10,
                  }}
                >
                  <div style={{ color: 'var(--text-muted)', fontSize: 13, fontWeight: 700 }}>תוצאה מסכמת</div>
                  <div style={{ fontSize: 26, fontWeight: 800, color: statusAccent }}>{result.label}</div>
                  <div style={{ color: 'var(--text-muted)', fontSize: 14, lineHeight: 1.6 }}>{result.reason}</div>
                  <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>
                    KPI ראשי: {goalKpiLabel}
                  </div>
                  <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>רמת ביטחון: {confidenceLabel}</div>
                </div>

                <div
                  style={{
                    background: 'var(--surface-2)',
                    borderRadius: 16,
                    padding: 18,
                    display: 'grid',
                    gap: 8,
                  }}
                >
                  <div style={{ color: 'var(--text-muted)', fontSize: 13, fontWeight: 700 }}>המלצה</div>
                  <div style={{ fontSize: 18, fontWeight: 800 }}>{recommendation.title}</div>
                  <div style={{ color: 'var(--text-muted)', fontSize: 14, lineHeight: 1.6 }}>
                    {recommendation.message}
                  </div>
                  {recommendation.actionLabel ? (
                    <div
                      style={{
                        justifySelf: 'start',
                        borderRadius: 999,
                        padding: '6px 10px',
                        fontSize: 12,
                        fontWeight: 700,
                        color: recommendationPriorityColor,
                        background: 'rgba(255,255,255,0.04)',
                      }}
                    >
                      {recommendation.actionLabel}
                    </div>
                  ) : null}
                </div>

                <div
                  style={{
                    background: 'var(--surface-2)',
                    borderRadius: 16,
                    padding: 18,
                    display: 'grid',
                    gap: 8,
                  }}
                >
                  <div style={{ color: 'var(--text-muted)', fontSize: 13, fontWeight: 700 }}>פירוק המדדים</div>
                  <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>ביצועים: {exerciseLabel}</div>
                  <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>משקל: {weightLabel}</div>
                  <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>תזונה: {nutritionLabel}</div>
                  <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>עקביות: {consistencyLabel}</div>
                </div>
              </>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function WorkoutConsistencyAccordion({
  isLoading,
  error,
  result,
}: {
  isLoading: boolean;
  error: string;
  result: WorkoutConsistencyResult;
}) {
  const [open, setOpen] = useState(false);
  const lastWeekStatusLabel =
    result.lastWeek.status === 'high' ? 'גבוהה' : result.lastWeek.status === 'medium' ? 'בינונית' : 'נמוכה';
  const paceStatusLabel =
    result.currentWeek.paceStatus === 'ahead'
      ? 'לפני הקצב'
      : result.currentWeek.paceStatus === 'behind'
        ? 'מאחור'
        : 'בקצב';
  const confidenceLabel =
    result.confidence === 'high' ? 'גבוהה' : result.confidence === 'medium' ? 'בינונית' : 'נמוכה';

  return (
    <div style={{ background: 'var(--surface)', borderRadius: 20, overflow: 'hidden' }}>
      <button
        type='button'
        onClick={() => setOpen((prev) => !prev)}
        style={{
          width: '100%',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: 20,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          color: 'var(--text)',
        }}
      >
        <div style={{ textAlign: 'right', flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 18, fontWeight: 800 }}>WORKOUT CONSISTENCY</div>
          <div style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 2 }}>
            מעקב עקביות אימונים
          </div>
        </div>
        <span
          style={{
            fontSize: 18,
            color: 'var(--text-muted)',
            transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.2s',
            flexShrink: 0,
          }}
        >
          ▼
        </span>
      </button>

      {open ? (
        <div style={{ padding: '0 20px 20px' }}>
          <div style={{ display: 'grid', gap: 16 }}>
            <div>
              <div style={{ fontSize: 20, fontWeight: 800 }}>WORKOUT CONSISTENCY</div>
              <div style={{ color: 'var(--text-muted)', fontSize: 14, lineHeight: 1.6, marginTop: 6 }}>
                הדוח בודק עד כמה עמדת בתוכנית האימונים שלך בשבוע שעבר, והאם אתה בקצב נכון השבוע.
              </div>
            </div>

            {isLoading ? (
              <ConsistencyInfoCard tone='muted' text='טוען היסטוריית אימונים...' />
            ) : error ? (
              <ConsistencyInfoCard tone='danger' text={error} />
            ) : !result.hasActiveProgram ? (
              <ConsistencyInfoCard
                tone='muted'
                text='אין כרגע תוכנית אימונים פעילה, ולכן אי אפשר לחשב עקביות שבועית.'
              />
            ) : (
              <>
                <div
                  style={{
                    background: 'var(--surface-2)',
                    borderRadius: 16,
                    padding: 18,
                    display: 'grid',
                    gap: 10,
                  }}
                >
                  <div style={{ color: 'var(--text-muted)', fontSize: 13, fontWeight: 700 }}>שבוע שעבר</div>
                  <div style={{ fontSize: 24, fontWeight: 800 }}>
                    {result.lastWeek.completed}/{result.weeklyTarget} אימונים
                  </div>
                  <div style={{ color: 'var(--accent)', fontSize: 18, fontWeight: 800 }}>
                    {result.lastWeek.percentage}%
                  </div>
                  <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>
                    סטטוס: {lastWeekStatusLabel}
                  </div>
                </div>

                <div
                  style={{
                    background: 'var(--surface-2)',
                    borderRadius: 16,
                    padding: 18,
                    display: 'grid',
                    gap: 8,
                  }}
                >
                  <div style={{ color: 'var(--text-muted)', fontSize: 13, fontWeight: 700 }}>השבוע</div>
                  <div style={{ color: 'var(--text)', fontSize: 15 }}>בוצעו: {result.currentWeek.completed}</div>
                  <div style={{ color: 'var(--text)', fontSize: 15 }}>
                    צפוי עד עכשיו: {result.currentWeek.expectedSoFar}
                  </div>
                  <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>
                    סטטוס: {paceStatusLabel}
                  </div>
                </div>

                <div
                  style={{
                    background: 'var(--surface-2)',
                    borderRadius: 16,
                    padding: 18,
                    display: 'grid',
                    gap: 6,
                  }}
                >
                  <div style={{ color: 'var(--text-muted)', fontSize: 13, fontWeight: 700 }}>הקשר</div>
                  <div style={{ color: 'var(--text-muted)', fontSize: 14, lineHeight: 1.6 }}>
                    {result.reason}
                  </div>
                  <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>
                    רמת ביטחון: {confidenceLabel}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ConsistencyInfoCard({ text, tone }: { text: string; tone: 'muted' | 'danger' }) {
  return (
    <div
      style={{
        background: 'var(--surface-2)',
        borderRadius: 16,
        padding: 18,
        display: 'grid',
        gap: 8,
      }}
    >
      <div style={{ fontSize: 20, fontWeight: 800 }}>WORKOUT CONSISTENCY</div>
      <div
        style={{
          color: tone === 'danger' ? 'var(--danger)' : 'var(--text-muted)',
          fontSize: 14,
          lineHeight: 1.6,
        }}
      >
        {text}
      </div>
    </div>
  );
}

function ExerciseProgressAccordion({
  exerciseOptions,
  selectedExercise,
  onSelectExercise,
  isLoading,
  error,
  result,
  occurrences,
}: {
  exerciseOptions: string[];
  selectedExercise: string;
  onSelectExercise: (value: string) => void;
  isLoading: boolean;
  error: string;
  result: ExerciseProgressResult | null;
  occurrences: ExerciseExerciseOccurrence[];
}) {
  const [open, setOpen] = useState(false);
  const hasExercises = exerciseOptions.length > 0;

  return (
    <div style={{ background: 'var(--surface)', borderRadius: 20, overflow: 'hidden' }}>
      <button
        type='button'
        onClick={() => setOpen((prev) => !prev)}
        style={{
          width: '100%',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: 20,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          color: 'var(--text)',
        }}
      >
        <div style={{ textAlign: 'right', flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 18, fontWeight: 800 }}>EXERCISE PROGRESS</div>
          <div style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 2 }}>
            {hasExercises ? selectedExercise || 'בחר תרגיל' : 'אין תרגילים זמינים בתוכנית'}
          </div>
        </div>
        <span
          style={{
            fontSize: 18,
            color: 'var(--text-muted)',
            transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.2s',
            flexShrink: 0,
          }}
        >
          ▼
        </span>
      </button>

      {open ? (
        <div style={{ padding: '0 20px 20px' }}>
          <ExerciseProgressPanel
            exerciseOptions={exerciseOptions}
            selectedExercise={selectedExercise}
            onSelectExercise={onSelectExercise}
            isLoading={isLoading}
            error={error}
            result={result}
            occurrences={occurrences}
          />
        </div>
      ) : null}
    </div>
  );
}

function ExerciseProgressPanel({
  exerciseOptions,
  selectedExercise,
  onSelectExercise,
  isLoading,
  error,
  result,
  occurrences,
}: {
  exerciseOptions: string[];
  selectedExercise: string;
  onSelectExercise: (value: string) => void;
  isLoading: boolean;
  error: string;
  result: ExerciseProgressResult | null;
  occurrences: ExerciseExerciseOccurrence[];
}) {
  if (isLoading) {
    return (
      <div style={{ background: 'var(--surface-2)', borderRadius: 16, padding: 18, display: 'grid', gap: 10 }}>
        <div style={{ fontSize: 20, fontWeight: 800 }}>EXERCISE PROGRESS</div>
        <div style={{ color: 'var(--text-muted)', fontSize: 14, lineHeight: 1.6 }}>
          טוען היסטוריית אימונים...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ background: 'var(--surface-2)', borderRadius: 16, padding: 18, display: 'grid', gap: 10 }}>
        <div style={{ fontSize: 20, fontWeight: 800 }}>EXERCISE PROGRESS</div>
        <div style={{ color: 'var(--danger)', fontSize: 14, lineHeight: 1.6 }}>{error}</div>
      </div>
    );
  }

  if (exerciseOptions.length === 0) {
    return (
      <div style={{ background: 'var(--surface-2)', borderRadius: 16, padding: 18, display: 'grid', gap: 10 }}>
        <div style={{ fontSize: 20, fontWeight: 800 }}>EXERCISE PROGRESS</div>
        <div style={{ color: 'var(--text-muted)', fontSize: 14, lineHeight: 1.6 }}>
          אין כרגע תרגילים בתוכנית האימון. אפשר להוסיף תרגילים בדף הפרופיל ואז לחזור לכאן.
        </div>
      </div>
    );
  }

  const content = exerciseTrendContent[result?.trend || 'insufficient_data'];
  const deltaText = formatDeltaPercentage(result?.deltaPercentage ?? null);
  const previousBestSet = formatBestSetSummary(result?.previousBestSet || null);
  const currentBestSet = formatBestSetSummary(result?.currentBestSet || null);
  const reasonText = getExerciseProgressReason(result);

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div>
        <div style={{ fontSize: 20, fontWeight: 800 }}>EXERCISE PROGRESS</div>
        <div style={{ color: 'var(--text-muted)', fontSize: 13, lineHeight: 1.5, marginTop: 6 }}>
          ציון ביצוע = משקל × (1 + חזרות / 30) × קושי
        </div>
        <div style={{ color: 'var(--text-muted)', fontSize: 13, lineHeight: 1.5, marginTop: 4 }}>
          המערכת מחשבת את הסט החזק ביותר בכל אימון ומשווה אותו לאימון הקודם כדי לזהות מגמת התקדמות.
        </div>
      </div>

      <div style={{ display: 'grid', gap: 8 }}>
        <label htmlFor='exercise-progress-select' style={{ color: 'var(--text-muted)', fontSize: 13, fontWeight: 700 }}>
          בחר תרגיל
        </label>
        <select
          id='exercise-progress-select'
          value={selectedExercise}
          onChange={(event) => onSelectExercise(event.target.value)}
          style={{
            width: '100%',
            borderRadius: 14,
            border: '1px solid var(--border)',
            background: 'var(--surface-2)',
            color: 'var(--text)',
            padding: '14px 16px',
            font: 'inherit',
            outline: 'none',
          }}
        >
          {exerciseOptions.map((exercise) => (
            <option key={exercise} value={exercise}>
              {exercise}
            </option>
          ))}
        </select>
      </div>

      <div
        style={{
          background: 'var(--surface-2)',
          borderRadius: 18,
          padding: 18,
          display: 'grid',
          gap: 12,
        }}
      >
        <div style={{ color: 'var(--text-muted)', fontSize: 13, fontWeight: 700 }}>תוצאה</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 26, lineHeight: 1, color: content.accent }}>{content.icon}</span>
          <div style={{ display: 'grid', gap: 2 }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: content.accent }}>{result?.label || 'אין מספיק נתונים'}</div>
            <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>{selectedExercise}</div>
          </div>
        </div>
        <div style={{ color: 'var(--text-muted)', fontSize: 14, lineHeight: 1.6 }}>
          {reasonText}
        </div>
        {deltaText ? (
          <div style={{ fontSize: 15, fontWeight: 800, color: content.accent }}>
            שינוי: {deltaText}
          </div>
        ) : null}
        <ExerciseProgressChart occurrences={occurrences} />
        {previousBestSet && currentBestSet ? (
          <div style={{ display: 'grid', gap: 4, color: 'var(--text-muted)', fontSize: 14 }}>
            <div>קודם: {previousBestSet}</div>
            <div>עכשיו: {currentBestSet}</div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function BmrAccordion({
  bmr,
  profile,
  missingFields,
}: {
  bmr: number | null;
  profile: ProfileData | null;
  missingFields: string[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <div style={{ background: 'var(--surface)', borderRadius: 20, overflow: 'hidden' }}>
      <button
        type='button'
        onClick={() => setOpen((prev) => !prev)}
        style={{
          width: '100%',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: 20,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          color: 'var(--text)',
        }}
      >
        <div style={{ textAlign: 'right', flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 18, fontWeight: 800 }}>BMR - קצב מטבולי בסיסי</div>
          <div style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 2 }}>
            {bmr !== null ? `${Math.round(bmr)} קק"ל / יום` : 'חסרים נתונים'}
          </div>
        </div>
        <span
          style={{
            fontSize: 18,
            color: 'var(--text-muted)',
            transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.2s',
            flexShrink: 0,
          }}
        >
          ▼
        </span>
      </button>

      {open ? (
        <div style={{ padding: '0 20px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ color: 'var(--text-muted)', fontSize: 13, lineHeight: 1.5 }}>
            כמה קלוריות הגוף שורף במנוחה מוחלטת. מחושב לפי נוסחת Mifflin-St Jeor.
          </div>

          {bmr !== null && profile ? (
            <>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
                <span style={{ fontSize: 52, fontWeight: 800, color: 'var(--accent)', lineHeight: 1 }}>
                  {Math.round(bmr)}
                </span>
                <span style={{ color: 'var(--text-muted)', fontSize: 15, marginBottom: 6 }}>קק"ל / יום</span>
              </div>

              <div
                style={{
                  background: 'var(--surface-2)',
                  borderRadius: 14,
                  padding: 14,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                }}
              >
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 2 }}>
                  פירוט החישוב
                </div>
                <FormulaRow label='משקל' value={`10 x ${profile.weight} = ${10 * profile.weight}`} />
                <FormulaRow label='גובה' value={`6.25 x ${profile.height} = ${6.25 * profile.height}`} />
                <FormulaRow label='גיל' value={`5 x ${profile.age} = ${5 * profile.age}`} />
                <FormulaRow label='מגדר' value={profile.gender === 'female' ? '-161 (נקבה)' : '+5 (זכר)'} />
                <div
                  style={{
                    borderTop: '1px solid var(--border)',
                    paddingTop: 8,
                    marginTop: 4,
                    display: 'flex',
                    justifyContent: 'space-between',
                  }}
                >
                  <span style={{ fontWeight: 800 }}>סה"כ</span>
                  <span style={{ fontWeight: 800, color: 'var(--accent)' }}>{Math.round(bmr)} קק"ל</span>
                </div>
              </div>

              <div
                style={{
                  background: 'var(--surface-2)',
                  borderRadius: 14,
                  padding: 14,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6,
                }}
              >
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 2 }}>
                  מה זה אומר? (TDEE)
                </div>
                <InterpretRow label='מנוחה מוחלטת' multiplier={1} bmr={bmr} />
                <InterpretRow label='פעילות קלה (1-3 ימי אימון)' multiplier={1.375} bmr={bmr} />
                <InterpretRow label='פעילות בינונית (3-5 ימים)' multiplier={1.55} bmr={bmr} />
                <InterpretRow label='פעילות גבוהה (6-7 ימים)' multiplier={1.725} bmr={bmr} />
              </div>
            </>
          ) : (
            <div
              style={{
                background: 'var(--surface-2)',
                borderRadius: 14,
                padding: 16,
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
              }}
            >
              <div style={{ fontWeight: 700 }}>חסרים נתונים לחישוב</div>
              <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>
                יש להשלים בדף הפרופיל: {missingFields.join(', ')}
              </div>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

function FormulaRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
      <span style={{ color: 'var(--text-muted)' }}>{label}</span>
      <span style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{value}</span>
    </div>
  );
}

function InterpretRow({ label, multiplier, bmr }: { label: string; multiplier: number; bmr: number }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
      <span style={{ color: 'var(--text-muted)', flex: 1, minWidth: 0, marginLeft: 8 }}>{label}</span>
      <span style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>{Math.round(bmr * multiplier)} קק"ל</span>
    </div>
  );
}
