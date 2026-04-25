'use client';

import Link from 'next/link';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { ProtectedPage } from '@/components/ProtectedPage';
import { parseRecoveryParam } from '@/lib/recoveryContext';
import { PageSpinner } from '@/components/PageSpinner';
import { fetchLatestBodyweight } from '@/lib/repositories/bodyweightRepository';
import {
  createBodyMeasurementLog,
  deleteBodyMeasurementLog,
  getLatestBodyMeasurementLog,
  listBodyMeasurementLogs,
  updateBodyMeasurementLog,
  type BodyMeasurementLog,
} from '@/lib/repositories/bodyMeasurementRepository';
import {
  fetchCurrentProfile,
  saveCurrentProfile,
} from '@/lib/repositories/profileRepository';
import {
  fetchActiveWorkoutProgram,
  saveActiveWorkoutProgram,
} from '@/lib/repositories/programRepository';
import {
  listUserFoods,
  deleteUserFood,
  updateUserFood,
  type UserFoodRow,
} from '@/lib/repositories/userFoodRepository';
import { downloadUserFitnessExport } from '@/lib/export/userFitnessExportService';
import { useSessionContext } from '@/lib/session';
import { useTheme } from '@/lib/theme';
import {
  useVibrationSettings,
  VIBRATION_INTERVAL_OPTIONS,
} from '@/lib/vibrationSettings';
import { isValidNutritionTargetNumber, type NutritionTargetMode } from '@/lib/nutritionTargets';
import {
  createEmptyDay,
  createEmptyRow,
  createEmptyMeasurementForm,
  formatMeasurementValue,
  getFilledMeasurementValues,
  measurementToFormValues,
  normalizeEditableProgramDays,
  parseCommaList,
} from './utils/profilePage';
import { EditFoodModal, type EditFoodModalState } from './components/EditFoodModal';
import { MeasurementsSection } from './components/MeasurementsSection';
import { ProfileSection } from './components/ProfileSection';
import { SectionHeader } from './components/SectionHeader';
import { SettingsSection } from './components/SettingsSection';
import { UserFoodsSection } from './components/UserFoodsSection';
import { WorkoutSection } from './components/WorkoutSection';


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
  const [isSavingMeasurement, setIsSavingMeasurement] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [measurementError, setMeasurementError] = useState('');
  const [measurementMessage, setMeasurementMessage] = useState('');
  const [latestMeasurement, setLatestMeasurement] = useState<BodyMeasurementLog | null>(null);
  const [measurementLogs, setMeasurementLogs] = useState<BodyMeasurementLog[]>([]);
  const [editingMeasurementId, setEditingMeasurementId] = useState<string | null>(null);
  const [isProfileSectionOpen, setIsProfileSectionOpen] = useState(true);
  const [isMeasurementsSectionOpen, setIsMeasurementsSectionOpen] = useState(true);
  const [isWorkoutSectionOpen, setIsWorkoutSectionOpen] = useState(false);
  const [isUserFoodsSectionOpen, setIsUserFoodsSectionOpen] = useState(false);
  const [isSettingsSectionOpen, setIsSettingsSectionOpen] = useState(false);
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
    nutritionTargetMode: 'auto' as NutritionTargetMode,
    manualDailyCalories: '',
    manualDailyProtein: '',
  });
  const [measurementForm, setMeasurementForm] = useState(createEmptyMeasurementForm);
  const [userFoods, setUserFoods] = useState<UserFoodRow[]>([]);
  const [userFoodsLoading, setUserFoodsLoading] = useState(true);
  const [userFoodsError, setUserFoodsError] = useState('');
  const [editFoodModal, setEditFoodModal] = useState<EditFoodModalState | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState('');
  const [exportMessage, setExportMessage] = useState('');

  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      setIsLoading(true);
      setError('');

      try {
        const [latestBodyweight, profile, program, latestMeasurementLog, bodyMeasurementHistory] = await Promise.all([
          fetchLatestBodyweight().catch(() => null),
          fetchCurrentProfile(),
          fetchActiveWorkoutProgram().catch(() => ({ id: '', days: [] })),
          getLatestBodyMeasurementLog().catch(() => null),
          listBodyMeasurementLogs().catch(() => []),
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
          nutritionTargetMode: profile?.nutritionTargetMode || 'auto',
          manualDailyCalories: profile?.manualDailyCalories ? String(profile.manualDailyCalories) : '',
          manualDailyProtein: profile?.manualDailyProtein ? String(profile.manualDailyProtein) : '',
        });

        setProgramSummary({
          dayCount: program.days?.length || 0,
          names: (program.days || []).map((day) => day.name).filter(Boolean),
        });
        setProgramDays(normalizeEditableProgramDays(program.days || []));
        setSelectedDayIndex(0);
        setLatestMeasurement(latestMeasurementLog);
        setMeasurementLogs(bodyMeasurementHistory);

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

  const updateMeasurementField = (
    field: keyof ReturnType<typeof createEmptyMeasurementForm>,
    value: string
  ) => {
    setMeasurementForm((current) => ({ ...current, [field]: value }));
    setMeasurementError('');
    setMeasurementMessage('');
  };

  const handleEditMeasurement = (measurement: BodyMeasurementLog) => {
    setEditingMeasurementId(measurement.id);
    setMeasurementForm(measurementToFormValues(measurement));
    setMeasurementError('');
    setMeasurementMessage('');
  };

  const handleDeleteMeasurement = async (id: string) => {
    setMeasurementError('');
    setMeasurementMessage('');

    try {
      await deleteBodyMeasurementLog(id);

      const [latestMeasurementLog, bodyMeasurementHistory] = await Promise.all([
        getLatestBodyMeasurementLog(),
        listBodyMeasurementLogs(),
      ]);

      setLatestMeasurement(latestMeasurementLog);
      setMeasurementLogs(bodyMeasurementHistory);

      if (editingMeasurementId === id) {
        setEditingMeasurementId(null);
        setMeasurementForm(createEmptyMeasurementForm());
      }
    } catch (deleteError) {
      setMeasurementError(deleteError instanceof Error ? deleteError.message : 'מחיקת המדידה נכשלה.');
    }
  };

  const handleSaveMeasurement = async () => {
    const measurementValues = [
      measurementForm.chestCm,
      measurementForm.waistCm,
      measurementForm.abdomenCm,
      measurementForm.hipsCm,
      measurementForm.leftArmCm,
      measurementForm.rightArmCm,
      measurementForm.leftThighCm,
      measurementForm.rightThighCm,
      measurementForm.neckCm,
    ];

    if (!measurementForm.measurementDate.trim()) {
      setMeasurementError('יש לבחור תאריך מדידה.');
      return;
    }

    if (!measurementValues.some((value) => value.trim() !== '')) {
      setMeasurementError('יש להזין לפחות מדידת היקף אחת.');
      return;
    }

    const invalidValue = measurementValues.find((value) => {
      if (value.trim() === '') {
        return false;
      }

      const parsed = Number(value);
      return !Number.isFinite(parsed) || parsed <= 0;
    });
    if (invalidValue !== undefined) {
      setMeasurementError('ערכי מדידה חייבים להיות מספרים חיוביים.');
      return;
    }

    setIsSavingMeasurement(true);
    setMeasurementError('');
    setMeasurementMessage('');

    try {
      const measurementInput = {
        measurementDate: measurementForm.measurementDate,
        chestCm: measurementForm.chestCm,
        waistCm: measurementForm.waistCm,
        abdomenCm: measurementForm.abdomenCm,
        hipsCm: measurementForm.hipsCm,
        leftArmCm: measurementForm.leftArmCm,
        rightArmCm: measurementForm.rightArmCm,
        leftThighCm: measurementForm.leftThighCm,
        rightThighCm: measurementForm.rightThighCm,
        neckCm: measurementForm.neckCm,
        notes: measurementForm.notes,
      };

      if (editingMeasurementId) {
        await updateBodyMeasurementLog(editingMeasurementId, measurementInput);
      } else {
        await createBodyMeasurementLog(measurementInput);
      }

      const [latestMeasurementLog, bodyMeasurementHistory] = await Promise.all([
        getLatestBodyMeasurementLog(),
        listBodyMeasurementLogs(),
      ]);

      setLatestMeasurement(latestMeasurementLog);
      setMeasurementLogs(bodyMeasurementHistory);
      setEditingMeasurementId(null);
      setMeasurementForm(createEmptyMeasurementForm());
      setMeasurementMessage(editingMeasurementId ? 'מדידת היקפים עודכנה.' : 'מדידת היקפים נשמרה.');
    } catch (saveError) {
      setMeasurementError(saveError instanceof Error ? saveError.message : 'שמירת המדידה נכשלה.');
    } finally {
      setIsSavingMeasurement(false);
    }
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
    const manualDailyCalories =
      form.manualDailyCalories.trim() === '' ? null : Number(form.manualDailyCalories);
    const manualDailyProtein =
      form.manualDailyProtein.trim() === '' ? null : Number(form.manualDailyProtein);

    if (!age || age <= 0 || !height || height <= 0) {
      setError('יש למלא גיל וגובה תקינים.');
      return;
    }

    if (
      form.nutritionTargetMode === 'manual' &&
      (!isValidNutritionTargetNumber(manualDailyCalories) ||
        !isValidNutritionTargetNumber(manualDailyProtein))
    ) {
      setError('יש להזין יעד קלוריות ויעד חלבון גדולים מ-0.');
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
        nutritionTargetMode: form.nutritionTargetMode,
        manualDailyCalories,
        manualDailyProtein,
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

  const handleExportAllData = async () => {
    if (isExporting) return;

    setIsExporting(true);
    setExportError('');
    setExportMessage('');

    try {
      const exportFile = await downloadUserFitnessExport();
      setExportMessage(`הקובץ ${exportFile.fileName} הורד.`);
    } catch (downloadError) {
      setExportError(
        downloadError instanceof Error ? downloadError.message : 'ייצוא הנתונים נכשל.'
      );
    } finally {
      setIsExporting(false);
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
        <SectionHeader
          title="פרופיל ויעדים"
          isOpen={isProfileSectionOpen}
          onToggle={() => setIsProfileSectionOpen((current) => !current)}
        />
        {isProfileSectionOpen ? (
          <ProfileSection
            email={user?.email || ''}
            form={form}
            updateField={updateField}
            handleSave={handleSave}
            isSaving={isSaving}
          />
        ) : null}

        <SectionHeader
          title="מדידות היקפים"
          isOpen={isMeasurementsSectionOpen}
          onToggle={() => setIsMeasurementsSectionOpen((current) => !current)}
        />
        {isMeasurementsSectionOpen ? (
          <MeasurementsSection
            editingMeasurementId={editingMeasurementId}
            measurementForm={measurementForm}
            updateMeasurementField={updateMeasurementField}
            handleSaveMeasurement={handleSaveMeasurement}
            isSavingMeasurement={isSavingMeasurement}
            measurementMessage={measurementMessage}
            measurementError={measurementError}
            latestMeasurement={latestMeasurement}
            measurementLogs={measurementLogs}
            formatMeasurementValue={formatMeasurementValue}
            getFilledMeasurementValues={getFilledMeasurementValues}
            handleEditMeasurement={handleEditMeasurement}
            handleDeleteMeasurement={handleDeleteMeasurement}
          />
        ) : null}

        <SectionHeader
          title="Settings"
          isOpen={isSettingsSectionOpen}
          onToggle={() => setIsSettingsSectionOpen((current) => !current)}
        />
        {isSettingsSectionOpen ? (
          <SettingsSection
            themeLabel={themeLabel}
            themePreference={themePreference}
            setThemePreference={setThemePreference}
            vibrationEnabled={vibrationEnabled}
            setVibrationEnabled={setVibrationEnabled}
            vibrationInterval={vibrationInterval}
            setVibrationInterval={setVibrationInterval}
            vibrationOptions={VIBRATION_INTERVAL_OPTIONS}
          />
        ) : null}

        <SectionHeader
          title="Workout"
          isOpen={isWorkoutSectionOpen}
          onToggle={() => setIsWorkoutSectionOpen((current) => !current)}
        />
        {isWorkoutSectionOpen ? (
          <WorkoutSection
            programSummary={programSummary}
            recoveryType={recoveryType}
            recoveryDismissed={recoveryDismissed}
            programDays={programDays}
            selectedDayIndex={selectedDayIndex}
            selectedProgramDay={selectedProgramDay}
            setSelectedDayIndex={setSelectedDayIndex}
            addProgramDay={addProgramDay}
            removeProgramDay={removeProgramDay}
            updateDayName={updateDayName}
            removeProgramRow={removeProgramRow}
            updateProgramRow={updateProgramRow}
            addProgramRow={addProgramRow}
            handleSaveProgram={handleSaveProgram}
            isSavingProgram={isSavingProgram}
          />
        ) : null}

        {message ? <div style={{ color: 'var(--success)' }}>{message}</div> : null}
        {error ? <div style={{ color: 'var(--danger)' }}>{error}</div> : null}
        {programMessage ? <div style={{ color: 'var(--success)' }}>{programMessage}</div> : null}
        {programError ? <div style={{ color: 'var(--danger)' }}>{programError}</div> : null}

        <SectionHeader
          title="המזונות שלי"
          isOpen={isUserFoodsSectionOpen}
          onToggle={() => setIsUserFoodsSectionOpen((current) => !current)}
        />
        {isUserFoodsSectionOpen ? (
          <UserFoodsSection
            userFoodsLoading={userFoodsLoading}
            userFoodsError={userFoodsError}
            userFoods={userFoods}
            onEdit={handleOpenEditFood}
            onDelete={handleDeleteUserFood}
          />
        ) : null}

        <button
          type="button"
          onClick={handleExportAllData}
          disabled={isExporting}
          style={{
            border: '1px solid var(--accent)',
            borderRadius: 18,
            background: 'var(--surface)',
            color: 'var(--accent)',
            padding: '16px 18px',
            fontWeight: 800,
            cursor: isExporting ? 'default' : 'pointer',
            opacity: isExporting ? 0.7 : 1,
          }}
        >
          {isExporting ? 'מייצא...' : 'ייצוא כל הנתונים'}
        </button>
        {exportMessage ? <div style={{ color: 'var(--success)' }}>{exportMessage}</div> : null}
        {exportError ? <div style={{ color: 'var(--danger)' }}>{exportError}</div> : null}

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
        <EditFoodModal
          modal={editFoodModal}
          onClose={() => setEditFoodModal(null)}
          onSave={handleEditFoodSave}
          onChange={(patch) => setEditFoodModal((current) => (current ? { ...current, ...patch } : current))}
        />
      ) : null}
    </ProtectedPage>
  );
}
export default function ProfilePage() {
  return (
    <Suspense fallback={<PageSpinner />}>
      <ProfilePageContent />
    </Suspense>
  );
}
