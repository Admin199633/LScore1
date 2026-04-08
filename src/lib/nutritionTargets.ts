import { normalizeGoalType } from '@/lib/goalDefinitions';

export type NutritionTargetMode = 'auto' | 'manual';

export type ProfileWithNutritionTargets = {
  age: number;
  height: number;
  gender: string;
  goal: string;
  nutritionTargetMode?: NutritionTargetMode | null;
  manualDailyCalories?: number | null;
  manualDailyProtein?: number | null;
};

export type EffectiveNutritionTargets = {
  dailyCaloriesTarget: number | null;
  dailyProteinTarget: number | null;
  source: NutritionTargetMode;
};

const getLatestBodyweight = (bodyweightLogs: Array<{ date: string; weight: number }>) =>
  bodyweightLogs.length ? bodyweightLogs[bodyweightLogs.length - 1].weight : 0;

export const isValidNutritionTargetNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value > 0;

export const normalizeNutritionTargetMode = (value: unknown): NutritionTargetMode =>
  value === 'manual' ? 'manual' : 'auto';

export const getComputedNutritionTargets = (
  profile: Pick<ProfileWithNutritionTargets, 'age' | 'height' | 'gender' | 'goal'> | null,
  bodyweightLogs: Array<{ date: string; weight: number }>
) => {
  if (!profile) {
    return {
      dailyCaloriesTarget: null,
      dailyProteinTarget: null,
    };
  }

  const latestWeight = getLatestBodyweight(bodyweightLogs);
  const normalizedGoal = normalizeGoalType(profile.goal);

  let dailyCaloriesTarget: number | null = null;
  if (latestWeight && profile.height && profile.age) {
    const base = 10 * latestWeight + 6.25 * profile.height - 5 * profile.age;
    const bmr = profile.gender === 'female' ? base - 161 : base + 5;
    const tdee = bmr * 1.375;

    if (normalizedGoal === 'cut') {
      dailyCaloriesTarget = Math.round(tdee - 400);
    } else if (normalizedGoal === 'bulk') {
      dailyCaloriesTarget = Math.round(tdee + 300);
    } else {
      dailyCaloriesTarget = Math.round(tdee);
    }
  }

  let dailyProteinTarget: number | null = null;
  if (latestWeight) {
    const multiplier = normalizedGoal === 'cut' ? 2.2 : normalizedGoal === 'bulk' ? 1.8 : 1.6;
    dailyProteinTarget = Math.round(latestWeight * multiplier);
  }

  return {
    dailyCaloriesTarget,
    dailyProteinTarget,
  };
};

export const resolveEffectiveNutritionTargets = ({
  profile,
  bodyweightLogs,
}: {
  profile: ProfileWithNutritionTargets | null;
  bodyweightLogs: Array<{ date: string; weight: number }>;
}): EffectiveNutritionTargets => {
  const computedTargets = getComputedNutritionTargets(profile, bodyweightLogs);

  if (!profile) {
    return {
      ...computedTargets,
      source: 'auto',
    };
  }

  const mode = normalizeNutritionTargetMode(profile.nutritionTargetMode);
  const manualDailyCalories = Number(profile.manualDailyCalories);
  const manualDailyProtein = Number(profile.manualDailyProtein);

  if (
    mode === 'manual' &&
    isValidNutritionTargetNumber(manualDailyCalories) &&
    isValidNutritionTargetNumber(manualDailyProtein)
  ) {
    return {
      dailyCaloriesTarget: Math.round(manualDailyCalories),
      dailyProteinTarget: Math.round(manualDailyProtein),
      source: 'manual',
    };
  }

  return {
    ...computedTargets,
    source: 'auto',
  };
};
