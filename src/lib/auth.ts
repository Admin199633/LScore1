import { webSupabase } from '@/lib/supabase/browser';

const normalizeEmail = (value: string) => value.trim().toLowerCase();

export const getCurrentSession = async () => {
  const { data, error } = await webSupabase.auth.getSession();
  if (error) {
    throw error;
  }

  return data.session;
};

export const onAuthStateChange = (
  callback: Parameters<typeof webSupabase.auth.onAuthStateChange>[0]
) => webSupabase.auth.onAuthStateChange(callback);

export const signInWithEmail = async ({
  email,
  password,
}: {
  email: string;
  password: string;
}) => {
  const { data, error } = await webSupabase.auth.signInWithPassword({
    email: normalizeEmail(email),
    password,
  });
  if (error) {
    throw error;
  }

  return data;
};

export const signUpWithEmail = async ({
  email,
  password,
}: {
  email: string;
  password: string;
}) => {
  const { data, error } = await webSupabase.auth.signUp({
    email: normalizeEmail(email),
    password,
  });
  if (error) {
    throw error;
  }

  return data;
};

export const signOut = async () => {
  const { error } = await webSupabase.auth.signOut();
  if (error) {
    throw error;
  }
};
