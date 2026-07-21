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
  verifyWorkoutSessionPersisted,
  fetchLatestWorkoutSessionForProgramDay,
  fetchSavedWorkoutSessions,
  updateExerciseDurations,
  updateExerciseNotes,
  updateReorderCount,
  type SavedWorkoutSession,
} from '@/lib/repositories/workoutSessionRepository';
import { ExerciseHistoryModal } from '@/components/ExerciseHistoryModal';
import { getExerciseInstruction } from '@/lib/exerciseInstructions';
import { useVibrationSettings } from '@/lib/vibrationSettings';
import {
  loadWorkoutDraft,
  saveWorkoutDraft,
  clearWorkoutDraft,
} from '@/lib/workoutDraftStorage';
import { getIsraelDateKey } from '@/lib/date/getIsraelDateKey';
import {
  runWorkoutSave,
  createClientWorkoutId,
  WORKOUT_SAVE_FAILED_MESSAGE,
  type WorkoutSaveInput,
  type WorkoutSaveDeps,
} from '@/lib/workout/workoutSaveService';
import { fetchActiveProgramRecord } from '@/lib/repositories/programRepository';
import { webSupabase } from '@/lib/supabase/browser';
import { webEnv } from '@/lib/env';
import { registerWorkoutDraftDiagnostics } from '@/lib/workout/workoutDraftDiagnostics';

const emptySet = () => ({ weight: '', reps: '', difficulty: 'good' });
// The workout date must bucket by Israel time (Asia/Jerusalem), consistent with
// the rest of the app (Home/history "today" all use getIsraelDateKey). Using UTC
// here previously mis-filed early-morning Israel workouts under the previous
// calendar day, making them look "missing" from that day's history.
const getTodayDate = () => getIsraelDateKey();

// Number of set rows to generate for a NEW workout. When the plan explicitly
// configures a set count we ALWAYS respect it, so changing the plan from 6 to 4
// sets never leaves stale Set 5/6 rows. Previous-session sets only prefill the
// values of the first N rows (see buildDraftExercises) — they must not expand
// the row count beyond what the plan asks for. Only when the plan has no explicit
// count do we fall back to the previous session's structure (or a single set).
const resolvePlannedSetCount = (plannedSetsValue: string, previousSetsCount: number) => {
  const trimmed = String(plannedSetsValue || '').trim();
  if (/^\d+$/.test(trimmed)) {
    return Math.max(1, Number(trimmed));
  }
  return Math.max(1, previousSetsCount);
};

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
  difficulty: string;
};

type PreviousExerciseLookup = {
  byExerciseId: Record<string, PreviousWorkoutSet[]>;
  byExerciseName: Record<string, PreviousWorkoutSet[]>;
  notesByExerciseId: Record<string, string>;
  notesByExerciseName: Record<string, string>;
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
  notesByExerciseId: {},
  notesByExerciseName: {},
};

const normalizeExerciseMatchKey = (value: string) => String(value || '').trim().toLocaleLowerCase();
const getWorkoutDaySelectionKey = (day: Pick<WorkoutProgramDay, 'id' | 'name'> | null | undefined) =>
  String(day?.id || '').trim() || `name:${String(day?.name || '').trim()}`;

const buildPreviousExerciseLookup = (
  session: SavedWorkoutSession | null
): PreviousExerciseLookup => {
  if (!session) {
    return EMPTY_PREVIOUS_EXERCISE_LOOKUP;
  }

  const byExerciseId: Record<string, PreviousWorkoutSet[]> = {};
  const byExerciseName: Record<string, PreviousWorkoutSet[]> = {};
  const notesByExerciseId: Record<string, string> = {};
  const notesByExerciseName: Record<string, string> = {};

  for (const exercise of session.exercises) {
    const previousSets = exercise.sets.map((setItem) => ({
      weight: setItem.weight,
      reps: setItem.reps,
      difficulty: setItem.difficulty || 'good',
    }));

    const exerciseMatchKey = normalizeExerciseMatchKey(exercise.exerciseName);
    const note = String(exercise.notes || '').trim();
    if (note) {
      if (exercise.exerciseId) {
        notesByExerciseId[exercise.exerciseId] = note;
      }
      if (exerciseMatchKey) {
        notesByExerciseName[exerciseMatchKey] = note;
      }
    }

    if (previousSets.length === 0) {
      continue;
    }

    if (exercise.exerciseId) {
      byExerciseId[exercise.exerciseId] = previousSets;
    }

    if (exerciseMatchKey) {
      byExerciseName[exerciseMatchKey] = previousSets;
    }
  }

  return { byExerciseId, byExerciseName, notesByExerciseId, notesByExerciseName };
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
      const setCount = resolvePlannedSetCount(row.sets, previousSets.length);

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
            ? {
                weight: previousSet.weight,
                reps: previousSet.reps,
                difficulty: previousSet.difficulty || 'good',
              }
            : emptySet();
        }),
      };
    });

const getPreviousNoteForExercise = (
  row: WorkoutProgramDay['rows'][number],
  previousExerciseLookup: PreviousExerciseLookup
): string => {
  if (row.id && previousExerciseLookup.notesByExerciseId[row.id]) {
    return previousExerciseLookup.notesByExerciseId[row.id];
  }

  const exerciseMatchKey = normalizeExerciseMatchKey(row.exercise);
  return previousExerciseLookup.notesByExerciseName[exerciseMatchKey] || '';
};

// Rebuild the per-exercise notes map (keyed by exercise name, matching the
// notes state / the DB exercise_name) from the most recent saved session, so
// notes are restored when the workout screen is reopened.
const buildExerciseNotes = (
  day: WorkoutProgramDay | null,
  previousExerciseLookup: PreviousExerciseLookup = EMPTY_PREVIOUS_EXERCISE_LOOKUP
): Record<string, string> => {
  const notes: Record<string, string> = {};
  for (const row of day?.rows || []) {
    if (!row.exercise) {
      continue;
    }
    const note = getPreviousNoteForExercise(row, previousExerciseLookup);
    if (note) {
      notes[row.exercise] = note;
    }
  }
  return notes;
};

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
  const [historyModalFor, setHistoryModalFor] = useState<string | null>(null);
  const [historySessions, setHistorySessions] = useState<SavedWorkoutSession[] | null>(null);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
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
  // Stable idempotency key for the current workout. Reused across save retries
  // so a retry after a lost-response commit does not create a duplicate.
  const clientWorkoutId = useRef<string>('');
  // Single-flight guard: prevents a double-tap on Finish (or the confirm
  // dialogs) from launching two concurrent save requests. Uses a ref because
  // React state updates are async and cannot block a synchronous re-entry.
  const saveInFlight = useRef(false);

  const loadPreviousExerciseLookup = async (
    workoutProgramDayId: string,
    workoutDayName: string
  ): Promise<PreviousExerciseLookup> => {
    const normalizedWorkoutProgramDayId = String(workoutProgramDayId || '').trim();
    const normalizedWorkoutDayName = String(workoutDayName || '').trim();

    if (!normalizedWorkoutProgramDayId && !normalizedWorkoutDayName) {
      return EMPTY_PREVIOUS_EXERCISE_LOOKUP;
    }

    try {
      const previousSession = await fetchLatestWorkoutSessionForProgramDay(
        normalizedWorkoutProgramDayId,
        normalizedWorkoutDayName
      );
      return buildPreviousExerciseLookup(previousSession);
    } catch {
      return EMPTY_PREVIOUS_EXERCISE_LOOKUP;
    }
  };

  // Dev-only, non-destructive draft recovery helpers on window.
  useEffect(() => {
    registerWorkoutDraftDiagnostics();
  }, []);

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
          // Reuse the draft's idempotency key; older drafts predate the field,
          // so mint one now (the autosave effect will persist it).
          clientWorkoutId.current = draft.clientWorkoutId || createClientWorkoutId();
        } else {
          // No active draft — start fresh from program template
          const firstDay = program.days?.[0] || null;
          const nextPreviousExerciseLookup = await loadPreviousExerciseLookup(
            firstDay?.id || '',
            firstDay?.name || ''
          );
          if (!isMounted) {
            return;
          }

          setSelectedDate(getTodayDate());
          setSelectedDayId(getWorkoutDaySelectionKey(firstDay));
          setPreviousExerciseLookup(nextPreviousExerciseLookup);
          setDraftExercises(buildDraftExercises(firstDay, nextPreviousExerciseLookup));
          setExerciseNotes(buildExerciseNotes(firstDay, nextPreviousExerciseLookup));
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
    () =>
      programDays.find((day) => getWorkoutDaySelectionKey(day) === selectedDayId) ||
      programDays[0] ||
      null,
    [programDays, selectedDayId]
  );

  const handleSelectDay = async (day: WorkoutProgramDay) => {
    if (isTimerRunning) {
      return;
    }

    const nextDayId = getWorkoutDaySelectionKey(day);
    const requestId = ++dayPrefillRequestId.current;
    setSelectedDayId(nextDayId);
    setMessage('');
    setError('');
    setCurrentExerciseIndex(0);

    const nextPreviousExerciseLookup = await loadPreviousExerciseLookup(
      day.id || '',
      day.name || ''
    );
    if (dayPrefillRequestId.current !== requestId) {
      return;
    }

    setPreviousExerciseLookup(nextPreviousExerciseLookup);
    setDraftExercises(buildDraftExercises(day, nextPreviousExerciseLookup));
    setExerciseNotes(buildExerciseNotes(day, nextPreviousExerciseLookup));
  };

  const handleResetWorkout = () => {
    if (selectedDay) {
      setDraftExercises(buildDraftExercises(selectedDay, previousExerciseLookup));
      setExerciseNotes(buildExerciseNotes(selectedDay, previousExerciseLookup));
    } else {
      setExerciseNotes({});
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
    // Mint a fresh idempotency key for this workout run.
    clientWorkoutId.current = createClientWorkoutId();
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
      clientWorkoutId: clientWorkoutId.current,
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

  const handleOpenHistory = async (exerciseName: string) => {
    setHistoryModalFor(exerciseName);

    // Lazily fetch the full workout history once, then reuse it for every
    // exercise's history modal during this session.
    if (historySessions !== null || isHistoryLoading) {
      return;
    }

    setIsHistoryLoading(true);
    try {
      const sessions = await fetchSavedWorkoutSessions();
      setHistorySessions(sessions);
    } catch {
      setHistorySessions([]);
    } finally {
      setIsHistoryLoading(false);
    }
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

  // Wire the pure save orchestrator to the real repository + Supabase calls.
  // The orchestrator owns the data-loss-safe ordering (draft is cleared only
  // after the session is confirmed persisted; secondary metadata is best-effort;
  // failures keep the draft and return a retryable error).
  const buildSaveDeps = (): WorkoutSaveDeps => ({
    saveSession: (inp) =>
      saveFullWorkoutSession(
        {
          date: inp.date,
          dayId: inp.dayId,
          dayName: inp.dayName,
          energyLevel: inp.energyLevel ?? undefined,
          startedAt: inp.startedAt,
          endedAt: inp.endedAt,
          durationSeconds: inp.durationSeconds,
          exercises: inp.exercises,
        },
        { clientWorkoutId: inp.clientWorkoutId, overwrite: inp.overwrite }
      ),
    // Read-after-write: the save is only reported successful once this confirms
    // a row exists for the current user. Prevents the false-success regression.
    verifySaved: (inp, sessionId) =>
      verifyWorkoutSessionPersisted({
        sessionId,
        date: inp.date,
        dayId: inp.dayId,
        dayName: inp.dayName,
      }),
    supabaseHost: (() => {
      try {
        return new URL(webEnv.supabaseUrl).host;
      } catch {
        return webEnv.supabaseUrl || '';
      }
    })(),
    updateDurations: (inp, durations) =>
      updateExerciseDurations(inp.date, inp.dayId, inp.dayName, durations),
    updateNotes: (inp) => updateExerciseNotes(inp.date, inp.dayId, inp.dayName, inp.exerciseNotes),
    updateReorder: (inp) => updateReorderCount(inp.date, inp.dayId, inp.dayName, inp.reorderCount),
    clearDraft: () => clearWorkoutDraft(),
    getUserId: async () => {
      const { data } = await webSupabase.auth.getUser();
      return data.user?.id ?? null;
    },
    log: (event, detail) => {
      // Structured diagnostics — never includes tokens/credentials.
      console.info(`[workout-save] ${event}`, detail);
    },
  });

  const performSave = async (overwrite: boolean) => {
    if (!selectedDay) {
      setError('יש לבחור יום אימון.');
      return;
    }

    // Single-flight guard — a double-tap cannot launch two saves.
    if (saveInFlight.current) {
      return;
    }
    saveInFlight.current = true;

    // Ensure an idempotency key exists (covers legacy drafts / edge starts).
    if (!clientWorkoutId.current) {
      clientWorkoutId.current = createClientWorkoutId();
    }

    // Record duration for the last (current) exercise before saving.
    let exercisesToSave = draftExercises;
    if (currentExercise && exerciseStartTime.current !== null) {
      const elapsed = Math.round((Date.now() - exerciseStartTime.current) / 1000);
      setExerciseDurations((prev) => ({ ...prev, [currentExercise.exerciseName]: elapsed }));
      exercisesToSave = draftExercises.map((ex) =>
        ex.exerciseName === currentExercise.exerciseName ? { ...ex, durationSeconds: elapsed } : ex
      );
      setDraftExercises(exercisesToSave);
      exerciseStartTime.current = null;
    }

    setIsSaving(true);
    setMessage('');
    setError('');

    const endedAt = new Date().toISOString();
    const totalDurationSeconds = workoutStartedAt.current
      ? calculateElapsedSeconds(workoutStartedAt.current)
      : timer;

    let programId: string | null = null;
    try {
      programId = (await fetchActiveProgramRecord())?.id ?? null;
    } catch {
      programId = null;
    }

    const input: WorkoutSaveInput = {
      clientWorkoutId: clientWorkoutId.current,
      overwrite,
      date: selectedDate,
      dayId: selectedDay.id || '',
      dayName: selectedDay.name || '',
      programId,
      energyLevel,
      startedAt: workoutStartedAt.current || '',
      endedAt,
      durationSeconds: totalDurationSeconds,
      reorderCount,
      exerciseNotes,
      exercises: exercisesToSave,
    };

    try {
      const result = await runWorkoutSave(buildSaveDeps(), input);

      if (result.status === 'saved') {
        // Refresh the same-day prefill lookup from what we just saved.
        setPreviousExerciseLookup(
          buildPreviousExerciseLookup({
            id: result.sessionId || '',
            date: selectedDate,
            dayId: selectedDay.id || '',
            dayName: selectedDay.name || '',
            startedAt: workoutStartedAt.current || '',
            endedAt,
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
              notes: exerciseNotes[exercise.exerciseName] || '',
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
        // Release the idempotency key so the next workout mints a fresh one.
        clientWorkoutId.current = '';
        setMessage('האימון נשמר.');
        setRecoveryDismissed(true);
      } else if (result.status === 'exists') {
        // Same-day workout already saved — ask before overwriting.
        setShowOverwriteConfirm(true);
      } else {
        // Failed: the local draft is intentionally preserved for retry.
        console.error('SAVE ERROR:', result.stage, result.error);
        setError(result.userMessage || WORKOUT_SAVE_FAILED_MESSAGE);
      }
    } finally {
      setIsSaving(false);
      saveInFlight.current = false;
    }
  };

  const doSave = () => performSave(false);

  const handleOverwrite = () => {
    setShowOverwriteConfirm(false);
    // Atomic overwrite: the RPC deletes the existing same-day session and
    // inserts the replacement in one transaction (best-effort delete-then-save
    // on older DBs without the atomic RPC). The idempotency key is retained so
    // a retry is deduped.
    performSave(true);
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
      clientWorkoutId: clientWorkoutId.current || undefined,
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
      <div style={{ display: 'grid', gap: 16, paddingTop: 'var(--safe-area-top)' }}>
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
                    const isActive = getWorkoutDaySelectionKey(day) === selectedDayId;
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
                      onClick={() => handleOpenHistory(currentExercise.exerciseName)}
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
                      📊 היסטוריה
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
              zIndex: 1000,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 16,
            }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                background: 'var(--surface)',
                borderRadius: 24,
                padding: 20,
                width: '100%',
                maxWidth: 420,
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
      {historyModalFor ? (
        <ExerciseHistoryModal
          exerciseName={historyModalFor}
          sessions={historySessions || []}
          isLoading={isHistoryLoading}
          onClose={() => setHistoryModalFor(null)}
        />
      ) : null}
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
