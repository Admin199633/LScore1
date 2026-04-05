const DRAFT_KEY = 'gym-active-workout-draft';
const MAX_DRAFT_AGE_MS = 16 * 60 * 60 * 1000; // 16 hours — anything older is stale

export type WorkoutDraftSet = {
  weight: string;
  reps: string;
  difficulty: string;
};

export type WorkoutDraftExercise = {
  exerciseId: string;
  exerciseName: string;
  plannedSets: string;
  plannedReps: string;
  plannedWeight: string;
  completed: boolean;
  durationSeconds?: number;
  sets: WorkoutDraftSet[];
};

export type WorkoutDraft = {
  startedAt: string;
  selectedDate: string;
  selectedDayId: string;
  energyLevel: string | null;
  draftExercises: WorkoutDraftExercise[];
  currentExerciseIndex: number;
  exerciseNotes: Record<string, string>;
  reorderCount: number;
};

export function loadWorkoutDraft(): WorkoutDraft | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<WorkoutDraft>;

    // Structural validation
    if (
      !parsed.startedAt ||
      typeof parsed.startedAt !== 'string' ||
      !parsed.selectedDayId ||
      !Array.isArray(parsed.draftExercises)
    ) {
      window.localStorage.removeItem(DRAFT_KEY);
      return null;
    }

    // Stale check
    const startedAtMs = new Date(parsed.startedAt).getTime();
    if (!Number.isFinite(startedAtMs) || Date.now() - startedAtMs > MAX_DRAFT_AGE_MS) {
      window.localStorage.removeItem(DRAFT_KEY);
      return null;
    }

    return {
      startedAt: parsed.startedAt,
      selectedDate: typeof parsed.selectedDate === 'string' ? parsed.selectedDate : new Date().toISOString().slice(0, 10),
      selectedDayId: parsed.selectedDayId,
      energyLevel: parsed.energyLevel ?? null,
      draftExercises: parsed.draftExercises,
      currentExerciseIndex: typeof parsed.currentExerciseIndex === 'number' ? parsed.currentExerciseIndex : 0,
      exerciseNotes: (parsed.exerciseNotes && typeof parsed.exerciseNotes === 'object' && !Array.isArray(parsed.exerciseNotes))
        ? (parsed.exerciseNotes as Record<string, string>)
        : {},
      reorderCount: typeof parsed.reorderCount === 'number' ? parsed.reorderCount : 0,
    };
  } catch {
    window.localStorage.removeItem(DRAFT_KEY);
    return null;
  }
}

export function saveWorkoutDraft(draft: WorkoutDraft): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
}

export function clearWorkoutDraft(): void {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(DRAFT_KEY);
}
