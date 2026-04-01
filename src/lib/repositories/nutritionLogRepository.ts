import { webSupabase } from '@/lib/supabase/browser';

const toNullableNumber = (value: unknown) =>
  typeof value === 'number' && !Number.isNaN(value) ? value : null;

const requireCurrentUserId = async () => {
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

  return user.id;
};

const normalizeNutritionItem = (
  item: {
    originalText?: string;
    displayName?: string;
    proteinGrams?: number | null;
    calories?: number | null;
    carbs?: number | null;
    fat?: number | null;
    status?: string;
    reason?: string;
  },
  itemOrder: number
) => ({
  item_order: itemOrder,
  original_text: String(item.originalText || '').trim(),
  display_name: String(item.displayName || item.originalText || '').trim(),
  protein_grams: toNullableNumber(item.proteinGrams),
  calories: toNullableNumber(item.calories),
  carbs: toNullableNumber(item.carbs),
  fat: toNullableNumber(item.fat),
  status: item.status === 'unresolved' ? 'unresolved' : 'calculated',
  reason: item.reason ? String(item.reason).trim() : null,
});

type SaveNutritionLogInput = {
  date: string;
  rawInputText: string;
  totalProteinGrams: number;
  totalCalories?: number | null;
  totalCarbs?: number | null;
  totalFat?: number | null;
  items: Array<{
    originalText: string;
    displayName: string;
    proteinGrams: number | null;
    calories?: number | null;
    carbs?: number | null;
    fat?: number | null;
    status: 'calculated' | 'unresolved';
    reason?: string;
  }>;
};

export type SavedNutritionLog = {
  date: string;
  rawInputText: string;
  totalProteinGrams: number;
  totalCalories: number | null;
  totalCarbs: number | null;
  totalFat: number | null;
  items: Array<{
    originalText: string;
    displayName: string;
    proteinGrams: number | null;
    calories: number | null;
    carbs: number | null;
    fat: number | null;
    status: 'calculated' | 'unresolved';
    reason?: string;
  }>;
};

export const saveNutritionLog = async (nutritionLog: SaveNutritionLogInput) => {
  const userId = await requireCurrentUserId();
  const logDate = String(nutritionLog.date || '').trim();

  if (!logDate) {
    throw new Error('חסר תאריך לשמירת יומן התזונה.');
  }

  const { data: savedLog, error: saveLogError } = await webSupabase
    .from('nutrition_logs')
    .upsert(
      {
        user_id: userId,
        log_date: logDate,
        raw_input_text: String(nutritionLog.rawInputText || ''),
        total_protein_grams: Number(nutritionLog.totalProteinGrams || 0),
        total_calories: toNullableNumber(nutritionLog.totalCalories),
        total_carbs: toNullableNumber(nutritionLog.totalCarbs),
        total_fat: toNullableNumber(nutritionLog.totalFat),
      },
      { onConflict: 'user_id,log_date' }
    )
    .select('id, log_date, raw_input_text, total_protein_grams, total_calories, total_carbs, total_fat')
    .single();

  if (saveLogError) {
    throw saveLogError;
  }

  const { error: deleteItemsError } = await webSupabase
    .from('nutrition_log_items')
    .delete()
    .eq('nutrition_log_id', savedLog.id);

  if (deleteItemsError) {
    throw deleteItemsError;
  }

  const itemPayload = nutritionLog.items.map((item, index) => ({
    nutrition_log_id: savedLog.id,
    ...normalizeNutritionItem(item, index),
  }));

  if (itemPayload.length > 0) {
    const { error: insertItemsError } = await webSupabase
      .from('nutrition_log_items')
      .insert(itemPayload);

    if (insertItemsError) {
      throw insertItemsError;
    }
  }

  return {
    date: savedLog.log_date,
    rawInputText: savedLog.raw_input_text || '',
    totalProteinGrams: Number(savedLog.total_protein_grams || 0),
    totalCalories: savedLog.total_calories != null ? Number(savedLog.total_calories) : null,
    totalCarbs: savedLog.total_carbs != null ? Number(savedLog.total_carbs) : null,
    totalFat: savedLog.total_fat != null ? Number(savedLog.total_fat) : null,
    items: itemPayload.map((item) => ({
      originalText: item.original_text,
      displayName: item.display_name,
      proteinGrams: item.protein_grams,
      calories: item.calories,
      carbs: item.carbs,
      fat: item.fat,
      status: item.status,
      reason: item.reason || undefined,
    })),
  } satisfies SavedNutritionLog;
};

export const appendNutritionLog = async (nutritionLog: SaveNutritionLogInput) => {
  const userId = await requireCurrentUserId();
  const logDate = String(nutritionLog.date || '').trim();

  if (!logDate) {
    throw new Error('׳—׳¡׳¨ ׳×׳׳¨׳™׳ ׳׳©׳׳™׳¨׳× ׳™׳•׳׳ ׳”׳×׳–׳•׳ ׳”.');
  }

  const { data: existingLog, error: existingError } = await webSupabase
    .from('nutrition_logs')
    .select('id, raw_input_text, total_protein_grams, total_calories, total_carbs, total_fat')
    .eq('user_id', userId)
    .eq('log_date', logDate)
    .maybeSingle();

  if (existingError) {
    throw existingError;
  }

  if (!existingLog) {
    return saveNutritionLog(nutritionLog);
  }

  const combineNumber = (value?: number | null) => (typeof value === 'number' ? value : 0);
  const extraProtein = Number(nutritionLog.totalProteinGrams || 0);
  const extraCalories = Number(nutritionLog.totalCalories ?? 0);
  const extraCarbs = Number(nutritionLog.totalCarbs ?? 0);
  const extraFat = Number(nutritionLog.totalFat ?? 0);

  const combinedInput = [existingLog.raw_input_text, nutritionLog.rawInputText]
    .filter(Boolean)
    .join('\n')
    .trim();

  const updatedTotals = {
    total_protein_grams: combineNumber(existingLog.total_protein_grams) + extraProtein,
    total_calories: combineNumber(existingLog.total_calories) + extraCalories,
    total_carbs: combineNumber(existingLog.total_carbs) + extraCarbs,
    total_fat: combineNumber(existingLog.total_fat) + extraFat,
  };

  const { error: updateError } = await webSupabase
    .from('nutrition_logs')
    .update({
      raw_input_text: combinedInput,
      ...updatedTotals,
    })
    .eq('id', existingLog.id);

  if (updateError) {
    throw updateError;
  }

  const { data: lastItemRows, error: lastItemError } = await webSupabase
    .from('nutrition_log_items')
    .select('item_order')
    .eq('nutrition_log_id', existingLog.id)
    .order('item_order', { ascending: false })
    .limit(1);

  if (lastItemError) {
    throw lastItemError;
  }

  const startOrder = (lastItemRows && lastItemRows.length > 0 ? lastItemRows[0].item_order : -1) ?? -1;

  const itemPayload = nutritionLog.items.map((item, index) => ({
    nutrition_log_id: existingLog.id,
    ...normalizeNutritionItem(item, startOrder + 1 + index),
  }));

  if (itemPayload.length > 0) {
    const { error: insertItemsError } = await webSupabase.from('nutrition_log_items').insert(itemPayload);

    if (insertItemsError) {
      throw insertItemsError;
    }
  }

  return {
    date: logDate,
    rawInputText: combinedInput,
    totalProteinGrams: updatedTotals.total_protein_grams,
    totalCalories: updatedTotals.total_calories,
    totalCarbs: updatedTotals.total_carbs,
    totalFat: updatedTotals.total_fat,
    items: itemPayload.map((item) => ({
      originalText: item.original_text,
      displayName: item.display_name,
      proteinGrams: item.protein_grams,
      calories: item.calories,
      carbs: item.carbs,
      fat: item.fat,
      status: item.status,
      reason: item.reason || undefined,
    })),
  } satisfies SavedNutritionLog;
};

export const fetchNutritionLogs = async (): Promise<SavedNutritionLog[]> => {
  const userId = await requireCurrentUserId();

  const { data: logRows, error: logRowsError } = await webSupabase
    .from('nutrition_logs')
    .select('id, log_date, raw_input_text, total_protein_grams, total_calories, total_carbs, total_fat')
    .eq('user_id', userId)
    .order('log_date', { ascending: false });

  if (logRowsError) {
    throw logRowsError;
  }

  const logIds = (logRows || []).map((row) => row.id);
  let itemRows: Array<{
    nutrition_log_id: string;
    item_order: number;
    original_text: string;
    display_name: string;
    protein_grams: number | null;
    calories: number | null;
    carbs: number | null;
    fat: number | null;
    status: 'calculated' | 'unresolved';
    reason: string | null;
  }> = [];

  if (logIds.length > 0) {
    const { data, error } = await webSupabase
      .from('nutrition_log_items')
      .select(
        'nutrition_log_id, item_order, original_text, display_name, protein_grams, calories, carbs, fat, status, reason'
      )
      .in('nutrition_log_id', logIds)
      .order('item_order', { ascending: true });

    if (error) {
      throw error;
    }

    itemRows = data || [];
  }

  return (logRows || []).map((row) => ({
    date: row.log_date,
    rawInputText: row.raw_input_text || '',
    totalProteinGrams: Number(row.total_protein_grams || 0),
    totalCalories: row.total_calories != null ? Number(row.total_calories) : null,
    totalCarbs: row.total_carbs != null ? Number(row.total_carbs) : null,
    totalFat: row.total_fat != null ? Number(row.total_fat) : null,
    items: itemRows
      .filter((item) => item.nutrition_log_id === row.id)
      .sort((left, right) => left.item_order - right.item_order)
      .map((item) => ({
        originalText: item.original_text,
        displayName: item.display_name,
        proteinGrams: item.protein_grams != null ? Number(item.protein_grams) : null,
        calories: item.calories != null ? Number(item.calories) : null,
        carbs: item.carbs != null ? Number(item.carbs) : null,
        fat: item.fat != null ? Number(item.fat) : null,
        status: item.status,
        reason: item.reason || undefined,
      })),
  }));
};

export const deleteNutritionLog = async (logDate: string) => {
  const userId = await requireCurrentUserId();
  const trimmedLogDate = String(logDate || '').trim();

  if (!trimmedLogDate) {
    throw new Error('חסר תאריך למחיקת יומן התזונה.');
  }

  const { error } = await webSupabase
    .from('nutrition_logs')
    .delete()
    .eq('user_id', userId)
    .eq('log_date', trimmedLogDate);

  if (error) {
    throw error;
  }

  return { date: trimmedLogDate };
};
