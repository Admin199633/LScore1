'use client';

import type { CSSProperties } from 'react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ProtectedPage } from '@/components/ProtectedPage';
import {
  getWorkoutSessionById,
  updateWorkoutSessionById,
} from '@/lib/repositories/workoutSessionRepository';

// ─── Local form types ────────────────────────────────────────────────────────

type EditSet = {
  id: string;         // DB UUID for existing; 'new-{n}' for added sets
  weight: string;
  reps: string;
  difficulty: 'easy' | 'good' | 'hard';
};

type EditExercise = {
  rowId: string;      // workout_session_exercises row UUID
  exerciseName: string;
  completed: boolean;
  sets: EditSet[];
};

type EditForm = {
  sessionDate: string;
  energyLevel: 'low' | 'normal' | 'high' | '';
  exercises: EditExercise[];
};

// ─── Constants ───────────────────────────────────────────────────────────────

const ENERGY_OPTIONS: Array<{ value: 'low' | 'normal' | 'high'; label: string }> = [
  { value: 'low', label: 'נמוכה' },
  { value: 'normal', label: 'רגילה' },
  { value: 'high', label: 'גבוהה' },
];

const DIFFICULTY_OPTIONS: Array<{ value: 'easy' | 'good' | 'hard'; label: string }> = [
  { value: 'easy', label: 'קל' },
  { value: 'good', label: 'טוב' },
  { value: 'hard', label: 'קשה' },
];

let newSetCounter = 0;
const newSetId = () => `new-${++newSetCounter}`;

// ─── Helpers ─────────────────────────────────────────────────────────────────

const isValidPositive = (value: string) => {
  const n = Number(value);
  return !isNaN(n) && n >= 0;
};

// ─── Page ────────────────────────────────────────────────────────────────────

export default function EditWorkoutSessionPage() {
  const params = useParams();
  const router = useRouter();
  const id = typeof params?.id === 'string' ? params.id : '';

  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [dayName, setDayName] = useState('');
  const [form, setForm] = useState<EditForm>({
    sessionDate: '',
    energyLevel: '',
    exercises: [],
  });

  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [validationError, setValidationError] = useState('');

  // ── Load session ────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!id) {
      setIsLoading(false);
      setLoadError('מזהה אימון חסר.');
      return;
    }

    let isMounted = true;
    setIsLoading(true);
    setLoadError('');

    getWorkoutSessionById(id)
      .then((session) => {
        if (!isMounted) return;
        if (!session) {
          setLoadError('האימון לא נמצא.');
          return;
        }

        setDayName(session.dayName);
        setForm({
          sessionDate: session.date,
          energyLevel: (session.energyLevel as EditForm['energyLevel']) || '',
          exercises: session.exercises.map((ex) => ({
            rowId: ex.rowId,
            exerciseName: ex.exerciseName,
            completed: ex.completed,
            sets: ex.sets.map((s) => ({
              id: s.id,
              weight: s.weight,
              reps: s.reps,
              difficulty: (s.difficulty as EditSet['difficulty']) || 'good',
            })),
          })),
        });
      })
      .catch((err) => {
        if (!isMounted) return;
        setLoadError(err instanceof Error ? err.message : 'טעינת האימון נכשלה.');
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => { isMounted = false; };
  }, [id]);

  // ── Form mutations ──────────────────────────────────────────────────────────

  const updateSet = (
    exIdx: number,
    setIdx: number,
    field: keyof EditSet,
    value: string
  ) => {
    setForm((current) => {
      const exercises = current.exercises.map((ex, i) => {
        if (i !== exIdx) return ex;
        return {
          ...ex,
          sets: ex.sets.map((s, j) =>
            j !== setIdx ? s : { ...s, [field]: value }
          ),
        };
      });
      return { ...current, exercises };
    });
    setValidationError('');
    setSaveError('');
  };

  const addSet = (exIdx: number) => {
    setForm((current) => {
      const exercises = current.exercises.map((ex, i) => {
        if (i !== exIdx) return ex;
        const lastSet = ex.sets[ex.sets.length - 1];
        return {
          ...ex,
          sets: [
            ...ex.sets,
            {
              id: newSetId(),
              weight: lastSet?.weight ?? '0',
              reps: lastSet?.reps ?? '0',
              difficulty: lastSet?.difficulty ?? 'good',
            },
          ],
        };
      });
      return { ...current, exercises };
    });
  };

  const deleteSet = (exIdx: number, setIdx: number) => {
    setForm((current) => {
      const exercises = current.exercises.map((ex, i) => {
        if (i !== exIdx) return ex;
        return { ...ex, sets: ex.sets.filter((_, j) => j !== setIdx) };
      });
      return { ...current, exercises };
    });
  };

  const toggleCompleted = (exIdx: number) => {
    setForm((current) => {
      const exercises = current.exercises.map((ex, i) =>
        i === exIdx ? { ...ex, completed: !ex.completed } : ex
      );
      return { ...current, exercises };
    });
  };

  // ── Save ────────────────────────────────────────────────────────────────────

  const handleSave = async () => {
    setValidationError('');
    setSaveError('');

    // Validate
    if (!form.sessionDate) {
      setValidationError('יש למלא תאריך.');
      return;
    }
    if (!form.energyLevel) {
      setValidationError('יש לבחור רמת אנרגיה.');
      return;
    }
    for (const ex of form.exercises) {
      for (const s of ex.sets) {
        if (!isValidPositive(s.weight) || !isValidPositive(s.reps)) {
          setValidationError(`ערכי משקל/חזרות לא תקינים בתרגיל "${ex.exerciseName}".`);
          return;
        }
      }
    }

    setIsSaving(true);
    try {
      await updateWorkoutSessionById(id, {
        sessionDate: form.sessionDate,
        energyLevel: form.energyLevel,
        exercises: form.exercises.map((ex) => ({
          id: ex.rowId,
          completed: ex.completed,
          sets: ex.sets.map((s, idx) => ({
            id: s.id.startsWith('new-') ? undefined : s.id,
            setOrder: idx + 1,
            weight: Number(s.weight),
            reps: Number(s.reps),
            difficulty: s.difficulty,
          })),
        })),
      });
      router.push('/workout-history');
    } catch {
      setSaveError('שגיאה בשמירה, נסה שוב');
    } finally {
      setIsSaving(false);
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <ProtectedPage>
      <div style={{ display: 'grid', gap: 16 }}>

        {/* Header */}
        <div style={{ background: 'var(--surface)', borderRadius: 20, padding: 20, display: 'grid', gap: 6 }}>
          <div style={{ color: 'var(--text-muted)', fontSize: 13, fontWeight: 700 }}>עריכת אימון</div>
          {isLoading ? (
            <div style={{ color: 'var(--text-muted)' }}>טוען...</div>
          ) : loadError ? (
            <div style={{ color: 'var(--danger)' }}>{loadError}</div>
          ) : (
            <div style={{ fontSize: 22, fontWeight: 800 }}>{dayName || 'אימון'}</div>
          )}
        </div>

        {!isLoading && !loadError ? (
          <>
            {/* Metadata */}
            <div style={{ background: 'var(--surface)', borderRadius: 20, padding: 20, display: 'grid', gap: 12 }}>
              <div style={{ fontSize: 16, fontWeight: 700 }}>פרטי אימון</div>

              <div>
                <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 6 }}>תאריך</div>
                <input
                  type="date"
                  value={form.sessionDate}
                  onChange={(e) => {
                    setForm((c) => ({ ...c, sessionDate: e.target.value }));
                    setValidationError('');
                  }}
                  style={inputStyle}
                />
              </div>

              <div>
                <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 6 }}>רמת אנרגיה</div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {ENERGY_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => {
                        setForm((c) => ({ ...c, energyLevel: opt.value }));
                        setValidationError('');
                      }}
                      style={chipStyle(form.energyLevel === opt.value)}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Exercises */}
            {form.exercises.map((exercise, exIdx) => (
              <div
                key={exercise.rowId}
                style={{ background: 'var(--surface)', borderRadius: 20, padding: 20, display: 'grid', gap: 12 }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <div style={{ fontWeight: 800, fontSize: 17 }}>{exercise.exerciseName}</div>
                  <button
                    type="button"
                    onClick={() => toggleCompleted(exIdx)}
                    style={chipStyle(exercise.completed)}
                  >
                    {exercise.completed ? 'הושלם ✓' : 'לא הושלם'}
                  </button>
                </div>

                {/* Set rows */}
                <div style={{ display: 'grid', gap: 10 }}>
                  {exercise.sets.map((setItem, setIdx) => (
                    <div
                      key={setItem.id}
                      style={{
                        background: 'var(--surface-2)',
                        borderRadius: 14,
                        padding: 12,
                        display: 'grid',
                        gap: 10,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ fontWeight: 700, fontSize: 13 }}>סט {setIdx + 1}</div>
                        <button
                          type="button"
                          onClick={() => deleteSet(exIdx, setIdx)}
                          style={deleteSetButtonStyle}
                        >
                          הסר
                        </button>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                        <div>
                          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>משקל</div>
                          <input
                            type="number"
                            value={setItem.weight}
                            onChange={(e) => updateSet(exIdx, setIdx, 'weight', e.target.value)}
                            style={inputStyle}
                          />
                        </div>
                        <div>
                          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>חזרות</div>
                          <input
                            type="number"
                            value={setItem.reps}
                            onChange={(e) => updateSet(exIdx, setIdx, 'reps', e.target.value)}
                            style={inputStyle}
                          />
                        </div>
                      </div>

                      <div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>קושי</div>
                        <div style={{ display: 'flex', gap: 6 }}>
                          {DIFFICULTY_OPTIONS.map((opt) => (
                            <button
                              key={opt.value}
                              type="button"
                              onClick={() => updateSet(exIdx, setIdx, 'difficulty', opt.value)}
                              style={chipStyle(setItem.difficulty === opt.value)}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => addSet(exIdx)}
                  style={addSetButtonStyle}
                >
                  + הוסף סט
                </button>
              </div>
            ))}

            {/* Errors */}
            {validationError ? (
              <div style={{ color: 'var(--danger)', fontSize: 14 }}>{validationError}</div>
            ) : null}
            {saveError ? (
              <div style={{ color: 'var(--danger)', fontSize: 14 }}>{saveError}</div>
            ) : null}

            {/* Save */}
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              style={{
                border: 0,
                borderRadius: 18,
                background: 'var(--accent)',
                color: '#fff',
                padding: '16px 18px',
                fontWeight: 800,
                fontSize: 16,
                cursor: isSaving ? 'default' : 'pointer',
                opacity: isSaving ? 0.7 : 1,
              }}
            >
              {isSaving ? 'שומר...' : 'שמור שינויים'}
            </button>
          </>
        ) : null}

        <Link href="/workout-history" style={{ color: 'var(--text-muted)', textAlign: 'center' }}>
          חזרה להיסטוריה
        </Link>
      </div>
    </ProtectedPage>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const inputStyle: CSSProperties = {
  width: '100%',
  borderRadius: 12,
  border: '1px solid var(--border)',
  background: 'var(--surface-2)',
  color: 'var(--text)',
  padding: '10px 12px',
  fontSize: 15,
};

const chipStyle = (active: boolean): CSSProperties => ({
  border: 0,
  borderRadius: 999,
  padding: '8px 14px',
  background: active ? 'var(--accent)' : 'var(--surface-2)',
  color: active ? '#fff' : 'var(--text)',
  cursor: 'pointer',
  fontWeight: 700,
  fontSize: 13,
});

const addSetButtonStyle: CSSProperties = {
  border: 0,
  borderRadius: 12,
  padding: '10px 14px',
  background: 'var(--surface-2)',
  color: 'var(--text)',
  cursor: 'pointer',
  fontWeight: 700,
  fontSize: 14,
};

const deleteSetButtonStyle: CSSProperties = {
  border: 0,
  borderRadius: 8,
  padding: '4px 10px',
  background: 'var(--danger-bg)',
  color: 'var(--danger)',
  cursor: 'pointer',
  fontWeight: 700,
  fontSize: 12,
};
