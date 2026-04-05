'use client';

import type { CSSProperties } from 'react';
import Link from 'next/link';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { ProtectedPage } from '@/components/ProtectedPage';
import { parseRecoveryParam } from '@/lib/recoveryContext';
import { RecoveryBanner } from '@/components/RecoveryBanner';
import { PageSpinner } from '@/components/PageSpinner';
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
import {
  listUserFoods,
  deleteUserFood,
  updateUserFood,
  type UserFoodRow,
} from '@/lib/repositories/userFoodRepository';
import { useSessionContext } from '@/lib/session';
import { useTheme } from '@/lib/theme';
import {
  useVibrationSettings,
  VIBRATION_INTERVAL_OPTIONS,
} from '@/lib/vibrationSettings';

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

function ProfilePageContent() {
  const searchParams = useSearchParams();
  const recoveryType = parseRecoveryParam(searchParams.get('recovery'));
  const [recoveryDismissed, setRecoveryDismissed] = useState(false);
  const { user, signOut } = useSessionContext();
  const { themePreference, setThemePreference } = useTheme();
  const {
    enabled: vibrationEnabled,
    setEnabled: setVibrationEnabled,
    intervalSeconds: vibrationInterval,
    setIntervalSeconds: setVibrationInterval,
  } = useVibrationSettings();
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
  const [userFoods, setUserFoods] = useState<UserFoodRow[]>([]);
  const [userFoodsLoading, setUserFoodsLoading] = useState(true);
  const [userFoodsError, setUserFoodsError] = useState('');
  type EditFoodModal = {
    id: string;
    name: string;
    calories: string;
    protein: string;
    carbs: string;
    fat: string;
    error: string;
    saving: boolean;
  };
  const [editFoodModal, setEditFoodModal] = useState<EditFoodModal | null>(null);

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

  useEffect(() => {
    let isMounted = true;
    setUserFoodsLoading(true);
    listUserFoods()
      .then((rows) => { if (isMounted) setUserFoods(rows); })
      .catch(() => { if (isMounted) setUserFoodsError('טעינת המזונות נכשלה.'); })
      .finally(() => { if (isMounted) setUserFoodsLoading(false); });
    return () => { isMounted = false; };
  }, []);

  const handleDeleteUserFood = async (id: string) => {
    if (!window.confirm('למחוק את המזון הזה?')) return;
    try {
      await deleteUserFood(id);
      setUserFoods((current) => current.filter((f) => f.id !== id));
    } catch (err) {
      const msg = err instanceof Error ? err.message : (err as { message?: string })?.message || 'מחיקת המזון נכשלה.';
      alert(msg);
    }
  };

  const handleOpenEditFood = (food: UserFoodRow) => {
    setEditFoodModal({
      id: food.id,
      name: food.name,
      calories: String(food.calories),
      protein: String(food.protein),
      carbs: String(food.carbs),
      fat: String(food.fat),
      error: '',
      saving: false,
    });
  };

  const handleEditFoodSave = async () => {
    if (!editFoodModal) return;
    const name = editFoodModal.name.trim();
    const calories = Number(editFoodModal.calories);
    const protein = Number(editFoodModal.protein);
    const carbs = Number(editFoodModal.carbs);
    const fat = Number(editFoodModal.fat);

    if (!name) {
      setEditFoodModal((m) => m && ({ ...m, error: 'יש למלא שם.' }));
      return;
    }
    if ([calories, protein, carbs, fat].some((v) => isNaN(v) || v < 0)) {
      setEditFoodModal((m) => m && ({ ...m, error: 'ערכים תזונתיים חייבים להיות מספרים אי-שליליים.' }));
      return;
    }

    setEditFoodModal((m) => m && ({ ...m, saving: true, error: '' }));
    try {
      const updated = await updateUserFood(editFoodModal.id, { name, calories, protein, carbs, fat });
      setUserFoods((current) => current.map((f) => f.id === updated.id ? updated : f));
      setEditFoodModal(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : (err as { message?: string })?.message || 'שגיאה בשמירה, נסה שוב';
      setEditFoodModal((m) => m && ({ ...m, saving: false, error: msg }));
    }
  };

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
      setRecoveryDismissed(true);
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
    return <ProtectedPage><PageSpinner /></ProtectedPage>;
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
            gap: 12,
          }}
        >
          <div style={{ fontSize: 18, fontWeight: 800 }}>תזכורות אימון</div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
            }}
          >
            <div>
              <div style={{ fontWeight: 700, fontSize: 14 }}>תזכורת רטט בזמן אימון</div>
              <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>
                רטט קצר בכל מרווח זמן קבוע
              </div>
            </div>
            <button
              type="button"
              onClick={() => setVibrationEnabled(!vibrationEnabled)}
              style={{
                border: 0,
                borderRadius: 999,
                padding: '10px 16px',
                background: vibrationEnabled ? 'var(--accent)' : 'var(--surface-2)',
                color: '#fff',
                fontWeight: 700,
                cursor: 'pointer',
                flexShrink: 0,
              }}
            >
              {vibrationEnabled ? 'פעיל' : 'כבוי'}
            </button>
          </div>
          {vibrationEnabled ? (
            <div style={{ display: 'grid', gap: 8 }}>
              <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>מרווח בין תזכורות</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {VIBRATION_INTERVAL_OPTIONS.map((seconds) => (
                  <button
                    key={seconds}
                    type="button"
                    onClick={() => setVibrationInterval(seconds)}
                    style={chipStyle(vibrationInterval === seconds)}
                  >
                    {seconds >= 60 ? `${seconds / 60} דקות` : `${seconds} שניות`}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
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
            ...(recoveryType === 'program' && !recoveryDismissed
              ? { outline: '2px solid var(--accent)', outlineOffset: 2 }
              : {}),
          }}
        >
          {recoveryType === 'program' && !recoveryDismissed ? (
            <RecoveryBanner message="כדאי להגדיר תוכנית אימונים פעילה כדי שנוכל לעקוב נכון אחרי ההתקדמות שלך." />
          ) : null}
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

        <div
          style={{
            background: 'var(--surface)',
            borderRadius: 20,
            padding: 20,
            display: 'grid',
            gap: 12,
          }}
        >
          <div style={{ fontSize: 18, fontWeight: 800 }}>המזונות שלי</div>
          {userFoodsLoading ? (
            <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>טוען...</div>
          ) : userFoodsError ? (
            <div style={{ color: 'var(--danger)', fontSize: 14 }}>{userFoodsError}</div>
          ) : userFoods.length === 0 ? (
            <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>אין מזונות מותאמים אישית עדיין.</div>
          ) : (
            <div style={{ display: 'grid', gap: 8 }}>
              {userFoods.map((food) => (
                <div
                  key={food.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 12,
                    background: 'var(--surface-2)',
                    borderRadius: 14,
                    padding: '12px 14px',
                  }}
                >
                  <div style={{ display: 'grid', gap: 2 }}>
                    <div style={{ fontWeight: 700 }}>{food.name}</div>
                    <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>
                      {food.calories} קלוריות | {food.protein} חלבון
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                    <button
                      type="button"
                      onClick={() => handleOpenEditFood(food)}
                      style={{
                        border: 0,
                        borderRadius: 10,
                        background: 'var(--surface)',
                        color: 'var(--text)',
                        padding: '8px 12px',
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      ערוך
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteUserFood(food.id)}
                      style={{
                        border: 0,
                        borderRadius: 10,
                        background: 'var(--danger-bg)',
                        color: 'var(--danger)',
                        padding: '8px 12px',
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      מחק
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

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
      {editFoodModal ? (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'flex-end',
            zIndex: 100,
          }}
          onClick={() => !editFoodModal.saving && setEditFoodModal(null)}
        >
          <div
            style={{
              background: 'var(--surface)',
              borderRadius: '20px 20px 0 0',
              padding: 24,
              width: '100%',
              display: 'grid',
              gap: 12,
              maxHeight: '90vh',
              overflowY: 'auto',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontSize: 18, fontWeight: 800 }}>עריכת מזון</div>
            <input
              type="text"
              placeholder="שם"
              value={editFoodModal.name}
              onChange={(e) => setEditFoodModal((m) => m && ({ ...m, name: e.target.value }))}
              style={inputStyle}
            />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <input
                type="number"
                placeholder="קלוריות"
                value={editFoodModal.calories}
                onChange={(e) => setEditFoodModal((m) => m && ({ ...m, calories: e.target.value }))}
                style={inputStyle}
              />
              <input
                type="number"
                placeholder="חלבון"
                value={editFoodModal.protein}
                onChange={(e) => setEditFoodModal((m) => m && ({ ...m, protein: e.target.value }))}
                style={inputStyle}
              />
              <input
                type="number"
                placeholder="פחמימות"
                value={editFoodModal.carbs}
                onChange={(e) => setEditFoodModal((m) => m && ({ ...m, carbs: e.target.value }))}
                style={inputStyle}
              />
              <input
                type="number"
                placeholder="שומן"
                value={editFoodModal.fat}
                onChange={(e) => setEditFoodModal((m) => m && ({ ...m, fat: e.target.value }))}
                style={inputStyle}
              />
            </div>
            {editFoodModal.error ? (
              <div style={{ color: 'var(--danger)', fontSize: 14 }}>{editFoodModal.error}</div>
            ) : null}
            <button
              type="button"
              onClick={handleEditFoodSave}
              disabled={editFoodModal.saving}
              style={{
                border: 0,
                borderRadius: 18,
                background: 'var(--accent)',
                color: '#fff',
                padding: '16px 18px',
                fontWeight: 800,
                cursor: editFoodModal.saving ? 'default' : 'pointer',
                opacity: editFoodModal.saving ? 0.7 : 1,
              }}
            >
              {editFoodModal.saving ? 'שומר...' : 'שמור'}
            </button>
            <button
              type="button"
              onClick={() => setEditFoodModal(null)}
              disabled={editFoodModal.saving}
              style={{ ...ghostButtonStyle, textAlign: 'center', padding: '8px 0' }}
            >
              ביטול
            </button>
          </div>
        </div>
      ) : null}
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

export default function ProfilePage() {
  return (
    <Suspense fallback={<PageSpinner />}>
      <ProfilePageContent />
    </Suspense>
  );
}
