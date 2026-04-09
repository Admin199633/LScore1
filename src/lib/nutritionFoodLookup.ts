import { proteinFoods, type ProteinFoodEntry } from '@shared-engines/proteinFoods';
import {
  listUserFoods,
  type UserFoodRow,
} from '@/lib/repositories/userFoodRepository';
import { mapUserFoodToEntry } from '@/lib/userFoodMapper';

export type NutritionFoodSource = 'global' | 'personal';

export type NutritionSearchFood = {
  entry: ProteinFoodEntry;
  source: NutritionFoodSource;
  normalizedName: string;
};

export const normalizeFoodLookupName = (value: string | null | undefined) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[.,/\\()-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const buildSearchFood = (
  entry: ProteinFoodEntry,
  source: NutritionFoodSource
): NutritionSearchFood => ({
  entry,
  source,
  normalizedName: normalizeFoodLookupName(entry.name),
});

export const buildNutritionSearchFoods = (
  personalFoods: UserFoodRow[]
): NutritionSearchFood[] => {
  const foods: NutritionSearchFood[] = [];
  const seenNames = new Set<string>();

  for (const entry of proteinFoods) {
    const searchableFood = buildSearchFood(entry, 'global');
    if (!searchableFood.normalizedName || seenNames.has(searchableFood.normalizedName)) {
      continue;
    }

    seenNames.add(searchableFood.normalizedName);
    foods.push(searchableFood);
  }

  for (const row of personalFoods) {
    const searchableFood = buildSearchFood(mapUserFoodToEntry(row), 'personal');
    if (!searchableFood.normalizedName || seenNames.has(searchableFood.normalizedName)) {
      continue;
    }

    seenNames.add(searchableFood.normalizedName);
    foods.push(searchableFood);
  }

  return foods;
};

export const buildNutritionSearchEntries = (personalFoods: UserFoodRow[]): ProteinFoodEntry[] =>
  buildNutritionSearchFoods(personalFoods).map((food) => food.entry);

export const loadNutritionSearchFoods = async (): Promise<NutritionSearchFood[]> =>
  buildNutritionSearchFoods(await listUserFoods());

export const loadNutritionSearchEntries = async (): Promise<ProteinFoodEntry[]> =>
  buildNutritionSearchEntries(await listUserFoods());
