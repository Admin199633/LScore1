'use client';

import { useEffect, useMemo, useState } from 'react';
import { ProtectedPage } from '@/components/ProtectedPage';
import { PageSpinner } from '@/components/PageSpinner';
import { fetchLatestBodyweight } from '@/lib/repositories/bodyweightRepository';
import { calculateExerciseProgress, type ExerciseProgressResult } from '@/lib/exerciseProgress';
import { fetchCurrentProfile } from '@/lib/repositories/profileRepository';
import { fetchActiveWorkoutProgram } from '@/lib/repositories/programRepository';
import { fetchSavedWorkoutSessions, type SavedWorkoutSession } from '@/lib/repositories/workoutSessionRepository';

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
  const [exerciseOptions, setExerciseOptions] = useState<string[]>([]);
  const [selectedExercise, setSelectedExercise] = useState('');
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
        const [profileData, latestBodyweight, activeProgram] = await Promise.all([
          fetchCurrentProfile(),
          fetchLatestBodyweight().catch(() => null),
          fetchActiveWorkoutProgram().catch(() => ({ id: '', days: [] })),
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
        />
      </div>
    </ProtectedPage>
  );
}

function ExerciseProgressAccordion({
  exerciseOptions,
  selectedExercise,
  onSelectExercise,
  isLoading,
  error,
  result,
}: {
  exerciseOptions: string[];
  selectedExercise: string;
  onSelectExercise: (value: string) => void;
  isLoading: boolean;
  error: string;
  result: ExerciseProgressResult | null;
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
}: {
  exerciseOptions: string[];
  selectedExercise: string;
  onSelectExercise: (value: string) => void;
  isLoading: boolean;
  error: string;
  result: ExerciseProgressResult | null;
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
        <div style={{ color: 'var(--text-muted)', fontSize: 13, fontWeight: 700, marginBottom: 4 }}>
          ניתוח התקדמות
        </div>
        <div style={{ fontSize: 20, fontWeight: 800 }}>EXERCISE PROGRESS</div>
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
