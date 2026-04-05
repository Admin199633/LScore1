import { webSupabase } from '@/lib/supabase/browser';

export type UserFoodRow = {
  id: string;
  user_id: string;
  name: string;
  aliases: string[];
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  unit_type: string;
  unit_label: string;
  unit_grams: number | null;
  source_unresolved_text: string | null;
  created_at: string;
  updated_at: string;
};

export type CreateUserFoodInput = {
  name: string;
  aliases?: string[];
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  unit_type?: string;
  unit_label?: string;
  unit_grams?: number | null;
  source_unresolved_text?: string | null;
};

export const listUserFoods = async (): Promise<UserFoodRow[]> => {
  const { data, error } = await webSupabase
    .from('user_foods')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data ?? []) as UserFoodRow[];
};

export const createUserFood = async (input: CreateUserFoodInput): Promise<UserFoodRow> => {
  const {
    data: { user },
    error: authError,
  } = await webSupabase.auth.getUser();

  if (authError) throw authError;
  if (!user?.id) throw new Error('המשתמש לא מחובר.');

  const { data, error } = await webSupabase
    .from('user_foods')
    .insert({
      user_id: user.id,
      name: input.name,
      aliases: input.aliases ?? [],
      calories: input.calories,
      protein: input.protein,
      carbs: input.carbs,
      fat: input.fat,
      unit_type: input.unit_type ?? 'weight',
      unit_label: input.unit_label ?? '100g',
      unit_grams: input.unit_grams ?? null,
      source_unresolved_text: input.source_unresolved_text ?? null,
    })
    .select('*')
    .single();

  if (error) throw error;
  return data as UserFoodRow;
};

export const deleteUserFood = async (id: string): Promise<void> => {
  const { error } = await webSupabase
    .from('user_foods')
    .delete()
    .eq('id', id);

  if (error) throw error;
};

export const updateUserFood = async (
  id: string,
  input: {
    name: string;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  }
): Promise<UserFoodRow> => {
  const { data, error } = await webSupabase
    .from('user_foods')
    .update({
      name: input.name,
      calories: input.calories,
      protein: input.protein,
      carbs: input.carbs,
      fat: input.fat,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select('*')
    .single();

  if (error) throw error;
  return data as UserFoodRow;
};
