import { webSupabase } from '@/lib/supabase/browser';
import { fetchBodyweightLogs } from '@/lib/repositories/bodyweightRepository';
import { listBodyMeasurementLogs, type BodyMeasurementLog } from '@/lib/repositories/bodyMeasurementRepository';
import { fetchNutritionLogs, type SavedNutritionLog } from '@/lib/repositories/nutritionLogRepository';
import { fetchSavedWorkoutSessions, type SavedWorkoutSession } from '@/lib/repositories/workoutSessionRepository';
import { listWeeklyGoalSnapshotsByUser } from '@/lib/repositories/weeklyGoalSnapshotRepository';
import { ensureProfile } from '@/lib/repositories/profileRepository';
import type { WeeklyGoalSnapshot } from '@/lib/weeklyGoalSnapshots';

export type ExportProfileRow = {
  id: string;
  email: string | null;
  fullName: string | null;
  authProvider: string | null;
  age: number | null;
  height: number | null;
  gender: string | null;
  experience: string | null;
  goal: string | null;
  focusAreas: string[];
  trainingDaysPerWeek: number | null;
  nutritionTargetMode: string | null;
  manualDailyCalories: number | null;
  manualDailyProtein: number | null;
  createdAt: string | null;
  updatedAt: string | null;
};

export type UserExportBundle = {
  userId: string;
  userEmail: string | null;
  profile: ExportProfileRow | null;
  bodyweightLogs: Array<{ date: string; weight: number }>;
  bodyMeasurementLogs: BodyMeasurementLog[];
  nutritionLogs: SavedNutritionLog[];
  workoutSessions: SavedWorkoutSession[];
  weeklyGoalSnapshots: WeeklyGoalSnapshot[];
};

const requireCurrentUser = async () => {
  const {
    data: { user },
    error,
  } = await webSupabase.auth.getUser();

  if (error) {
    throw error;
  }

  if (!user?.id) {
    throw new Error('המשתמש לא מחובר.');
  }

  return user;
};

const fetchExportProfileRow = async (userId: string): Promise<ExportProfileRow | null> => {
  const { data, error } = await webSupabase
    .from('profiles')
    .select(
      'id, email, full_name, auth_provider, age, height, gender, experience, goal, focus_areas, training_days_per_week, nutrition_target_mode, manual_daily_calories, manual_daily_protein, created_at, updated_at'
    )
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    return null;
  }

  return {
    id: data.id,
    email: data.email ?? null,
    fullName: data.full_name ?? null,
    authProvider: data.auth_provider ?? null,
    age: data.age != null ? Number(data.age) : null,
    height: data.height != null ? Number(data.height) : null,
    gender: data.gender ?? null,
    experience: data.experience ?? null,
    goal: data.goal ?? null,
    focusAreas: Array.isArray(data.focus_areas) ? data.focus_areas : [],
    trainingDaysPerWeek:
      data.training_days_per_week != null ? Number(data.training_days_per_week) : null,
    nutritionTargetMode: data.nutrition_target_mode ?? null,
    manualDailyCalories:
      data.manual_daily_calories != null ? Number(data.manual_daily_calories) : null,
    manualDailyProtein:
      data.manual_daily_protein != null ? Number(data.manual_daily_protein) : null,
    createdAt: data.created_at ?? null,
    updatedAt: data.updated_at ?? null,
  };
};

export const fetchUserExportBundle = async (): Promise<UserExportBundle> => {
  const user = await requireCurrentUser();

  await ensureProfile();

  const [
    profile,
    bodyweightLogs,
    bodyMeasurementLogs,
    nutritionLogs,
    workoutSessions,
    weeklyGoalSnapshots,
  ] = await Promise.all([
    fetchExportProfileRow(user.id),
    fetchBodyweightLogs().catch(() => []),
    listBodyMeasurementLogs().catch(() => []),
    fetchNutritionLogs().catch(() => []),
    fetchSavedWorkoutSessions().catch(() => []),
    listWeeklyGoalSnapshotsByUser(user.id).catch(() => []),
  ]);

  return {
    userId: user.id,
    userEmail: user.email ?? null,
    profile,
    bodyweightLogs,
    bodyMeasurementLogs,
    nutritionLogs,
    workoutSessions,
    weeklyGoalSnapshots,
  };
};
