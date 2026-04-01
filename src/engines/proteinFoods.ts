export type NutritionValues = {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
};

export type FoodUnit = {
  type: 'unit' | 'weight';
  label: string;
  nutrition: NutritionValues;
  grams?: number;
};

export type ProteinFoodEntry = {
  name: string;
  category: string;
  subCategory: string;
  canonicalGroup: string;
  aliases: string[];
  units: FoodUnit[];
};

const proteinFoodsData = require('../../protein_foods_strict.json') as ProteinFoodEntry[];

export const proteinFoods: ProteinFoodEntry[] = proteinFoodsData;
