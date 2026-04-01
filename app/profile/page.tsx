'use client';

import type { CSSProperties } from 'react';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { ProtectedPage } from '@/components/ProtectedPage';
import { fetchLatestBodyweight } from '@/lib/repositories/bodyweightRepository';
import {
  fetchCurrentProfile,
  saveCurrentProfile,
} from '@/lib/repositories/profileRepository';
import {
  fetchActiveWorkoutProgram,
  saveActiveWorkoutProgram,
  type WorkoutProgramDay,
} from '@/lib/repositories/programRepository';
import { useSessionContext } from '@/lib/session';
import { useTheme } from '@/lib/theme';

const EXPERIENCE_OPTIONS = [
  ['beginner', 'מתחיל'],
  ['intermediate', 'בינוני'],
  ['advanced', 'מתקדם'],
];

const GOAL_OPTIONS = [
  ['bulk', 'מסה'],
  ['cut', 'חיטוב'],
  ['maintain', 'שמירה'],
];

const GENDER_OPTIONS = [
  ['male', 'זכר'],
  ['female', 'נקבה'],
];

const createEmptyRow = () => ({
  id: '',
  exercise: '',
  sets: '',
  repsHeavy: '',
  weightHeavy: '',
});

const createEmptyDay = () => ({
  id: '',
  name: '',
  rows: [createEmptyRow()],
});

const normalizeEditableProgramDays = (days: WorkoutProgramDay[] = []) =>
  Array.isArray(days) && days.length > 0
    ? days.map((day) => ({
        id: day.id || '',
        name: day.name || '',
        rows:
          Array.isArray(day.rows) && day.rows.length > 0
            ? day.rows.map((row) => ({
                id: row.id || '',
                exercise: row.exercise || '',
                sets: row.sets || '',
                repsHeavy: row.repsHeavy || '',
                weightHeavy: row.weightHeavy || '',
              }))
            : [createEmptyRow()],
      }))
    : [createEmptyDay()];

const parseCommaList = (value: string) =>
  value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

export default function ProfilePage() {
  const { user, signOut } = useSessionContext();
  const { themePreference, setThemePreference } = useTheme();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [programSummary, setProgramSummary] = useState<{ dayCount: number; names: string[] }>({
    dayCount: 0,
    names: [],
  });
  const [programDays, setProgramDays] = useState<Array<ReturnType<typeof createEmptyDay>>>([createEmptyDay()]);
  const [selectedDayIndex, setSelectedDayIndex] = useState(0);
  const [isSavingProgram, setIsSavingProgram] = useState(false);
  const [programError, setProgramError] = useState('');
  const [programMessage, setProgramMessage] = useState('');
  const [form, setForm] = useState({
    age: '',
    height: '',
    gender: '',
    experience: 'beginner',
    goal: 'bulk',
    focusAreasText: '',
  });

  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      setIsLoading(true);
      setError('');

      try {
        const [latestBodyweight, profile, program] = await Promise.all([
          fetchLatestBodyweight().catch(() => null),
          fetchCurrentProfile(),
          fetchActiveWorkoutProgram().catch(() => ({ id: '', days: [] })),
        ]);

        if (!isMounted) {
          return;
        }

        setForm({
          age: profile?.age ? String(profile.age) : '',
          height: profile?.height ? String(profile.height) : '',
          gender: profile?.gender || '',
          experience: profile?.experience || 'beginner',
          goal: profile?.goal || 'bulk',
          focusAreasText: Array.isArray(profile?.focusAreas) ? profile.focusAreas.join(', ') : '',
        });

        setProgramSummary({
          dayCount: program.days?.length || 0,
          names: (program.days || []).map((day) => day.name).filter(Boolean),
        });
        setProgramDays(normalizeEditableProgramDays(program.days || []));
        setSelectedDayIndex(0);

        if (latestBodyweight?.weight && !profile?.weight) {
          setMessage(`המשקל האחרון השמור: ${latestBodyweight.weight}`);
        }
      } catch (loadError) {
        if (isMounted) {
          setError(loadError instanceof Error ? loadError.message : 'טעינת הפרופיל נכשלה.');
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

  const updateField = (field: string, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
    setError('');
    setMessage('');
  };

  const replaceProgramDay = (
    dayIndex: number,
    updater: (day: ReturnType<typeof createEmptyDay>) => ReturnType<typeof createEmptyDay>
  ) => {
    setProgramDays((current) =>
      current.map((day, currentIndex) => (currentIndex === dayIndex ? updater(day) : day))
    );
    setProgramError('');
    setProgramMessage('');
  };

  const updateDayName = (value: string) => {
    replaceProgramDay(selectedDayIndex, (day) => ({ ...day, name: value }));
  };

  const updateProgramRow = (
    rowIndex: number,
    field: 'exercise' | 'sets' | 'repsHeavy' | 'weightHeavy',
    value: string
  ) => {
    replaceProgramDay(selectedDayIndex, (day) => ({
      ...day,
      rows: day.rows.map((row, currentRowIndex) =>
        currentRowIndex === rowIndex ? { ...row, [field]: value } : row
      ),
    }));
  };

  const addProgramDay = () => {
    setProgramDays((current) => {
      const nextDays = [...current, createEmptyDay()];
      setSelectedDayIndex(nextDays.length - 1);
      return nextDays;
    });
    setProgramError('');
    setProgramMessage('');
  };

  const removeProgramDay = () => {
    setProgramDays((current) => {
      const nextDays = current.filter((_, index) => index !== selectedDayIndex);
      const safeDays = nextDays.length > 0 ? nextDays : [createEmptyDay()];
      setSelectedDayIndex((previous) => Math.max(0, Math.min(previous, safeDays.length - 1)));
      return safeDays;
    });
    setProgramError('');
    setProgramMessage('');
  };

  const addProgramRow = () => {
    replaceProgramDay(selectedDayIndex, (day) => ({
      ...day,
      rows: [...day.rows, createEmptyRow()],
    }));
  };

  const removeProgramRow = (rowIndex: number) => {
    replaceProgramDay(selectedDayIndex, (day) => ({
      ...day,
      rows:
        day.rows.length > 1
          ? day.rows.filter((_, currentRowIndex) => currentRowIndex !== rowIndex)
          : [createEmptyRow()],
    }));
  };

  const handleSave = async () => {
    const age = Number(form.age);
    const height = Number(form.height);

    if (!age || age <= 0 || !height || height <= 0) {
      setError('יש למלא גיל וגובה תקינים.');
      return;
    }

    setIsSaving(true);
    setError('');
    setMessage('');

    try {
      await saveCurrentProfile({
        age,
        height,
        gender: form.gender,
        experience: form.experience,
        goal: form.goal,
        focusAreas: parseCommaList(form.focusAreasText),
      });
      setMessage('הפרופיל נשמר.');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'שמירת הפרופיל נכשלה.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveProgram = async () => {
    const normalizedDays = programDays
      .map((day) => ({
        id: day.id || '',
        name: day.name.trim(),
        rows: day.rows
          .map((row) => ({
            exercise: row.exercise.trim(),
            sets: row.sets.trim(),
            repsHeavy: row.repsHeavy.trim(),
            weightHeavy: row.weightHeavy.trim(),
          }))
          .filter((row) => row.exercise || row.sets || row.repsHeavy || row.weightHeavy),
      }))
      .filter((day) => day.name || day.rows.length > 0);

    const invalidDay = normalizedDays.find((day) => {
      const hasRowData = day.rows.some(
        (row) => row.exercise || row.sets || row.repsHeavy || row.weightHeavy
      );
      return hasRowData && !day.name;
    });

    if (invalidDay) {
      setProgramError('שם היום לא יכול להיות ריק אם קיימת בו שורת תרגיל.');
      setProgramMessage('');
      return;
    }

    const invalidRow = normalizedDays.find((day) =>
      day.rows.some((row) => !row.exercise && (row.sets || row.repsHeavy || row.weightHeavy))
    );

    if (invalidRow) {
      setProgramError('אם מילאת סטים, חזרות או משקל, חובה למלא גם שם תרגיל.');
      setProgramMessage('');
      return;
    }

    setIsSavingProgram(true);
    setProgramError('');
    setProgramMessage('');

    try {
      const savedProgram = await saveActiveWorkoutProgram({
        days: normalizedDays.map((day) => ({
          id: day.id,
          name: day.name,
          rows: day.rows.map((row) => ({
            id: '',
            exercise: row.exercise,
            sets: row.sets,
            repsHeavy: row.repsHeavy,
            weightHeavy: row.weightHeavy,
          })),
        })),
      });

      const savedDays = normalizeEditableProgramDays(savedProgram.days || []);
      setProgramDays(savedDays);
      setSelectedDayIndex((current) => Math.min(current, savedDays.length - 1));
      setProgramSummary({
        dayCount: savedDays.length,
        names: savedDays.map((day) => day.name).filter(Boolean),
      });
      setProgramMessage('התוכנית נשמרה בהצלחה.');
    } catch (saveError) {
      setProgramError(saveError instanceof Error ? saveError.message : 'שמירת התוכנית נכשלה.');
      setProgramMessage('');
    } finally {
      setIsSavingProgram(false);
    }
  };

  const themeLabel = useMemo(() => {
    switch (themePreference) {
      case 'light':
        return 'בהיר';
      case 'dark':
        return 'כהה';
      case 'ai':
        return 'AI';
      default:
        return 'כהה';
    }
  }, [themePreference]);

  if (isLoading) {
    return (
      <ProtectedPage>
        <div style={{ color: 'var(--text-muted)' }}>טוען פרופיל...</div>
      </ProtectedPage>
    );
  }

  const selectedProgramDay = programDays[selectedDayIndex] || createEmptyDay();

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
          <div style={{ color: 'var(--text-muted)', fontSize: 13, fontWeight: 700 }}>פרופיל</div>
          <div style={{ fontSize: 26, fontWeight: 800 }}>הגדרות אישיות</div>
          <div style={{ color: 'var(--text-muted)', lineHeight: 1.6 }}>
            עדכון פרטים אישיים, נושא תצוגה, וגישה לפעולות החשבון.
          </div>
          <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>{user?.email || ''}</div>
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
          <input
            type="number"
            placeholder="גיל"
            value={form.age}
            onChange={(event) => updateField('age', event.target.value)}
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
              cursor: isSaving ? 'default' : 'pointer',
              opacity: isSaving ? 0.7 : 1,
            }}
          >
            {isSaving ? 'שומר...' : 'שמור פרופיל'}
          </button>
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
          <div style={{ fontSize: 18, fontWeight: 800 }}>ערכת נושא</div>
          <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>נוכחי: {themeLabel}</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => setThemePreference('light')}
              style={chipStyle(themePreference === 'light')}
            >
              בהיר
            </button>
            <button
              type="button"
              onClick={() => setThemePreference('dark')}
              style={chipStyle(themePreference === 'dark')}
            >
              כהה
            </button>
            <button
              type="button"
              onClick={() => setThemePreference('ai')}
              style={chipStyle(themePreference === 'ai')}
            >
              AI
            </button>
          </div>
        </div>

        <div
          style={{
            background: 'var(--surface)',
            borderRadius: 20,
            padding: 20,
            display: 'grid',
            gap: 10,
          }}
        >
          <div style={{ fontSize: 18, fontWeight: 800 }}>תוכנית נוכחית</div>
          <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>
            {programSummary.dayCount > 0
              ? `${programSummary.dayCount} ימי אימון: ${programSummary.names.join(', ')}`
              : 'עדיין אין תוכנית פעילה.'}
          </div>
        </div>

        <div
          style={{
            background: 'var(--surface)',
            borderRadius: 20,
            padding: 20,
            display: 'grid',
            gap: 14,
          }}
        >
          <div style={{ display: 'grid', gap: 4 }}>
            <div style={{ fontSize: 18, fontWeight: 800 }}>עריכת תוכנית אימון</div>
            <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>
              בחר יום, עדכן את שם היום ואת שורות התרגילים, ושמור את התוכנית.
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {programDays.map((day, index) => {
              const isActive = index === selectedDayIndex;
              return (
                <button
                  key={day.id || `program-day-${index}`}
                  type="button"
                  onClick={() => setSelectedDayIndex(index)}
                  style={chipStyle(isActive)}
                >
                  {day.name || `יום ${index + 1}`}
                </button>
              );
            })}
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" onClick={addProgramDay} style={secondaryButtonStyle}>
              הוסף יום אימון
            </button>
            <button type="button" onClick={removeProgramDay} style={dangerButtonStyle}>
              מחק את היום הנבחר
            </button>
          </div>

          <input
            type="text"
            placeholder="שם היום"
            value={selectedProgramDay.name}
            onChange={(event) => updateDayName(event.target.value)}
            style={inputStyle}
          />

          <div style={{ display: 'grid', gap: 12 }}>
            {selectedProgramDay.rows.map((row, rowIndex) => (
              <div
                key={`${selectedDayIndex}-${rowIndex}`}
                style={{
                  background: 'var(--surface-2)',
                  borderRadius: 16,
                  padding: 14,
                  display: 'grid',
                  gap: 10,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => removeProgramRow(rowIndex)}
                    style={{ ...ghostButtonStyle, color: 'var(--danger)' }}
                  >
                    מחק שורה
                  </button>
                  <div style={{ fontWeight: 700 }}>{`תרגיל ${rowIndex + 1}`}</div>
                </div>

                <input
                  type="text"
                  placeholder="תרגיל"
                  value={row.exercise}
                  onChange={(event) => updateProgramRow(rowIndex, 'exercise', event.target.value)}
                  style={inputStyle}
                />

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                  <input
                    type="text"
                    placeholder="סטים"
                    value={row.sets}
                    onChange={(event) => updateProgramRow(rowIndex, 'sets', event.target.value)}
                    style={inputStyle}
                  />
                  <input
                    type="text"
                    placeholder="חזרות"
                    value={row.repsHeavy}
                    onChange={(event) => updateProgramRow(rowIndex, 'repsHeavy', event.target.value)}
                    style={inputStyle}
                  />
                  <input
                    type="text"
                    placeholder="משקל"
                    value={row.weightHeavy}
                    onChange={(event) => updateProgramRow(rowIndex, 'weightHeavy', event.target.value)}
                    style={inputStyle}
                  />
                </div>
              </div>
            ))}
          </div>

          <button type="button" onClick={addProgramRow} style={secondaryButtonStyle}>
            הוסף שורת תרגיל
          </button>

          <button
            type="button"
            onClick={handleSaveProgram}
            disabled={isSavingProgram}
            style={{
              border: 0,
              borderRadius: 18,
              background: 'var(--accent)',
              color: '#fff',
              padding: '16px 18px',
              fontWeight: 800,
              cursor: isSavingProgram ? 'default' : 'pointer',
              opacity: isSavingProgram ? 0.7 : 1,
            }}
          >
            {isSavingProgram ? 'שומר...' : 'שמור תוכנית'}
          </button>
        </div>

        {message ? <div style={{ color: 'var(--success)' }}>{message}</div> : null}
        {error ? <div style={{ color: 'var(--danger)' }}>{error}</div> : null}
        {programMessage ? <div style={{ color: 'var(--success)' }}>{programMessage}</div> : null}
        {programError ? <div style={{ color: 'var(--danger)' }}>{programError}</div> : null}

        <button
          type="button"
          onClick={signOut}
          style={{
            border: 0,
            borderRadius: 18,
            background: 'var(--danger-bg)',
            color: 'var(--danger)',
            padding: '16px 18px',
            fontWeight: 800,
            cursor: 'pointer',
          }}
        >
          התנתק
        </button>

        <Link href="/home" style={{ color: 'var(--text-muted)', textAlign: 'center' }}>
          חזרה לבית
        </Link>
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
  fontWeight: 700,
};

const dangerButtonStyle: CSSProperties = {
  border: 0,
  borderRadius: 14,
  padding: '12px 14px',
  background: 'var(--danger-bg)',
  color: 'var(--danger)',
  cursor: 'pointer',
  fontWeight: 700,
};

const ghostButtonStyle: CSSProperties = {
  border: 0,
  background: 'transparent',
  color: 'var(--text-muted)',
  cursor: 'pointer',
  padding: 0,
};
