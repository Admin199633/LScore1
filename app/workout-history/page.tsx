'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { ProtectedPage } from '@/components/ProtectedPage';
import {
  fetchSavedWorkoutSessions,
  type SavedWorkoutSession,
} from '@/lib/repositories/workoutSessionRepository';

const ENERGY_LABELS: Record<string, string> = {
  low: 'נמוכה',
  normal: 'רגילה',
  high: 'גבוהה',
};

const formatTime = (iso: string) => {
  if (!iso) return null;
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

const formatDuration = (seconds: number) => {
  if (!seconds) return null;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
};

const countSets = (workout: SavedWorkoutSession) =>
  workout.exercises.reduce((sum, exercise) => sum + exercise.sets.length, 0);

const getSkippedExercises = (workout: SavedWorkoutSession) =>
  workout.exercises.filter((ex) => ex.sets.length === 0);

export default function WorkoutHistoryPage() {
  const [workouts, setWorkouts] = useState<SavedWorkoutSession[]>([]);
  const [expandedKey, setExpandedKey] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      setIsLoading(true);
      setError('');

      try {
        const nextWorkouts = await fetchSavedWorkoutSessions();
        if (!isMounted) {
          return;
        }

        setWorkouts(nextWorkouts);
        if (nextWorkouts[0]) {
          setExpandedKey(`${nextWorkouts[0].date}-${nextWorkouts[0].dayName}`);
        }
      } catch (loadError) {
        if (isMounted) {
          setError(loadError instanceof Error ? loadError.message : 'טעינת היסטוריית האימונים נכשלה.');
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

  const sortedWorkouts = useMemo(
    () =>
      [...workouts].sort((left, right) => {
        const dateCompare = right.date.localeCompare(left.date);
        if (dateCompare !== 0) {
          return dateCompare;
        }

        return right.dayName.localeCompare(left.dayName);
      }),
    [workouts]
  );

  return (
    <ProtectedPage>
      <div style={{ display: 'grid', gap: 16 }}>
        <div
          style={{
            background: 'var(--surface)',
            borderRadius: 20,
            padding: 20,
            display: 'grid',
            gap: 8,
          }}
        >
          <div style={{ color: 'var(--text-muted)', fontSize: 13, fontWeight: 700 }}>היסטוריה</div>
          <div style={{ fontSize: 26, fontWeight: 800 }}>אימונים שמורים</div>
          <div style={{ color: 'var(--text-muted)', lineHeight: 1.6 }}>
            כל האימונים נשמרים לפי תאריך, עם אפשרות לפתוח תרגילים וסטים לכל יום.
          </div>
        </div>

        {isLoading ? <div style={{ color: 'var(--text-muted)' }}>טוען...</div> : null}
        {error ? <div style={{ color: 'var(--danger)' }}>{error}</div> : null}

        {!isLoading && !error && sortedWorkouts.length === 0 ? (
          <div
            style={{
              background: 'var(--surface)',
              borderRadius: 20,
              padding: 20,
              color: 'var(--text-muted)',
            }}
          >
            אין עדיין אימונים שמורים.
          </div>
        ) : null}

        {sortedWorkouts.map((workout) => {
          const key = `${workout.date}-${workout.dayName}`;
          const isExpanded = expandedKey === key;

          return (
            <div
              key={key}
              style={{
                background: 'var(--surface)',
                borderRadius: 20,
                padding: 20,
                display: 'grid',
                gap: 12,
              }}
            >
              <button
                type="button"
                onClick={() => setExpandedKey(isExpanded ? '' : key)}
                style={{
                  border: 0,
                  background: 'transparent',
                  color: 'var(--text)',
                  padding: 0,
                  textAlign: 'right',
                  cursor: 'pointer',
                  display: 'grid',
                  gap: 6,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
                  <div style={{ fontSize: 20, fontWeight: 800 }}>{workout.date}</div>
                  {formatTime(workout.startedAt) ? (
                    <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>
                      🕐 שעת תחילת אימון: {formatTime(workout.startedAt)}
                    </div>
                  ) : null}
                  {formatDuration(workout.durationSeconds) ? (
                    <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>
                      ⏱ משך אימון: {formatDuration(workout.durationSeconds)}
                    </div>
                  ) : null}
                </div>
                <div style={{ color: 'var(--text-muted)', fontSize: 15 }}>
                  {workout.dayName || 'ללא שם יום'}
                </div>
              </button>

              <div style={{ display: 'grid', gap: 4, fontSize: 15 }}>
                <div>תרגילים: {workout.exercises.filter((ex) => ex.sets.length > 0).length}</div>
                <div>סטים: {countSets(workout)}</div>
                {getSkippedExercises(workout).length > 0 ? (
                  <div style={{ color: 'var(--text-muted)' }}>
                    דולגו: {getSkippedExercises(workout).length} תרגילים
                  </div>
                ) : null}
                {workout.reorderCount > 0 ? (
                  <div style={{ color: 'var(--text-muted)' }}>
                    שינויי סדר: {workout.reorderCount}
                  </div>
                ) : null}
                {workout.energyLevel ? (
                  <div>אנרגיה: {ENERGY_LABELS[workout.energyLevel] || workout.energyLevel}</div>
                ) : null}
              </div>

              {isExpanded ? (
                <div style={{ display: 'grid', gap: 10 }}>
                  {getSkippedExercises(workout).length > 0 ? (
                    <div
                      style={{
                        background: 'var(--surface-2)',
                        borderRadius: 16,
                        padding: 14,
                        display: 'grid',
                        gap: 6,
                      }}
                    >
                      <div style={{ fontWeight: 700, color: 'var(--text-muted)', fontSize: 14 }}>
                        תרגילים שדולגו
                      </div>
                      {getSkippedExercises(workout).map((ex) => (
                        <div key={ex.exerciseName} style={{ fontSize: 14, color: 'var(--text-muted)' }}>
                          • {ex.exerciseName}
                        </div>
                      ))}
                    </div>
                  ) : null}
                  {workout.exercises.filter((ex) => ex.sets.length > 0).map((exercise, exerciseIndex) => (
                    <div
                      key={`${key}-done-${exercise.exerciseName}-${exerciseIndex}`}
                      style={{
                        background: 'var(--surface-2)',
                        borderRadius: 16,
                        padding: 14,
                        display: 'grid',
                        gap: 8,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                        <div style={{ fontWeight: 800 }}>{exercise.exerciseName}</div>
                        {exercise.durationSeconds ? (
                          <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>
                            ⏱ {Math.floor(exercise.durationSeconds / 60)}:{String(exercise.durationSeconds % 60).padStart(2, '0')}
                          </div>
                        ) : null}
                      </div>
                      <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>
                        יעד: {exercise.plannedSets || '-'} סטים | {exercise.plannedReps || '-'} חזרות |{' '}
                        {exercise.plannedWeight || '-'} משקל
                      </div>
                      <div style={{ display: 'grid', gap: 6 }}>
                        {exercise.sets.map((setItem, setIndex) => (
                          <div
                            key={`${key}-${exercise.exerciseName}-${setIndex}`}
                            style={{
                              background: '#121212',
                              borderRadius: 12,
                              padding: '10px 12px',
                              display: 'grid',
                              gap: 4,
                              fontSize: 14,
                            }}
                          >
                            <div style={{ fontWeight: 700 }}>סט {setIndex + 1}</div>
                            <div>משקל: {setItem.weight}</div>
                            <div>חזרות: {setItem.reps}</div>
                            <div>קושי: {setItem.difficulty}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          );
        })}

        <Link href="/home" style={{ color: 'var(--text-muted)', textAlign: 'center' }}>
          חזרה לבית
        </Link>
      </div>
    </ProtectedPage>
  );
}
