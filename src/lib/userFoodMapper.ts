import type { ProteinFoodEntry } from '@shared-engines/proteinFoods';
import type { UserFoodRow } from '@/lib/repositories/userFoodRepository';

/**
 * Converts a user_foods DB row into the ProteinFoodEntry shape expected by the
 * nutrition engine. The resulting entry will be merged before the JSON food
 * database so user-defined foods take priority on name collisions.
 */
export const mapUserFoodToEntry = (row: UserFoodRow): ProteinFoodEntry => ({
  name: row.name,
  aliases: row.aliases,
  category: 'user',
  subCategory: '',
  canonicalGroup: row.name,
  units: [
    {
      type: row.unit_type === 'weight' ? 'weight' : 'unit',
      label: row.unit_label,
      nutrition: {
        calories: row.calories,
        protein: row.protein,
        carbs: row.carbs,
        fat: row.fat,
      },
      ...(row.unit_grams != null ? { grams: row.unit_grams } : {}),
    },
  ],
});

export const mapUserFoodsToEntries = (rows: UserFoodRow[]): ProteinFoodEntry[] =>
  rows.map(mapUserFoodToEntry);
