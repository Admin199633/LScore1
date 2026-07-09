// Centralized exercise → muscle-group mapping.
// Keep this file as the single source of truth: to categorize a new exercise,
// add it to EXERCISE_MUSCLE_MAP (preferred, exact match) or rely on the keyword
// fallback below. Names are matched case-insensitively and trimmed, so both the
// Hebrew and English variants used across the app resolve correctly.

export type MuscleGroup =
  | 'chest'
  | 'back'
  | 'shoulders'
  | 'biceps'
  | 'triceps'
  | 'legs'
  | 'core';

// Display order used by the heatmap (matches the product spec example).
export const MUSCLE_GROUP_ORDER: MuscleGroup[] = [
  'chest',
  'back',
  'shoulders',
  'biceps',
  'triceps',
  'legs',
  'core',
];

export const MUSCLE_GROUP_LABELS: Record<MuscleGroup, string> = {
  chest: 'חזה',
  back: 'גב',
  shoulders: 'כתפיים',
  biceps: 'יד קדמית',
  triceps: 'יד אחורית',
  legs: 'רגליים',
  core: 'core',
};

const normalize = (value: string) => String(value || '').trim().toLowerCase();

// Exact-match table (covers every exercise currently used in the app's
// programs and instructions). Keys are normalized on read.
const EXERCISE_MUSCLE_MAP: Record<string, MuscleGroup> = {
  // Chest
  'bench press': 'chest',
  "באנץ' פרס": 'chest',
  'incline db press': 'chest',
  'incline press': 'chest',
  'chest fly': 'chest',
  'machine chest press': 'chest',
  'שכיבות סמיכה': 'chest',
  // Back
  'pull ups': 'back',
  'מתח': 'back',
  'barbell row': 'back',
  'seated row': 'back',
  'row (light)': 'back',
  'lat pulldown': 'back',
  'דדליפט': 'back',
  // Shoulders
  'shoulder press': 'shoulders',
  'לחיצת כתפיים': 'shoulders',
  'lateral raise': 'shoulders',
  'rear delt fly': 'shoulders',
  // Biceps
  'biceps curl': 'biceps',
  'כפיפות מרפק': 'biceps',
  // Triceps
  'triceps pushdown': 'triceps',
  'פשיטות תלת ראשי': 'triceps',
  // Legs
  'squat': 'legs',
  'סקוואט': 'legs',
  'leg press': 'legs',
  'leg curl': 'legs',
  'rdl': 'legs',
  // Core
  'abs': 'core',
};

// Ordered keyword fallback for exercises not in the exact table. Order matters:
// more specific groups are checked first so e.g. "Leg Curl" resolves to legs
// before the generic "curl" → biceps rule.
const KEYWORD_RULES: Array<{ group: MuscleGroup; keywords: string[] }> = [
  { group: 'legs', keywords: ['leg', 'squat', 'lunge', 'רגל', 'סקוואט', 'rdl', 'calf', 'quad', 'hamstring'] },
  { group: 'back', keywords: ['row', 'pull', 'lat', 'deadlift', 'דדל', 'גב', 'מתח', 'חתיר'] },
  { group: 'shoulders', keywords: ['shoulder', 'delt', 'lateral', 'כתפ', 'overhead', 'ohp'] },
  { group: 'triceps', keywords: ['tricep', 'pushdown', 'extension', 'תלת', 'skull'] },
  { group: 'biceps', keywords: ['bicep', 'curl', 'כפיפת מרפק', 'יד קד'] },
  { group: 'chest', keywords: ['chest', 'bench', 'fly', 'חזה', "בנץ", 'שכיב', 'press'] },
  { group: 'core', keywords: ['ab', 'core', 'plank', 'בטן', 'crunch'] },
];

export const getMuscleGroupForExercise = (exerciseName: string): MuscleGroup | null => {
  const key = normalize(exerciseName);
  if (!key) {
    return null;
  }

  if (EXERCISE_MUSCLE_MAP[key]) {
    return EXERCISE_MUSCLE_MAP[key];
  }

  for (const rule of KEYWORD_RULES) {
    if (rule.keywords.some((keyword) => key.includes(keyword))) {
      return rule.group;
    }
  }

  return null;
};
