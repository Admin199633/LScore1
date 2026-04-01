import { webSupabase } from '@/lib/supabase/browser';

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

const normalizeWeightValue = (value: number | string) => {
  const numericWeight = Number(value);

  if (!numericWeight || Number.isNaN(numericWeight) || numericWeight <= 0) {
    throw new Error('משקל גוף לא תקין.');
  }

  return numericWeight;
};

export const fetchLatestBodyweight = async () => {
  const userId = await requireCurrentUserId();
  const { data, error } = await webSupabase
    .from('bodyweight_logs')
    .select('*')
    .eq('user_id', userId)
    .order('log_date', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data ? { date: data.log_date, weight: Number(data.weight) } : null;
};

export const fetchBodyweightLogs = async () => {
  const userId = await requireCurrentUserId();
  const { data, error } = await webSupabase
    .from('bodyweight_logs')
    .select('*')
    .eq('user_id', userId)
    .order('log_date', { ascending: true });

  if (error) {
    throw error;
  }

  return (data || []).map((row) => ({
    date: row.log_date,
    weight: Number(row.weight),
  }));
};

export const upsertBodyweightLog = async (entry: { date: string; weight: number | string }) => {
  const userId = await requireCurrentUserId();
  const { data, error } = await webSupabase
    .from('bodyweight_logs')
    .upsert(
      {
        user_id: userId,
        log_date: entry.date,
        weight: normalizeWeightValue(entry.weight),
      },
      { onConflict: 'user_id,log_date' }
    )
    .select()
    .single();

  if (error) {
    throw error;
  }

  return {
    date: data.log_date,
    weight: Number(data.weight),
  };
};
