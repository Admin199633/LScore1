import { webSupabase } from '@/lib/supabase/browser';
import { normalizeGoalType } from '@/lib/goalDefinitions';

const requireCurrentUser = async () => {
  const {
    data: { user },
    error,
  } = await webSupabase.auth.getUser();

  if (error) {
    throw error;
  }

  if (!user) {
    throw new Error('המשתמש לא מחובר.');
  }

  return user;
};

const requireCurrentUserId = async () => {
  const user = await requireCurrentUser();
  return user.id;
};

const normalizeEmail = (value: string | null | undefined) => {
  const normalized = String(value || '').trim().toLowerCase();
  return normalized || null;
};

const mapProfileWriteError = (error: { message?: string; code?: string; details?: string | null }) => {
  const message = String(error?.message || '');
  const details = String(error?.details || '');

  if (
    error?.code === '23505' ||
    message.includes('PROFILE_EMAIL_ALREADY_LINKED') ||
    message.includes('profiles_email_unique_idx') ||
    details.includes('profiles_email_unique_idx')
  ) {
    return new Error('This email is already linked to another account. Clean up the duplicate Auth user before continuing.');
  }

  return error instanceof Error ? error : new Error(message || 'Profile write failed.');
};

const buildProfilePayload = (user: Awaited<ReturnType<typeof requireCurrentUser>>) => ({
  id: user.id,
  email: normalizeEmail(user.email),
  auth_provider: user.app_metadata?.provider || 'email',
  ...(user.user_metadata?.full_name || user.user_metadata?.name || user.user_metadata?.user_name
    ? {
        full_name:
          user.user_metadata?.full_name ||
          user.user_metadata?.name ||
          user.user_metadata?.user_name,
      }
    : {}),
  ...(user.user_metadata?.avatar_url ? { avatar_url: user.user_metadata.avatar_url } : {}),
});

const rowToUser = (
  profileRow: {
    age?: number | null;
    height?: number | null;
    experience?: string | null;
    goal?: string | null;
    focus_areas?: string[] | null;
    training_days_per_week?: number | null;
    gender?: string | null;
  } | null,
  latestWeight: number | null = null
) => {
  if (!profileRow) {
    return null;
  }

  return {
    age: profileRow.age || 0,
    weight: latestWeight || 0,
    height: Number(profileRow.height || 0),
    experience: profileRow.experience || 'beginner',
    goal: normalizeGoalType(profileRow.goal) || 'bulk',
    focusAreas: Array.isArray(profileRow.focus_areas) ? profileRow.focus_areas : [],
    trainingDaysPerWeek: Number(profileRow.training_days_per_week || 0),
    gender: profileRow.gender || '',
  };
};

export const ensureProfile = async () => {
  const user = await requireCurrentUser();
  const payload = buildProfilePayload(user);

  const { error } = await webSupabase.from('profiles').upsert(payload, {
    onConflict: 'id',
  });

  if (error) {
    throw mapProfileWriteError(error);
  }
};

export const fetchCurrentProfileRow = async () => {
  await ensureProfile();
  const userId = await requireCurrentUserId();
  const { data, error } = await webSupabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
};

export const fetchCurrentProfile = async (latestWeight: number | null = null) => {
  const row = await fetchCurrentProfileRow();
  return rowToUser(row, latestWeight);
};

export const saveCurrentProfile = async (
  userInput: {
    age: number | string;
    weight?: number | string;
    height: number | string;
    experience: string;
    goal: string;
    focusAreas: string[];
    trainingDaysPerWeek?: number | string;
    gender?: string;
  },
  latestWeight: number | null = null
) => {
  const userId = await requireCurrentUserId();
  const { error } = await webSupabase.from('profiles').upsert(
    {
      id: userId,
      age: Number(userInput.age) || null,
      height: Number(userInput.height) || null,
      experience: userInput.experience?.trim?.() || userInput.experience || null,
      goal: normalizeGoalType(userInput.goal) || null,
      training_days_per_week: Number(userInput.trainingDaysPerWeek) || null,
      focus_areas: Array.isArray(userInput.focusAreas)
        ? userInput.focusAreas.map((item) => String(item).trim()).filter(Boolean)
        : [],
      gender: userInput.gender?.trim() || null,
    },
    { onConflict: 'id' }
  );

  if (error) {
    throw mapProfileWriteError(error);
  }

  return {
    ...userInput,
    weight: latestWeight ?? Number(userInput.weight || 0),
    trainingDaysPerWeek: Number(userInput.trainingDaysPerWeek || 0),
  };
};
