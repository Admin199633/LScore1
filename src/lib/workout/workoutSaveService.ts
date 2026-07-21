// Pure, framework-free orchestration for persisting a completed workout.
//
// This module intentionally imports NOTHING from React or Supabase so the full
// save decision tree can be unit-tested deterministically with injected fakes
// (see src/lib/workout/__tests__/workoutSaveService.test.ts).
//
// The design goal is data-loss prevention:
//   - the local draft is only cleared once the SESSION (with its exercises and
//     sets) is confirmed persisted;
//   - a failed save keeps the draft and returns a retryable error;
//   - retrying reuses the same idempotency key so the DB can dedupe;
//   - secondary metadata (per-exercise durations, notes, reorder count) is
//     best-effort: it never blocks or reverts a confirmed session save, but its
//     failures are surfaced as soft warnings for diagnostics.

export const WORKOUT_SESSION_ALREADY_EXISTS = 'WORKOUT_SESSION_ALREADY_EXISTS';

// User-facing Hebrew message shown when a save fails. The wording explicitly
// reassures the user their data is safe on the device and the action is
// retryable, per product requirement.
export const WORKOUT_SAVE_FAILED_MESSAGE =
  'שמירת האימון נכשלה. הנתונים נשמרו במכשיר ולא אבדו. בדוק את החיבור ונסה שוב.';

export type WorkoutSaveStage = 'session' | 'durations' | 'notes' | 'reorder';

export type WorkoutSaveInput = {
  clientWorkoutId: string;
  overwrite: boolean;
  date: string;
  dayId: string;
  dayName: string;
  programId: string | null;
  energyLevel: string | null;
  startedAt: string;
  endedAt: string;
  durationSeconds: number;
  reorderCount: number;
  exerciseNotes: Record<string, string>;
  exercises: Array<{
    exerciseId: string;
    exerciseName: string;
    plannedSets: string;
    plannedReps: string;
    plannedWeight: string;
    completed: boolean;
    durationSeconds?: number;
    sets: Array<{ weight: string; reps: string; difficulty: string }>;
  }>;
};

export type WorkoutSaveResult =
  | { status: 'saved'; sessionId: string | null; alreadyExisted: boolean; softErrors: WorkoutSaveSoftError[] }
  | { status: 'exists' }
  | { status: 'failed'; stage: WorkoutSaveStage; userMessage: string; error: unknown };

export type WorkoutSaveSoftError = { stage: Exclude<WorkoutSaveStage, 'session'>; error: unknown };

export type WorkoutSaveDiagnostics = {
  saveAttemptId: string;
  clientWorkoutId: string;
  userId: string | null;
  programId: string | null;
  dayId: string;
  dayName: string;
  overwrite: boolean;
  exerciseCount: number;
  totalSetCount: number;
  startedAt: string;
  endedAt: string;
  durationSeconds: number;
};

export type WorkoutSaveDeps = {
  // Persists the session + exercises + sets atomically. Resolves with the new
  // session id (or null if unknown) and whether the row already existed
  // (idempotent replay). MUST throw an Error whose message contains
  // WORKOUT_SESSION_ALREADY_EXISTS when a same-day session exists and overwrite
  // was not requested.
  saveSession: (input: WorkoutSaveInput) => Promise<{ sessionId: string | null; alreadyExisted: boolean }>;
  updateDurations: (input: WorkoutSaveInput, durations: Record<string, number>) => Promise<void>;
  updateNotes: (input: WorkoutSaveInput) => Promise<void>;
  updateReorder: (input: WorkoutSaveInput) => Promise<void>;
  clearDraft: () => void;
  getUserId?: () => Promise<string | null>;
  log?: (event: string, detail: Record<string, unknown>) => void;
};

const isAlreadyExistsError = (error: unknown): boolean => {
  const message =
    error instanceof Error
      ? error.message
      : typeof (error as { message?: unknown })?.message === 'string'
        ? String((error as { message?: unknown }).message)
        : '';
  return message.includes(WORKOUT_SESSION_ALREADY_EXISTS);
};

export const extractErrorMessage = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  const maybe = (error as { message?: unknown })?.message;
  if (typeof maybe === 'string' && maybe) return maybe;
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
};

// Small helper: gather the per-exercise durations map from the exercises list.
export const collectExerciseDurations = (
  exercises: WorkoutSaveInput['exercises']
): Record<string, number> => {
  const durations: Record<string, number> = {};
  for (const exercise of exercises) {
    if (exercise.durationSeconds) {
      durations[exercise.exerciseName] = exercise.durationSeconds;
    }
  }
  return durations;
};

export const countTotalSets = (exercises: WorkoutSaveInput['exercises']): number =>
  exercises.reduce((sum, exercise) => sum + (exercise.sets?.length || 0), 0);

// Orchestrate the full save. Never throws — every outcome is a typed result so
// callers cannot accidentally treat a partial/failed save as success.
export const runWorkoutSave = async (
  deps: WorkoutSaveDeps,
  input: WorkoutSaveInput
): Promise<WorkoutSaveResult> => {
  const log = deps.log ?? (() => {});

  const userId = deps.getUserId ? await deps.getUserId().catch(() => null) : null;
  const diagnostics: WorkoutSaveDiagnostics = {
    saveAttemptId: input.clientWorkoutId,
    clientWorkoutId: input.clientWorkoutId,
    userId,
    programId: input.programId,
    dayId: input.dayId,
    dayName: input.dayName,
    overwrite: input.overwrite,
    exerciseCount: input.exercises.length,
    totalSetCount: countTotalSets(input.exercises),
    startedAt: input.startedAt,
    endedAt: input.endedAt,
    durationSeconds: input.durationSeconds,
  };

  log('workout_save_attempt', diagnostics);

  // 1) Critical unit: session + exercises + sets (atomic in the DB layer).
  let sessionId: string | null = null;
  let alreadyExisted = false;
  try {
    const outcome = await deps.saveSession(input);
    sessionId = outcome.sessionId;
    alreadyExisted = outcome.alreadyExisted;
  } catch (error) {
    if (isAlreadyExistsError(error)) {
      log('workout_save_exists', { ...diagnostics });
      return { status: 'exists' };
    }
    log('workout_save_failed', {
      ...diagnostics,
      stage: 'session',
      errorMessage: extractErrorMessage(error),
    });
    // Draft is intentionally NOT cleared here.
    return { status: 'failed', stage: 'session', userMessage: WORKOUT_SAVE_FAILED_MESSAGE, error };
  }

  log('workout_save_session_ok', { ...diagnostics, sessionId, alreadyExisted });

  // 2) Best-effort metadata. These never revert or block the confirmed session
  //    save, but failures are recorded as soft warnings.
  const softErrors: WorkoutSaveSoftError[] = [];

  try {
    await deps.updateDurations(input, collectExerciseDurations(input.exercises));
  } catch (error) {
    softErrors.push({ stage: 'durations', error });
    log('workout_save_soft_error', { ...diagnostics, stage: 'durations', errorMessage: extractErrorMessage(error) });
  }

  try {
    await deps.updateNotes(input);
  } catch (error) {
    softErrors.push({ stage: 'notes', error });
    log('workout_save_soft_error', { ...diagnostics, stage: 'notes', errorMessage: extractErrorMessage(error) });
  }

  try {
    await deps.updateReorder(input);
  } catch (error) {
    softErrors.push({ stage: 'reorder', error });
    log('workout_save_soft_error', { ...diagnostics, stage: 'reorder', errorMessage: extractErrorMessage(error) });
  }

  // 3) Session confirmed persisted — safe to clear the local draft.
  deps.clearDraft();
  log('workout_save_committed', { ...diagnostics, sessionId, softErrorCount: softErrors.length });

  return { status: 'saved', sessionId, alreadyExisted, softErrors };
};

// Generate a stable idempotency key for one completed-workout save. The same
// key is reused across retries so the DB can dedupe a commit whose HTTP response
// was lost.
export const createClientWorkoutId = (): string => {
  const cryptoObj = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (cryptoObj?.randomUUID) {
    return cryptoObj.randomUUID();
  }
  // Fallback (non-crypto): only used in environments without WebCrypto.
  return `cwid-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e9).toString(36)}`;
};
