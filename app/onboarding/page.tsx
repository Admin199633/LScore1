'use client';

import type { CSSProperties } from 'react';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ProtectedPage } from '@/components/ProtectedPage';
import { loadOnboardingData, saveOnboardingData } from '@/lib/onboarding';
import { useSessionContext } from '@/lib/session';

const EXPERIENCE_OPTIONS = [
  ['beginner', 'מתחיל'],
  ['intermediate', 'בינוני'],
  ['advanced', 'מתקדם'],
];

const GENDER_OPTIONS = [
  ['male', 'זכר'],
  ['female', 'נקבה'],
];

const GOAL_OPTIONS = [
  ['bulk', 'מסה'],
  ['cut', 'חיטוב'],
  ['maintain', 'שמירה'],
];

const createEmptyRow = () => ({
  id: crypto.randomUUID(),
  exercise: '',
  sets: '',
  repsHeavy: '',
  weightHeavy: '',
});

const createEmptyDay = () => ({
  id: crypto.randomUUID(),
  name: '',
  rows: [createEmptyRow()],
});
const buildInitialState = () => ({
  age: '',
  weight: '',
  height: '',
  gender: '',
  experience: 'beginner',
  goal: 'bulk',
  focusAreasText: '',
  days: [createEmptyDay()],
});

const formatLoadedState = ({
  user,
  program,
}: {
  user: {
    age?: number;
    weight?: number;
    height?: number;
    gender?: string;
    experience?: string;
    goal?: string;
    focusAreas?: string[];
  } | null;
  program: {
    days?: Array<{
      id?: string;
      name?: string;
      rows?: Array<{
        id?: string;
        exercise?: string;
        sets?: string;
        repsHeavy?: string;
        weightHeavy?: string;
      }>;
    }>;
  } | null;
}) => ({
  age: user?.age ? String(user.age) : '',
  weight: user?.weight ? String(user.weight) : '',
  height: user?.height ? String(user.height) : '',
  gender: user?.gender || '',
  experience: user?.experience || 'beginner',
  goal: user?.goal || 'bulk',
  focusAreasText: Array.isArray(user?.focusAreas) ? user.focusAreas.join(', ') : '',
  days:
    program?.days?.length
      ? program.days.map((day) => ({
          id: day.id || '',
          name: day.name || '',
          rows:
            day.rows?.length
              ? day.rows.map((row) => ({
                  id: row.id || '',
                  exercise: row.exercise || '',
                  sets: row.sets || '',
                  repsHeavy: row.repsHeavy || '',
                  weightHeavy: row.weightHeavy || '',
                }))
              : [createEmptyRow()],
        }))
      : [createEmptyDay()],
});

const parseCommaList = (value: string) =>
  value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

export default function OnboardingPage() {
  const router = useRouter();
  const { hasOnboarding, refreshOnboarding, signOut } = useSessionContext();

  const handleSignOut = async () => {
    await signOut();
    router.replace('/auth');
  };
  const [form, setForm] = useState(buildInitialState);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (hasOnboarding) {
      router.replace('/home');
    }
  }, [hasOnboarding, router]);

  useEffect(() => {
    let isMounted = true;

    const hydrate = async () => {
      setIsLoading(true);
      setError('');

      try {
        const savedData = await loadOnboardingData();
        if (isMounted) {
          setForm(formatLoadedState(savedData));
        }
      } catch {
        if (isMounted) {
          setError('טעינת נתוני הפתיחה נכשלה.');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    hydrate();

    return () => {
      isMounted = false;
    };
  }, []);

  const updateField = (field: string, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
    setError('');
  };

  const updateDay = (index: number, field: string, value: string) => {
    setForm((current) => ({
      ...current,
      days: current.days.map((day, currentIndex) =>
        currentIndex === index ? { ...day, [field]: value } : day
      ),
    }));
    setError('');
  };

  const updateRow = (dayIndex: number, rowIndex: number, field: string, value: string) => {
    setForm((current) => ({
      ...current,
      days: current.days.map((day, currentDayIndex) =>
        currentDayIndex === dayIndex
          ? {
              ...day,
              rows: day.rows.map((row, currentRowIndex) =>
                currentRowIndex === rowIndex ? { ...row, [field]: value } : row
              ),
            }
          : day
      ),
    }));
    setError('');
  };

  const addDay = () => {
    setForm((current) => ({ ...current, days: [...current.days, createEmptyDay()] }));
  };

  const addRow = (dayIndex: number) => {
    setForm((current) => ({
      ...current,
      days: current.days.map((day, currentDayIndex) =>
        currentDayIndex === dayIndex ? { ...day, rows: [...day.rows, createEmptyRow()] } : day
      ),
    }));
  };

  const removeDay = (index: number) => {
    setForm((current) => ({
      ...current,
      days: current.days.filter((_, currentIndex) => currentIndex !== index),
    }));
  };

  const removeRow = (dayIndex: number, rowIndex: number) => {
    setForm((current) => ({
      ...current,
      days: current.days.map((day, currentDayIndex) =>
        currentDayIndex === dayIndex
          ? {
              ...day,
              rows:
                day.rows.length > 1
                  ? day.rows.filter((_, currentRowIndex) => currentRowIndex !== rowIndex)
                  : day.rows,
            }
          : day
      ),
    }));
  };

  const handleSubmit = async () => {
    const user = {
      age: Number(form.age),
      weight: Number(form.weight),
      height: Number(form.height),
      gender: form.gender,
      experience: form.experience,
      goal: form.goal,
      focusAreas: parseCommaList(form.focusAreasText),
    };

	const normalizedDays = form.days.map((day, dayIndex) => ({
  id: day.id || `day-${dayIndex}`,
  name: day.name.trim(),
  rows: day.rows
    .map((row, rowIndex) => ({
      id: row.id || `day-${dayIndex}-row-${rowIndex}`,
      exercise: row.exercise.trim(),
      sets: row.sets.trim(),
      repsHeavy: row.repsHeavy.trim(),
      weightHeavy: row.weightHeavy.trim(),
    }))
    .filter((row) => row.exercise || row.sets || row.repsHeavy || row.weightHeavy),
}));

    if (!user.age || !user.weight || !user.height) {
      setError('יש למלא גיל, משקל וגובה תקינים.');
      return;
    }

    if (!user.experience || !user.goal) {
      setError('יש לבחור ניסיון ומטרה.');
      return;
    }

    if (!normalizedDays.length) {
      setError('יש להוסיף לפחות יום אימון אחד.');
      return;
    }

    if (normalizedDays.some((day) => !day.name || day.rows.length === 0)) {
      setError('כל יום אימון חייב לכלול שם יום ולפחות תרגיל אחד.');
      return;
    }

    setIsSaving(true);
    setError('');

    try {
      await saveOnboardingData({
        user,
        program: { days: normalizedDays },
      });
      await refreshOnboarding();
      router.replace('/home');
    } catch {
      setError('שמירת נתוני הפתיחה נכשלה.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <ProtectedPage allowIncompleteOnboarding>
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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ color: 'var(--text-muted)', fontSize: 13, fontWeight: 700 }}>פתיחה</div>
            <button
              type="button"
              onClick={handleSignOut}
              style={{
                border: '1px solid var(--border)',
                borderRadius: 10,
                background: 'var(--surface-2)',
                color: 'var(--text)',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
                padding: '6px 14px',
              }}
            >
              התנתק
            </button>
          </div>
          <div style={{ fontSize: 26, fontWeight: 800 }}>השלמת פרופיל ותוכנית</div>
          <div style={{ color: 'var(--text-muted)', lineHeight: 1.6 }}>
            הזן פרטים אישיים והגדר את ימי האימון הראשונים שלך.
          </div>
        </div>

        {isLoading ? (
          <div style={{ color: 'var(--text-muted)', padding: '8px 4px' }}>טוען פתיחה...</div>
        ) : (<>

        <div
          style={{
            background: 'var(--surface)',
            borderRadius: 20,
            padding: 20,
            display: 'grid',
            gap: 12,
          }}
        >
          <input
            type="number"
            placeholder="גיל"
            value={form.age}
            onChange={(event) => updateField('age', event.target.value)}
            style={inputStyle}
          />
          <input
            type="number"
            placeholder="משקל"
            value={form.weight}
            onChange={(event) => updateField('weight', event.target.value)}
            style={inputStyle}
          />
          <input
            type="number"
            placeholder="גובה"
            value={form.height}
            onChange={(event) => updateField('height', event.target.value)}
            style={inputStyle}
          />

          <div style={{ fontSize: 14, fontWeight: 700 }}>מגדר</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {GENDER_OPTIONS.map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => updateField('gender', value)}
                style={chipStyle(form.gender === value)}
              >
                {label}
              </button>
            ))}
          </div>

          <div style={{ fontSize: 14, fontWeight: 700 }}>ניסיון</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {EXPERIENCE_OPTIONS.map(([value, label]) => {
              const isActive = form.experience === value;
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => updateField('experience', value)}
                  style={chipStyle(isActive)}
                >
                  {label}
                </button>
              );
            })}
          </div>

          <div style={{ fontSize: 14, fontWeight: 700 }}>מטרה</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {GOAL_OPTIONS.map(([value, label]) => {
              const isActive = form.goal === value;
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => updateField('goal', value)}
                  style={chipStyle(isActive)}
                >
                  {label}
                </button>
              );
            })}
          </div>

          <input
            type="text"
            placeholder="אזורי מיקוד, מופרדים בפסיקים"
            value={form.focusAreasText}
            onChange={(event) => updateField('focusAreasText', event.target.value)}
            style={inputStyle}
          />
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
          <div style={{ fontSize: 20, fontWeight: 800 }}>תוכנית אימון</div>
          {form.days.map((day, dayIndex) => (
            <div
              key={`day-${dayIndex}`}
              style={{
                background: 'var(--surface-2)',
                borderRadius: 16,
                padding: 14,
                display: 'grid',
                gap: 10,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                <button type="button" onClick={() => removeDay(dayIndex)} style={ghostButtonStyle}>
                  הסר יום
                </button>
                <div style={{ fontWeight: 700 }}>יום {dayIndex + 1}</div>
              </div>
              <input
                type="text"
                placeholder="שם היום"
                value={day.name}
                onChange={(event) => updateDay(dayIndex, 'name', event.target.value)}
                style={inputStyle}
              />

              {day.rows.map((row, rowIndex) => (
                <div
                  key={`day-${dayIndex}-row-${rowIndex}`}
                  style={{
                    background: '#121212',
                    borderRadius: 14,
                    padding: 12,
                    display: 'grid',
                    gap: 8,
                  }}
                >
                  <input
                    type="text"
                    placeholder="תרגיל"
                    value={row.exercise}
                    onChange={(event) => updateRow(dayIndex, rowIndex, 'exercise', event.target.value)}
                    style={inputStyle}
                  />
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                    <input
                      type="text"
                      placeholder="סטים"
                      value={row.sets}
                      onChange={(event) => updateRow(dayIndex, rowIndex, 'sets', event.target.value)}
                      style={inputStyle}
                    />
                    <input
                      type="text"
                      placeholder="חזרות"
                      value={row.repsHeavy}
                      onChange={(event) => updateRow(dayIndex, rowIndex, 'repsHeavy', event.target.value)}
                      style={inputStyle}
                    />
                    <input
                      type="text"
                      placeholder="משקל"
                      value={row.weightHeavy}
                      onChange={(event) => updateRow(dayIndex, rowIndex, 'weightHeavy', event.target.value)}
                      style={inputStyle}
                    />
                  </div>
                  <button type="button" onClick={() => removeRow(dayIndex, rowIndex)} style={ghostButtonStyle}>
                    הסר שורה
                  </button>
                </div>
              ))}

              <button type="button" onClick={() => addRow(dayIndex)} style={secondaryButtonStyle}>
                הוסף שורת תרגיל
              </button>
            </div>
          ))}

          <button type="button" onClick={addDay} style={secondaryButtonStyle}>
            הוסף יום אימון
          </button>
        </div>

        {error ? <div style={{ color: 'var(--danger)' }}>{error}</div> : null}

        <button
          type="button"
          onClick={handleSubmit}
          disabled={isSaving}
          style={{
            border: 0,
            borderRadius: 18,
            background: 'var(--accent)',
            color: '#fff',
            padding: '16px 18px',
            fontWeight: 800,
            cursor: isSaving ? 'default' : 'pointer',
            opacity: isSaving ? 0.7 : 1,
          }}
        >
          {isSaving ? 'שומר...' : 'שמור והמשך'}
        </button>
        </>)}
      </div>
    </ProtectedPage>
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

const chipStyle = (active: boolean): CSSProperties => ({
  border: 0,
  borderRadius: 999,
  padding: '10px 14px',
  background: active ? 'var(--accent)' : 'var(--surface-2)',
  color: '#fff',
  cursor: 'pointer',
});

const secondaryButtonStyle: CSSProperties = {
  border: 0,
  borderRadius: 14,
  padding: '12px 14px',
  background: 'var(--surface-2)',
  color: '#fff',
  cursor: 'pointer',
};

const ghostButtonStyle: CSSProperties = {
  border: 0,
  background: 'transparent',
  color: 'var(--text-muted)',
  cursor: 'pointer',
  padding: 0,
};
