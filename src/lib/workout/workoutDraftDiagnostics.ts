// Development-only, NON-DESTRUCTIVE recovery utility for the active workout
// draft. It only READS local storage — it never writes, clears, or overwrites
// anything — so it is safe to run against a device that may still hold an
// unsaved 2026-07-20 / 2026-07-21 workout.
//
// Usage (browser devtools console, dev build):
//   window.__gymInspectWorkoutDraft?.()   -> structured summary
//   window.__gymExportWorkoutDraft?.()    -> triggers a JSON download

const DRAFT_KEY = 'gym-active-workout-draft';

export type WorkoutDraftInspection = {
  present: boolean;
  raw: string | null;
  parseError: string | null;
  startedAt: string | null;
  selectedDate: string | null;
  selectedDayId: string | null;
  clientWorkoutId: string | null;
  exerciseCount: number;
  totalSetCount: number;
  filledSetCount: number;
  ageMs: number | null;
};

const readRaw = (): string | null => {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(DRAFT_KEY);
  } catch {
    return null;
  }
};

// Inspect the draft without any mutation. Returns a safe-to-log summary.
export const inspectWorkoutDraft = (): WorkoutDraftInspection => {
  const raw = readRaw();
  if (!raw) {
    return {
      present: false,
      raw: null,
      parseError: null,
      startedAt: null,
      selectedDate: null,
      selectedDayId: null,
      clientWorkoutId: null,
      exerciseCount: 0,
      totalSetCount: 0,
      filledSetCount: 0,
      ageMs: null,
    };
  }

  try {
    const parsed = JSON.parse(raw) as {
      startedAt?: string;
      selectedDate?: string;
      selectedDayId?: string;
      clientWorkoutId?: string;
      draftExercises?: Array<{ sets?: Array<{ weight?: string; reps?: string }> }>;
    };

    const exercises = Array.isArray(parsed.draftExercises) ? parsed.draftExercises : [];
    let totalSetCount = 0;
    let filledSetCount = 0;
    for (const exercise of exercises) {
      const sets = Array.isArray(exercise?.sets) ? exercise.sets : [];
      totalSetCount += sets.length;
      filledSetCount += sets.filter((s) => Number(s?.weight) > 0 && Number(s?.reps) > 0).length;
    }

    const startedAtMs = parsed.startedAt ? new Date(parsed.startedAt).getTime() : NaN;

    return {
      present: true,
      raw,
      parseError: null,
      startedAt: parsed.startedAt ?? null,
      selectedDate: parsed.selectedDate ?? null,
      selectedDayId: parsed.selectedDayId ?? null,
      clientWorkoutId: parsed.clientWorkoutId ?? null,
      exerciseCount: exercises.length,
      totalSetCount,
      filledSetCount,
      ageMs: Number.isFinite(startedAtMs) ? Date.now() - startedAtMs : null,
    };
  } catch (error) {
    return {
      present: true,
      raw,
      parseError: error instanceof Error ? error.message : String(error),
      startedAt: null,
      selectedDate: null,
      selectedDayId: null,
      clientWorkoutId: null,
      exerciseCount: 0,
      totalSetCount: 0,
      filledSetCount: 0,
      ageMs: null,
    };
  }
};

// Return the exact raw draft JSON (or null). Never mutates storage.
export const exportWorkoutDraftJson = (): string | null => readRaw();

// Trigger a browser download of the raw draft for offline recovery. Dev-only.
export const downloadWorkoutDraftJson = (): boolean => {
  if (typeof window === 'undefined') return false;
  const raw = readRaw();
  if (!raw) return false;
  const blob = new Blob([raw], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `workout-draft-recovery-${Date.now()}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
  return true;
};

// Attach the utilities to window in development only. Safe no-op in production
// and during SSR.
export const registerWorkoutDraftDiagnostics = (): void => {
  if (typeof window === 'undefined') return;
  if (process.env.NODE_ENV === 'production') return;
  (window as unknown as Record<string, unknown>).__gymInspectWorkoutDraft = () => {
    const info = inspectWorkoutDraft();
    // eslint-disable-next-line no-console
    console.info('[workout-draft]', info);
    return info;
  };
  (window as unknown as Record<string, unknown>).__gymExportWorkoutDraft = downloadWorkoutDraftJson;
};
