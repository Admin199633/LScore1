'use client';

import Link from 'next/link';
import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { ProtectedPage } from '@/components/ProtectedPage';
import { parseRecoveryParam } from '@/lib/recoveryContext';
import { RecoveryBanner } from '@/components/RecoveryBanner';
import { PageSpinner } from '@/components/PageSpinner';
import {
  fetchActiveWorkoutProgram,
  type WorkoutProgramDay,
} from '@/lib/repositories/programRepository';
import {
  saveFullWorkoutSession,
  fetchLatestWorkoutSessionForProgramDay,
  deleteWorkoutSession,
  updateExerciseDurations,
  updateReorderCount,
  type SavedWorkoutSession,
} from '@/lib/repositories/workoutSessionRepository';
import { getExerciseInstruction } from '@/lib/exerciseInstructions';
import { useVibrationSettings } from '@/lib/vibrationSettings';
import {
  loadWorkoutDraft,
  saveWorkoutDraft,
  clearWorkoutDraft,
} from '@/lib/workoutDraftStorage';

const emptySet = () => ({ weight: '', reps: '', difficulty: 'good' });
const getTodayDate = () => new Date().toISOString().slice(0, 10);
const parsePlannedSets = (value: string) => (/^\d+$/.test(String(value || '').trim()) ? Number(value) : 1);

type DraftExercise = {
  exerciseId: string;
  exerciseName: string;
  plannedSets: string;
  plannedReps: string;
  plannedWeight: string;
  completed: boolean;
  durationSeconds?: number;
  sets: Array<{ weight: string; reps: string; difficulty: string }>;
};

type AddExerciseForm = {
  exerciseName: string;
  plannedSets: string;
  plannedReps: string;
  plannedWeight: string;
};

type PreviousWorkoutSet = {
  weight: string;
  reps: string;
};

type PreviousExerciseLookup = {
  byExerciseId: Record<string, PreviousWorkoutSet[]>;
  byExerciseName: Record<string, PreviousWorkoutSet[]>;
};

const emptyAddExerciseForm = (): AddExerciseForm => ({
  exerciseName: '',
  plannedSets: '',
  plannedReps: '',
  plannedWeight: '',
});

const EMPTY_PREVIOUS_EXERCISE_LOOKUP: PreviousExerciseLookup = {
  byExerciseId: {},
  byExerciseName: {},
};

const normalizeExerciseMatchKey = (value: string) => String(value || '').trim().toLocaleLowerCase();

const buildPreviousExerciseLookup = (
  session: SavedWorkoutSession | null
): PreviousExerciseLookup => {
  if (!session) {
    return EMPTY_PREVIOUS_EXERCISE_LOOKUP;
  }

  const byExerciseId: Record<string, PreviousWorkoutSet[]> = {};
  const byExerciseName: Record<string, PreviousWorkoutSet[]> = {};

  for (const exercise of session.exercises) {
    const previousSets = exercise.sets.map((setItem) => ({
      weight: setItem.weight,
      reps: setItem.reps,
    }));

    if (previousSets.length === 0) {
      continue;
    }

    if (exercise.exerciseId) {
      byExerciseId[exercise.exerciseId] = previousSets;
    }

    const exerciseMatchKey = normalizeExerciseMatchKey(exercise.exerciseName);
    if (exerciseMatchKey) {
      byExerciseName[exerciseMatchKey] = previousSets;
    }
  }

  return { byExerciseId, byExerciseName };
};

const getPreviousSetsForExercise = (
  row: WorkoutProgramDay['rows'][number],
  previousExerciseLookup: PreviousExerciseLookup
): PreviousWorkoutSet[] => {
  if (row.id && previousExerciseLookup.byExerciseId[row.id]) {
    return previousExerciseLookup.byExerciseId[row.id];
  }

  const exerciseMatchKey = normalizeExerciseMatchKey(row.exercise);
  return previousExerciseLookup.byExerciseName[exerciseMatchKey] || [];
};

const buildDraftExercises = (
  day: WorkoutProgramDay | null,
  previousExerciseLookup: PreviousExerciseLookup = EMPTY_PREVIOUS_EXERCISE_LOOKUP
): DraftExercise[] =>
  (day?.rows || [])
    .filter((row) => row.exercise)
    .map((row) => {
      const previousSets = getPreviousSetsForExercise(row, previousExerciseLookup);
      const setCount = Math.max(parsePlannedSets(row.sets), previousSets.length);

      return {
        exerciseId: row.id || '',
        exerciseName: row.exercise,
        plannedSets: row.sets || '',
        plannedReps: row.repsHeavy || '',
        plannedWeight: row.weightHeavy || '',
        completed: false,
        sets: Array.from({ length: setCount }, (_, i) => {
          const previousSet = previousSets[i];
          return previousSet
            ? { weight: previousSet.weight, reps: previousSet.reps, difficulty: 'good' }
            : emptySet();
        }),
      };
    });

const formatTimer = (seconds: number) => {
  const h = String(Math.floor(seconds / 3600)).padStart(2, '0');
  const m = String(Math.floor((seconds % 3600) / 60)).padStart(2, '0');
  const s = String(seconds % 60).padStart(2, '0');
  return `${h}:${m}:${s}`;
};

const buildProgressValue = (current: number, total: number) =>
  total > 0 ? Math.min(100, Math.round(((current + 1) / total) * 100)) : 0;

const calculateElapsedSeconds = (startedAt: string) => {
  const startedAtMs = new Date(startedAt).getTime();
  if (!Number.isFinite(startedAtMs) || startedAtMs <= 0) {
    return 0;
  }

  return Math.max(0, Math.floor((Date.now() - startedAtMs) / 1000));
};

const energyLevels: Array<{ value: string; label: string }> = [
  { value: 'low', label: 'נמוכה 😴' },
  { value: 'normal', label: 'סבבה  🙂' },
  { value: 'high', label: 'גבוהה 🔥' },
];
const energyLabelMap = Object.fromEntries(energyLevels.map((level) => [level.value, level.label]));

function WorkoutPageContent() {
  const { enabled: vibrationEnabled, intervalSeconds: vibrationInterval } = useVibrationSettings();
  const searchParams = useSearchParams();
  const recoveryType = parseRecoveryParam(searchParams.get('recovery'));
  const [recoveryDismissed, setRecoveryDismissed] = useState(false);
  const [programDays, setProgramDays] = useState<WorkoutProgramDay[]>([]);
  const [selectedDate, setSelectedDate] = useState(getTodayDate);
  const [selectedDayId, setSelectedDayId] = useState('');
  const [draftExercises, setDraftExercises] = useState<DraftExercise[]>([]);
  const [energyLevel, setEnergyLevel] = useState<string | null>(null);
  const [isEnergyModalOpen, setIsEnergyModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [currentExerciseIndex, setCurrentExerciseIndex] = useState(0);
  const [timer, setTimer] = useState(0);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [exerciseNotes, setExerciseNotes] = useState<Record<string, string>>({});
  const [notesOpenFor, setNotesOpenFor] = useState<string | null>(null);
  const [instructionModal, setInstructionModal] = useState<string | null>(null);
  const [previousExerciseLookup, setPreviousExerciseLookup] = useState<PreviousExerciseLookup>(
    EMPTY_PREVIOUS_EXERCISE_LOOKUP
  );
  const [incompleteWarning, setIncompleteWarning] = useState<string[]>([]);
  const [showOverwriteConfirm, setShowOverwriteConfirm] = useState(false);
  const [showAddExerciseModal, setShowAddExerciseModal] = useState(false);
  const [addExerciseForm, setAddExerciseForm] = useState<AddExerciseForm>(emptyAddExerciseForm);
  const [addExerciseError, setAddExerciseError] = useState('');
  const [exerciseDurations, setExerciseDurations] = useState<Record<string, number>>({});
  const [reorderCount, setReorderCount] = useState(0);
  const exerciseStartTime = useRef<number | null>(null);
  const workoutStartedAt = useRef<string | null>(null);
  const dayPrefillRequestId = useRef(0);

  const loadPreviousExerciseLookup = async (
    workoutProgramDayId: string
  ): Promise<PreviousExerciseLookup> => {
    const normalizedWorkoutProgramDayId = String(workoutProgramDayId || '').trim();
    if (!normalizedWorkoutProgramDayId) {
      return EMPTY_PREVIOUS_EXERCISE_LOOKUP;
    }

    try {
      const previousSession = await fetchLatestWorkoutSessionForProgramDay(
        normalizedWorkoutProgramDayId
      );
      return buildPreviousExerciseLookup(previousSession);
    } catch {
      return EMPTY_PREVIOUS_EXERCISE_LOOKUP;
    }
  };

  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      setIsLoading(true);
      setError('');

      try {
        const draft = loadWorkoutDraft();
        const program = await fetchActiveWorkoutProgram();
        if (!isMounted) {
          return;
        }

        setProgramDays(program.days || []);

        if (draft) {
          // Restore full active session from draft — do NOT rebuild from program template
          setSelectedDate(draft.selectedDate);
          setSelectedDayId(draft.selectedDayId);
          setDraftExercises(draft.draftExercises);
          setCurrentExerciseIndex(Math.min(draft.currentExerciseIndex, Math.max(0, draft.draftExercises.length - 1)));
          setExerciseNotes(draft.exerciseNotes);
          setReorderCount(draft.reorderCount);
          setEnergyLevel(draft.energyLevel);
          setTimer(calculateElapsedSeconds(draft.startedAt));
          setIsTimerRunning(true);
          setPreviousExerciseLookup(EMPTY_PREVIOUS_EXERCISE_LOOKUP);
          workoutStartedAt.current = draft.startedAt;
          exerciseStartTime.current = Date.now();
        } else {
          // No active draft — start fresh from program template
          const firstDay = program.days?.[0] || null;
          const nextPreviousExerciseLookup = await loadPreviousExerciseLookup(firstDay?.id || '');
          if (!isMounted) {
            return;
          }

          setSelectedDate(getTodayDate());
          setSelectedDayId(firstDay?.id || '');
          setPreviousExerciseLookup(nextPreviousExerciseLookup);
          setDraftExercises(buildDraftExercises(firstDay, nextPreviousExerciseLookup));
          setCurrentExerciseIndex(0);
          setTimer(0);
          setIsTimerRunning(false);
        }
      } catch (loadError) {
        if (isMounted) {
          setError(loadError instanceof Error ? loadError.message : 'טעינת תוכנית האימון נכשלה.');
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

  const selectedDay = useMemo(
    () => programDays.find((day) => day.id === selectedDayId) || programDays[0] || null,
    [programDays, selectedDayId]
  );

  const handleSelectDay = async (day: WorkoutProgramDay) => {
    if (isTimerRunning) {
      return;
    }

    const nextDayId = day.id || '';
    const requestId = ++dayPrefillRequestId.current;
    setSelectedDayId(nextDayId);
    setMessage('');
    setError('');
    setCurrentExerciseIndex(0);

    const nextPreviousExerciseLookup = await loadPreviousExerciseLookup(nextDayId);
    if (dayPrefillRequestId.current !== requestId) {
      return;
    }

    setPreviousExerciseLookup(nextPreviousExerciseLookup);
    setDraftExercises(buildDraftExercises(day, nextPreviousExerciseLookup));
  };

  const handleResetWorkout = () => {
    if (selectedDay) {
      setDraftExercises(buildDraftExercises(selectedDay, previousExerciseLookup));
    }
    setCurrentExerciseIndex(0);
    setTimer(0);
    setIsTimerRunning(false);
    setExerciseDurations({});
    setReorderCount(0);
    exerciseStartTime.current = null;
    workoutStartedAt.current = null;
    clearWorkoutDraft();
    setMessage('');
    setError('');
  };

  const handleNextExercise = () => {
    if (currentExercise && exerciseStartTime.current !== null) {
      const elapsed = Math.round((Date.now() - exerciseStartTime.current) / 1000);
      setExerciseDurations((prev) => ({ ...prev, [currentExercise.exerciseName]: elapsed }));
      setDraftExercises((prev) =>
        prev.map((ex) =>
          ex.exerciseName === currentExercise.exerciseName
            ? { ...ex, durationSeconds: elapsed }
            : ex
        )
      );
    }
    setCurrentExerciseIndex((i) => i + 1);
    exerciseStartTime.current = Date.now();
  };

  const handleSelectExercise = (index: number) => {
    if (currentExercise && exerciseStartTime.current !== null) {
      const elapsed = Math.round((Date.now() - exerciseStartTime.current) / 1000);
      setExerciseDurations((prev) => ({ ...prev, [currentExercise.exerciseName]: elapsed }));
      setDraftExercises((prev) =>
        prev.map((ex) =>
          ex.exerciseName === currentExercise.exerciseName
            ? { ...ex, durationSeconds: elapsed }
            : ex
        )
      );
    }
    setReorderCount((prev) => prev + 1);
    setCurrentExerciseIndex(index);
    exerciseStartTime.current = Date.now();
  };

  const startTimer = (nextEnergyLevel: string | null = energyLevel) => {
    const startedAt = new Date().toISOString();
    setTimer(0);
    setIsTimerRunning(true);
    exerciseStartTime.current = Date.now();
    workoutStartedAt.current = startedAt;
    // Save full draft immediately so startedAt is captured even if user leaves right away
    saveWorkoutDraft({
      startedAt,
      selectedDate,
      selectedDayId,
      energyLevel: nextEnergyLevel,
      draftExercises,
      currentExerciseIndex,
      exerciseNotes,
      reorderCount,
    });
  };

  const formatExerciseTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return m > 0 ? `${m}:${String(s).padStart(2, '0')}` : `${s}״`;
  };

  const handleStartWorkoutClick = () => {
    if (isTimerRunning) {
      return;
    }

    setIsEnergyModalOpen(true);
  };

  const handleSelectEnergyLevel = (level: string) => {
    setEnergyLevel(level);
    setIsEnergyModalOpen(false);
    startTimer(level);
  };

  const updateSet = (exerciseIndex: number, setIndex: number, field: 'weight' | 'reps', value: string) => {
    setDraftExercises((current) =>
      current.map((exercise, currentExerciseIndex) => {
        if (currentExerciseIndex !== exerciseIndex) {
          return exercise;
        }

        const nextSets = exercise.sets.map((setItem, currentSetIndex) =>
          currentSetIndex === setIndex ? { ...setItem, [field]: value } : setItem
        );

        return {
          ...exercise,
          sets: nextSets,
          completed: nextSets.every((setItem) => Number(setItem.weight) > 0 && Number(setItem.reps) > 0),
        };
      })
    );
  };

  const updateDifficulty = (exerciseIndex: number, setIndex: number, difficulty: string) => {
    setDraftExercises((current) =>
      current.map((exercise, currentExerciseIndex) => {
        if (currentExerciseIndex !== exerciseIndex) {
          return exercise;
        }

        return {
          ...exercise,
          sets: exercise.sets.map((setItem, currentSetIndex) =>
            currentSetIndex === setIndex ? { ...setItem, difficulty } : setItem
          ),
        };
      })
    );
  };

  const addSet = (exerciseIndex: number) => {
    setDraftExercises((current) =>
      current.map((exercise, currentExerciseIndex) => {
        if (currentExerciseIndex !== exerciseIndex) {
          return exercise;
        }

        const lastSet = exercise.sets[exercise.sets.length - 1];
        const nextSet = lastSet
          ? { weight: lastSet.weight, reps: lastSet.reps, difficulty: lastSet.difficulty }
          : emptySet();

        return {
          ...exercise,
          sets: [...exercise.sets, nextSet],
          completed: false,
        };
      })
    );
  };

  const handleOpenAddExercise = () => {
    setAddExerciseForm(emptyAddExerciseForm());
    setAddExerciseError('');
    setShowAddExerciseModal(true);
  };

  const handleCloseAddExercise = () => {
    setShowAddExerciseModal(false);
    setAddExerciseError('');
  };

  const handleAddExercise = () => {
    const exerciseName = addExerciseForm.exerciseName.trim();
    if (!exerciseName) {
      setAddExerciseError('יש להזין שם תרגיל.');
      return;
    }

    const numericFields: Array<keyof Omit<AddExerciseForm, 'exerciseName'>> = [
      'plannedSets',
      'plannedReps',
      'plannedWeight',
    ];

    for (const field of numericFields) {
      const rawValue = addExerciseForm[field].trim();
      if (!rawValue) {
        continue;
      }

      const numericValue = Number(rawValue);
      if (!Number.isFinite(numericValue) || numericValue < 0) {
        setAddExerciseError('ערכים מספריים חייבים להיות אפס או יותר.');
        return;
      }
    }

    const nextExercise: DraftExercise = {
      exerciseId: '',
      exerciseName,
      plannedSets: addExerciseForm.plannedSets.trim(),
      plannedReps: addExerciseForm.plannedReps.trim(),
      plannedWeight: addExerciseForm.plannedWeight.trim(),
      completed: false,
      durationSeconds: 0,
      sets: [],
    };

    const nextExerciseIndex = draftExercises.length;
    setDraftExercises((current) => [...current, nextExercise]);
    setCurrentExerciseIndex(nextExerciseIndex);
    setNotesOpenFor(null);
    setInstructionModal(null);
    setMessage('');
    setError('');
    handleCloseAddExercise();
    exerciseStartTime.current = Date.now();
  };

  const doSave = async () => {
    if (!selectedDay) {
      setError('יש לבחור יום אימון.');
      return;
    }

    // Record duration for the last (current) exercise before saving
    let exercisesToSave = draftExercises;
    if (currentExercise && exerciseStartTime.current !== null) {
      const elapsed = Math.round((Date.now() - exerciseStartTime.current) / 1000);
      setExerciseDurations((prev) => ({ ...prev, [currentExercise.exerciseName]: elapsed }));
      exercisesToSave = draftExercises.map((ex) =>
        ex.exerciseName === currentExercise.exerciseName
          ? { ...ex, durationSeconds: elapsed }
          : ex
      );
      setDraftExercises(exercisesToSave);
      exerciseStartTime.current = null;
    }

    setIsSaving(true);
    setMessage('');
    setError('');

    try {
      const totalDurationSeconds = workoutStartedAt.current
        ? calculateElapsedSeconds(workoutStartedAt.current)
        : timer;

      await saveFullWorkoutSession({
        date: selectedDate,
        dayId: selectedDay.id || '',
        dayName: selectedDay.name || '',
        energyLevel: energyLevel ?? undefined,
        startedAt: workoutStartedAt.current || '',
        endedAt: new Date().toISOString(),
        durationSeconds: totalDurationSeconds,
        exercises: exercisesToSave,
      });

      const durationsToSave: Record<string, number> = {};
      for (const ex of exercisesToSave) {
        if (ex.durationSeconds) durationsToSave[ex.exerciseName] = ex.durationSeconds;
      }
      await updateExerciseDurations(selectedDate, selectedDay.id || '', durationsToSave);
      await updateReorderCount(selectedDate, selectedDay.id || '', reorderCount);
      setPreviousExerciseLookup(
        buildPreviousExerciseLookup({
          id: '',
          date: selectedDate,
          dayId: selectedDay.id || '',
          dayName: selectedDay.name || '',
          startedAt: workoutStartedAt.current || '',
          endedAt: new Date().toISOString(),
          durationSeconds: totalDurationSeconds,
          energyLevel: energyLevel || '',
          reorderCount,
          exercises: exercisesToSave.map((exercise, exerciseIndex) => ({
            rowId: `draft-${exerciseIndex}`,
            exerciseId: exercise.exerciseId,
            exerciseName: exercise.exerciseName,
            plannedSets: exercise.plannedSets,
            plannedReps: exercise.plannedReps,
            plannedWeight: exercise.plannedWeight,
            completed: exercise.completed,
            durationSeconds: exercise.durationSeconds ?? null,
            sets: exercise.sets.map((setItem, setIndex) => ({
              id: `draft-set-${exerciseIndex}-${setIndex}`,
              weight: setItem.weight,
              reps: setItem.reps,
              difficulty: setItem.difficulty,
            })),
          })),
        })
      );

      setIsTimerRunning(false);
      setTimer(totalDurationSeconds);
      workoutStartedAt.current = null;
      clearWorkoutDraft();
      setMessage('האימון נשמר.');
      setRecoveryDismissed(true);
    } catch (saveError) {
      console.error('SAVE ERROR:', saveError);
      const rawMessage =
        saveError instanceof Error
          ? saveError.message
          : (saveError as any)?.message || JSON.stringify(saveError) || 'שמירת האימון נכשלה.';

      if (rawMessage.includes('WORKOUT_SESSION_ALREADY_EXISTS')) {
        setShowOverwriteConfirm(true);
      } else {
        setError(rawMessage);
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleOverwrite = async () => {
    setShowOverwriteConfirm(false);
    if (!selectedDay) return;
    setIsSaving(true);
    setError('');
    try {
      await deleteWorkoutSession(selectedDate, selectedDay.id || '');
      await doSave();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'מחיקה נכשלה.');
      setIsSaving(false);
    }
  };

  const handleSave = () => {
    const incomplete = draftExercises
      .map((ex) => {
        const emptySets = ex.sets.filter(
          (s) => !s.weight || !s.reps || Number(s.weight) === 0 || Number(s.reps) === 0
        ).length;
        return emptySets > 0 ? `${ex.exerciseName} (${emptySets} סטים חסרים)` : null;
      })
      .filter((x): x is string => x !== null);

    if (incomplete.length > 0) {
      setIncompleteWarning(incomplete);
    } else {
      doSave();
    }
  };

  useEffect(() => {
    if (!isTimerRunning || !workoutStartedAt.current) {
      return undefined;
    }

    const syncTimer = () => {
      if (!workoutStartedAt.current) {
        return;
      }

      setTimer(calculateElapsedSeconds(workoutStartedAt.current));
    };

    syncTimer();
    const interval = setInterval(() => {
      syncTimer();
    }, 1000);

    return () => clearInterval(interval);
  }, [isTimerRunning]);

  useEffect(() => {
    if (!isTimerRunning || !workoutStartedAt.current) {
      return;
    }

    saveWorkoutDraft({
      startedAt: workoutStartedAt.current,
      selectedDate,
      selectedDayId,
      energyLevel,
      draftExercises,
      currentExerciseIndex,
      exerciseNotes,
      reorderCount,
    });
  }, [isTimerRunning, draftExercises, currentExerciseIndex, exerciseNotes, reorderCount, energyLevel, selectedDate, selectedDayId]);

  useEffect(() => {
    if (!isTimerRunning || !vibrationEnabled) return;
    const id = setInterval(() => {
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(200);
      }
    }, vibrationInterval * 1000);
    return () => clearInterval(id);
  }, [isTimerRunning, vibrationEnabled, vibrationInterval]);

  const currentExercise = draftExercises[currentExerciseIndex] || null;
  const completedExercisesCount = draftExercises.filter((exercise) => exercise.completed).length;
  const heroProgressValue = buildProgressValue(currentExerciseIndex, draftExercises.length);

  if (isLoading) {
    return <ProtectedPage><PageSpinner /></ProtectedPage>;
  }

  return (
    <ProtectedPage>
      <div style={{ display: 'grid', gap: 16 }}>
        <div
          style={{
            background: '#13233c',
            borderRadius: 24,
            padding: '24px 26px',
            display: 'grid',
            gap: 14,
            color: '#eef4ff',
            ...(recoveryType === 'workout' && !recoveryDismissed
              ? { outline: '2px solid var(--accent)', outlineOffset: 2 }
              : {}),
          }}
        >
          {recoveryType === 'workout' && !recoveryDismissed ? (
            <RecoveryBanner message="חסר תיעוד של אימון מהתקופה האחרונה. שמירת האימון הבא תשפר את דיוק המעקב." />
          ) : null}
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
            <Link
              href="/workout-history"
              style={{
                borderRadius: 999,
                padding: '10px 16px',
                background: 'rgba(255,255,255,0.08)',
                color: '#eef4ff',
                fontWeight: 700,
                textDecoration: 'none',
              }}
            >
              היסטוריה
            </Link>
            <button
              type="button"
              onClick={handleResetWorkout}
              style={{
                border: 0,
                borderRadius: 999,
                padding: '10px 16px',
                background: 'rgba(255,255,255,0.12)',
                color: '#eef4ff',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              איפוס
            </button>
          </div>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#88b1ff' }}>
            {selectedDay?.name || 'יום אימון'}
          </div>
          <div style={{ fontSize: 32, fontWeight: 800 }}>
            {currentExercise?.exerciseName || 'תרגיל לא נבחר'}
          </div>
          <div style={{ fontSize: 14, color: '#c7d5ea', lineHeight: 1.4 }}>
            {currentExercise?.exerciseName
              ? 'התמקד בתרגיל הנבחר, רשום את הסטים בפועל מתחת.'
              : 'בחר תרגיל כדי להתחיל רישום.'}
          </div>
          <div style={{ fontSize: 14, color: '#c7d5ea' }}>
            תרגיל {Math.min(currentExerciseIndex + 1, Math.max(draftExercises.length, 1))} מתוך{' '}
            {draftExercises.length || 1}
          </div>
          {energyLevel ? (
            <div style={{ fontSize: 12, color: '#9fb5e4' }}>
              רמת אנרגיה: {energyLabelMap[energyLevel] || energyLevel}
            </div>
          ) : null}
          <div style={{ fontSize: 12, color: '#89b4ff' }}>
            הושלמו {completedExercisesCount} מתוך {draftExercises.length || 0} תרגילים
          </div>
          <div
            style={{
              background: 'rgba(255,255,255,0.08)',
              borderRadius: 18,
              padding: '12px 16px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <div>
              <div style={{ fontSize: 12, textTransform: 'uppercase', color: '#9fb5e4' }}>זמן אימון</div>
              <div style={{ fontSize: 28, fontWeight: 700 }}>{formatTimer(timer)}</div>
              {vibrationEnabled ? (
                <div style={{ fontSize: 11, color: '#9fb5e4', marginTop: 2 }}>
                  רטט כל {vibrationInterval >= 60 ? `${vibrationInterval / 60} דקות` : `${vibrationInterval} שניות`}
                </div>
              ) : null}
            </div>
            <button
              type="button"
              onClick={handleStartWorkoutClick}
              style={{
                border: 0,
                borderRadius: 12,
                padding: '10px 18px',
                background: '#0f766e',
                color: '#ffffff',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              {isTimerRunning ? 'המשך אימון' : 'התחלתי אימון'}
            </button>
          </div>
        <div
          style={{
            height: 8,
            borderRadius: 999,
            overflow: 'hidden',
            background: 'rgba(255,255,255,0.2)',
          }}
        >
          <div
            style={{
              width: `${Math.min(heroProgressValue, 100)}%`,
              height: '100%',
              background: '#0f766e',
            }}
          />
        </div>
      </div>

        {error ? <div style={{ color: 'var(--danger)' }}>{error}</div> : null}
        {message ? <div style={{ color: 'var(--success)' }}>{message}</div> : null}

        {programDays.length === 0 ? (
          <div
            style={{
              background: 'var(--surface)',
              borderRadius: 20,
              padding: 20,
              color: 'var(--text-muted)',
            }}
          >
            לא נמצאה תוכנית אימון פעילה.
          </div>
        ) : (
          <>
            <div
              style={{
                background: 'var(--surface)',
                borderRadius: 20,
                padding: 20,
                display: 'grid',
                gap: 12,
              }}
            >
<div style={{ fontSize: 14, fontWeight: 700 }}>יום אימון</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {programDays.map((day) => {
                  const isActive = day.id === selectedDayId;
                  return (
                    <button
                      key={day.id || day.name}
                      type="button"
                      onClick={() => handleSelectDay(day)}
                      style={{
                        border: 0,
                        borderRadius: 999,
                        padding: '10px 14px',
                        background: isActive ? '#0f766e' : 'var(--surface-2)',
                        color: '#fff',
                        cursor: 'pointer',
                      }}
                    >
                      {day.name}
                    </button>
                  );
                })}
              </div>

              <div style={{ fontSize: 14, fontWeight: 700 }}>תרגילים</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {draftExercises.map((exercise, index) => {
                  const isActive = index === currentExerciseIndex;
                  const isCompleted = exercise.completed;
                  return (
                    <button
                      key={exercise.exerciseId || `${exercise.exerciseName}-${index}`}
                      type="button"
                      onClick={() => handleSelectExercise(index)}
                      style={{
                        border: 0,
                        borderRadius: 999,
                        padding: '10px 14px',
                        background: isActive ? '#13233c' : isCompleted ? '#0f766e' : 'var(--surface-2)',
                        color: '#fff',
                        cursor: 'pointer',
                        opacity: isCompleted ? 0.6 : 1,
                      }}
                    >
                      {exercise.exerciseName}
                    </button>
                  );
                })}
                {isTimerRunning ? (
                  <button
                    type="button"
                    onClick={handleOpenAddExercise}
                    style={{
                      border: '1px dashed var(--border)',
                      borderRadius: 999,
                      padding: '10px 14px',
                      background: 'transparent',
                      color: 'var(--text)',
                      cursor: 'pointer',
                      fontWeight: 700,
                    }}
                  >
                    הוסף תרגיל
                  </button>
                ) : null}
              </div>

            </div>

            {currentExercise ? (
              <div
                style={{
                  background: 'var(--surface)',
                  borderRadius: 20,
                  padding: 20,
                  display: 'grid',
                  gap: 12,
                }}
              >
                <div style={{ display: 'grid', gap: 4 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ fontSize: 20, fontWeight: 800, flex: 1 }}>{currentExercise.exerciseName}</div>
                    <button
                      type="button"
                      onClick={() => setInstructionModal(currentExercise.exerciseName)}
                      style={{
                        border: '1px solid var(--border)',
                        borderRadius: 10,
                        background: 'transparent',
                        color: 'var(--text-muted)',
                        padding: '4px 10px',
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      ℹ️ כיצד לבצע
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setNotesOpenFor(
                          notesOpenFor === currentExercise.exerciseName ? null : currentExercise.exerciseName
                        )
                      }
                      style={{
                        border: '1px solid var(--border)',
                        borderRadius: 10,
                        background: notesOpenFor === currentExercise.exerciseName ? 'var(--surface-2)' : 'transparent',
                        color: 'var(--text-muted)',
                        padding: '4px 10px',
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      📝 הערות
                    </button>
                  </div>
                  <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>
                    יעד: {currentExercise.plannedSets || '-'} סטים | {currentExercise.plannedReps || '-'} חזרות |{' '}
                    {currentExercise.plannedWeight || '-'} משקל
                  </div>
                  {notesOpenFor === currentExercise.exerciseName && (
                    <textarea
                      autoFocus
                      placeholder="כתוב הערה על התרגיל..."
                      value={exerciseNotes[currentExercise.exerciseName] || ''}
                      onChange={(e) =>
                        setExerciseNotes((prev) => ({
                          ...prev,
                          [currentExercise.exerciseName]: e.target.value,
                        }))
                      }
                      rows={3}
                      style={{
                        marginTop: 6,
                        width: '100%',
                        borderRadius: 12,
                        border: '1px solid var(--border)',
                        background: 'var(--surface-2)',
                        color: 'var(--text)',
                        padding: 12,
                        fontSize: 14,
                        resize: 'vertical',
                        lineHeight: 1.5,
                      }}
                    />
                  )}
                </div>

                {currentExercise.sets.map((setItem, setIndex) => (
                  <div
                    key={`${currentExercise.exerciseName}-${setIndex}`}
                    style={{
                      background: 'var(--surface-2)',
                      borderRadius: 16,
                      padding: 14,
                      display: 'grid',
                      gap: 10,
                    }}
                  >
                    <div style={{ fontWeight: 700 }}>סט {setIndex + 1}</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                      <input
                        type="number"
                        inputMode="decimal"
                        placeholder="משקל"
                        value={setItem.weight}
                        onChange={(event) => updateSet(currentExerciseIndex, setIndex, 'weight', event.target.value)}
                        style={{
                          width: '100%',
                          borderRadius: 14,
                          border: '1px solid var(--border)',
                          background: '#121212',
                          color: 'var(--text)',
                          padding: 12,
                        }}
                      />
                      <input
                        type="number"
                        inputMode="numeric"
                        placeholder="חזרות"
                        value={setItem.reps}
                        onChange={(event) => updateSet(currentExerciseIndex, setIndex, 'reps', event.target.value)}
                        style={{
                          width: '100%',
                          borderRadius: 14,
                          border: '1px solid var(--border)',
                          background: '#121212',
                          color: 'var(--text)',
                          padding: 12,
                        }}
                      />
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {[
                        ['easy', 'קל'],
                        ['good', 'טוב'],
                        ['hard', 'קשה'],
                        ['failure', 'כשל'],
                      ].map(([value, label]) => {
                        const isActive = setItem.difficulty === value;
                        return (
                          <button
                            key={`${currentExercise.exerciseName}-${setIndex}-${value}`}
                            type="button"
                            onClick={() => updateDifficulty(currentExerciseIndex, setIndex, value)}
                            style={{
                              border: 0,
                              borderRadius: 999,
                              padding: '10px 14px',
                              background: isActive ? 'var(--accent)' : '#121212',
                              color: '#fff',
                              cursor: 'pointer',
                            }}
                          >
                            {label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => addSet(currentExerciseIndex)}
                  style={{
                    border: '1px dashed var(--border)',
                    borderRadius: 14,
                    background: 'transparent',
                    color: 'var(--text)',
                    padding: '12px 14px',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  הוסף סט
                </button>
              </div>
            ) : (
              <div
                style={{
                  background: 'var(--surface)',
                  borderRadius: 20,
                  padding: 20,
                  color: 'var(--text-muted)',
                }}
              >
                בחר תרגיל כדי להתחיל רישום סטים.
              </div>
            )}

            <div style={{ display: 'grid', gap: 10 }}>
              {currentExerciseIndex < draftExercises.length - 1 && (
                <button
                  type="button"
                  onClick={handleNextExercise}
                  style={{
                    border: '2px solid var(--accent)',
                    borderRadius: 18,
                    background: 'transparent',
                    color: 'var(--accent)',
                    padding: '16px 18px',
                    fontWeight: 800,
                    cursor: 'pointer',
                  }}
                >
                  לתרגיל הבא ›
                </button>
              )}
              <button
                type="button"
                onClick={handleSave}
                disabled={isSaving || !selectedDay}
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
                {isSaving ? 'שומר...' : 'שמור אימון'}
              </button>
            </div>
          </>
        )}

        <Link href="/home" style={{ color: 'var(--text-muted)', textAlign: 'center' }}>
          חזרה לבית
        </Link>
      </div>
      {isEnergyModalOpen ? (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(4,8,14,0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
            zIndex: 40,
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: 360,
              background: 'var(--surface)',
              borderRadius: 24,
              padding: 24,
              display: 'grid',
              gap: 16,
            }}
          >
            <div style={{ fontSize: 20, fontWeight: 800, textAlign: 'right' }}>בחר רמת אנרגיה</div>
            {energyLevels.map((level) => (
              <button
                key={level.value}
                type="button"
                onClick={() => handleSelectEnergyLevel(level.value)}
                style={{
                  border: '1px solid var(--border)',
                  borderRadius: 16,
                  padding: '14px 16px',
                  background: '#121212',
                  color: '#fff',
                  fontSize: 16,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                {level.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setIsEnergyModalOpen(false)}
              style={{
                border: '1px solid var(--border)',
                borderRadius: 16,
                padding: '14px 16px',
                background: 'var(--surface-2)',
                color: 'var(--text)',
                fontSize: 16,
                cursor: 'pointer',
              }}
            >
              ביטול
            </button>
          </div>
        </div>
      ) : null}
      {showAddExerciseModal ? (
        <div
          onClick={handleCloseAddExercise}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(4,8,14,0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
            zIndex: 60,
          }}
        >
          <div
            onClick={(event) => event.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: 420,
              background: 'var(--surface)',
              borderRadius: 24,
              padding: 24,
              display: 'grid',
              gap: 14,
            }}
          >
            <div style={{ fontSize: 20, fontWeight: 800 }}>הוסף תרגיל</div>
            <input
              autoFocus
              type="text"
              placeholder="שם התרגיל"
              value={addExerciseForm.exerciseName}
              onChange={(event) =>
                setAddExerciseForm((current) => ({ ...current, exerciseName: event.target.value }))
              }
              style={{
                width: '100%',
                borderRadius: 14,
                border: '1px solid var(--border)',
                background: '#121212',
                color: 'var(--text)',
                padding: 12,
              }}
            />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
              <input
                type="number"
                min="0"
                inputMode="numeric"
                placeholder="סטים"
                value={addExerciseForm.plannedSets}
                onChange={(event) =>
                  setAddExerciseForm((current) => ({ ...current, plannedSets: event.target.value }))
                }
                style={{
                  width: '100%',
                  borderRadius: 14,
                  border: '1px solid var(--border)',
                  background: '#121212',
                  color: 'var(--text)',
                  padding: 12,
                }}
              />
              <input
                type="number"
                min="0"
                inputMode="numeric"
                placeholder="חזרות"
                value={addExerciseForm.plannedReps}
                onChange={(event) =>
                  setAddExerciseForm((current) => ({ ...current, plannedReps: event.target.value }))
                }
                style={{
                  width: '100%',
                  borderRadius: 14,
                  border: '1px solid var(--border)',
                  background: '#121212',
                  color: 'var(--text)',
                  padding: 12,
                }}
              />
              <input
                type="number"
                min="0"
                inputMode="decimal"
                placeholder="משקל"
                value={addExerciseForm.plannedWeight}
                onChange={(event) =>
                  setAddExerciseForm((current) => ({ ...current, plannedWeight: event.target.value }))
                }
                style={{
                  width: '100%',
                  borderRadius: 14,
                  border: '1px solid var(--border)',
                  background: '#121212',
                  color: 'var(--text)',
                  padding: 12,
                }}
              />
            </div>
            {addExerciseError ? (
              <div style={{ color: 'var(--danger)', fontSize: 14 }}>{addExerciseError}</div>
            ) : null}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <button
                type="button"
                onClick={handleCloseAddExercise}
                style={{
                  border: '1px solid var(--border)',
                  borderRadius: 16,
                  padding: '14px 16px',
                  background: 'var(--surface-2)',
                  color: 'var(--text)',
                  fontSize: 16,
                  cursor: 'pointer',
                }}
              >
                ביטול
              </button>
              <button
                type="button"
                onClick={handleAddExercise}
                style={{
                  border: 0,
                  borderRadius: 16,
                  padding: '14px 16px',
                  background: 'var(--accent)',
                  color: '#fff',
                  fontSize: 16,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                הוסף
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {showOverwriteConfirm && (
        <div
          onClick={() => setShowOverwriteConfirm(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.7)',
            zIndex: 100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'var(--surface)',
              borderRadius: 24,
              padding: 24,
              width: '100%',
              maxWidth: 380,
              display: 'grid',
              gap: 16,
            }}
          >
            <div style={{ fontSize: 18, fontWeight: 800 }}>אימון קיים</div>
            <div style={{ color: 'var(--text-muted)', fontSize: 14, lineHeight: 1.6 }}>
              כבר קיים אימון שמור ליום זה. האם לדרוס אותו עם האימון הנוכחי?
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <button
                type="button"
                onClick={() => setShowOverwriteConfirm(false)}
                style={{
                  border: '1px solid var(--border)',
                  borderRadius: 14,
                  background: 'transparent',
                  color: 'var(--text)',
                  padding: '12px 0',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                ביטול
              </button>
              <button
                type="button"
                onClick={handleOverwrite}
                style={{
                  border: 0,
                  borderRadius: 14,
                  background: 'var(--danger)',
                  color: '#fff',
                  padding: '12px 0',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                כן, דרוס
              </button>
            </div>
          </div>
        </div>
      )}
      {incompleteWarning.length > 0 && (
        <div
          onClick={() => setIncompleteWarning([])}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.7)',
            zIndex: 100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'var(--surface)',
              borderRadius: 24,
              padding: 24,
              width: '100%',
              maxWidth: 400,
              display: 'grid',
              gap: 16,
            }}
          >
            <div style={{ fontSize: 18, fontWeight: 800 }}>שים לב — סטים חסרים</div>
            <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>
              התרגילים הבאים מכילים סטים ללא משקל או חזרות:
            </div>
            <ul style={{ margin: 0, padding: '0 18px', display: 'grid', gap: 6 }}>
              {incompleteWarning.map((line) => (
                <li key={line} style={{ fontSize: 14, color: 'var(--danger)' }}>{line}</li>
              ))}
            </ul>
            <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>
              סטים ריקים לא יישמרו. האם להמשיך בכל זאת?
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <button
                type="button"
                onClick={() => setIncompleteWarning([])}
                style={{
                  border: '1px solid var(--border)',
                  borderRadius: 14,
                  background: 'transparent',
                  color: 'var(--text)',
                  padding: '12px 0',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                חזור לתיקון
              </button>
              <button
                type="button"
                onClick={() => { setIncompleteWarning([]); doSave(); }}
                style={{
                  border: 0,
                  borderRadius: 14,
                  background: 'var(--accent)',
                  color: '#fff',
                  padding: '12px 0',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                שמור בכל זאת
              </button>
            </div>
          </div>
        </div>
      )}
      {instructionModal && (() => {
        const instruction = getExerciseInstruction(instructionModal);
        return (
          <div
            onClick={() => setInstructionModal(null)}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0,0,0,0.7)',
              zIndex: 100,
              display: 'flex',
              alignItems: 'flex-end',
              justifyContent: 'center',
              padding: 16,
            }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                background: 'var(--surface)',
                borderRadius: 24,
                padding: 24,
                width: '100%',
                maxWidth: 480,
                display: 'grid',
                gap: 16,
                maxHeight: '85vh',
                overflowY: 'auto',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: 18, fontWeight: 800 }}>{instructionModal}</div>
                <button
                  type="button"
                  onClick={() => setInstructionModal(null)}
                  style={{
                    border: 0,
                    background: 'var(--surface-2)',
                    color: 'var(--text)',
                    borderRadius: 999,
                    width: 32,
                    height: 32,
                    fontSize: 18,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  ✕
                </button>
              </div>

              {instruction ? (
                <>
                  {instruction.image && (
                    <img
                      src={instruction.image}
                      alt={instructionModal}
                      style={{
                        width: '100%',
                        borderRadius: 16,
                        objectFit: 'cover',
                        maxHeight: 220,
                        background: 'var(--surface-2)',
                      }}
                    />
                  )}
                  <div
                    style={{
                      background: 'var(--surface-2)',
                      borderRadius: 16,
                      padding: 16,
                      lineHeight: 1.7,
                      fontSize: 15,
                      color: 'var(--text)',
                    }}
                  >
                    {instruction.tips}
                  </div>
                </>
              ) : (
                <div style={{ color: 'var(--text-muted)', fontSize: 14, textAlign: 'center', padding: '12px 0' }}>
                  אין עדיין הוראות לתרגיל זה.
                  <br />
                  ניתן להוסיף ב־<code>exerciseInstructions.ts</code>
                </div>
              )}
            </div>
          </div>
        );
      })()}
    </ProtectedPage>
  );
}

export default function WorkoutPage() {
  return (
    <Suspense fallback={<PageSpinner />}>
      <WorkoutPageContent />
    </Suspense>
  );
}
