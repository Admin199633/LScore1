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
  normalizedAliases: string[];
  calories: number | null;
  protein: number | null;
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
  normalizedAliases: (entry.aliases ?? []).map(normalizeFoodLookupName).filter(Boolean),
  calories: entry.units?.[0]?.nutrition?.calories ?? null,
  protein: entry.units?.[0]?.nutrition?.protein ?? null,
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

const getSearchPriority = (food: NutritionSearchFood, normalizedQuery: string) => {
  if (food.normalizedName.startsWith(normalizedQuery)) {
    return 0;
  }

  if (food.normalizedName.includes(normalizedQuery)) {
    return 1;
  }

  if (food.normalizedAliases.some((alias) => alias.startsWith(normalizedQuery))) {
    return 2;
  }

  if (food.normalizedAliases.some((alias) => alias.includes(normalizedQuery))) {
    return 3;
  }

  return 99;
};

export const searchNutritionFoods = (
  foods: NutritionSearchFood[],
  query: string,
  limit = 8
): NutritionSearchFood[] => {
  const normalizedQuery = normalizeFoodLookupName(query);
  if (normalizedQuery.length < 2) {
    return [];
  }

  return foods
    .map((food, index) => ({
      food,
      index,
      priority: getSearchPriority(food, normalizedQuery),
    }))
    .filter(({ priority }) => priority < 99)
    .sort((left, right) => {
      if (left.priority !== right.priority) {
        return left.priority - right.priority;
      }

      if (left.food.source !== right.food.source) {
        return left.food.source === 'global' ? -1 : 1;
      }

      return left.index - right.index;
    })
    .slice(0, limit)
    .map(({ food }) => food);
};

export const loadNutritionSearchFoods = async (): Promise<NutritionSearchFood[]> =>
  buildNutritionSearchFoods(await listUserFoods());

export const loadNutritionSearchEntries = async (): Promise<ProteinFoodEntry[]> =>
  buildNutritionSearchEntries(await listUserFoods());
