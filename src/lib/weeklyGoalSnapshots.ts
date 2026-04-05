export type WeeklyGoalType =
  | 'training_focus'
  | 'nutrition_focus'
  | 'consistency_focus'
  | 'weight_focus'
  | 'fallback';

export type WeeklyGoalConfidence = 'high' | 'medium' | 'low';

export type WeeklyPrimaryMetric =
  | 'workouts'
  | 'protein_days'
  | 'calories_days'
  | 'weight_trend'
  | 'focus_exercise_trend'
  | null;

export type WeeklyTrendTarget = 'up' | 'down' | 'stable';
export type WeeklyTrendActual = WeeklyTrendTarget | 'insufficient_data';

export type WeeklyGoalTargets = {
  workoutsPlanned?: number;
  proteinDaysTarget?: number;
  calorieDaysTarget?: number;
  weightTrendTarget?: WeeklyTrendTarget;
  focusExercise?: string;
  focusMuscleGroup?: string;
};

export type WeeklyGoalActuals = {
  workoutsCompleted?: number;
  proteinDaysCompleted?: number;
  calorieDaysCompleted?: number;
  actualWeightTrend?: WeeklyTrendActual;
  focusExerciseTrend?: WeeklyTrendActual;
};

export type WeeklyGoalOutcomes = {
  workoutsMet?: boolean | null;
  proteinMet?: boolean | null;
  caloriesMet?: boolean | null;
  weightGoalMet?: boolean | null;
  focusGoalMet?: boolean | null;
  overallMet?: boolean | null;
};

export type WeeklyGoalSnapshot = {
  id: string;
  userId: string;
  weekStartDate: string;
  weekEndDate: string;
  goalType: WeeklyGoalType;
  templateId: string | null;
  title: string;
  body: string;
  focusArea: string | null;
  primaryMetric: WeeklyPrimaryMetric;
  targets: WeeklyGoalTargets;
  actuals: WeeklyGoalActuals;
  outcomes: WeeklyGoalOutcomes;
  confidence: WeeklyGoalConfidence;
  createdAt: string;
  updatedAt: string;
  finalizedAt: string | null;
};

export type CreateWeeklyGoalSnapshotInput = Omit<
  WeeklyGoalSnapshot,
  'id' | 'createdAt' | 'updatedAt' | 'finalizedAt'
>;

export type UpdateWeeklyGoalSnapshotInput = Partial<
  Pick<
    WeeklyGoalSnapshot,
    | 'goalType'
    | 'templateId'
    | 'title'
    | 'body'
    | 'focusArea'
    | 'primaryMetric'
    | 'targets'
    | 'actuals'
    | 'outcomes'
    | 'confidence'
    | 'finalizedAt'
  >
>;
