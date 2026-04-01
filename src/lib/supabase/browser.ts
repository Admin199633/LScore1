import { createClient } from '@supabase/supabase-js';
import { getWebEnvDebug, hasWebSupabaseEnv, webEnv } from '@/lib/env';

if (!hasWebSupabaseEnv) {
  const debug = getWebEnvDebug();
  throw new Error(
    `Missing web Supabase env. NEXT_PUBLIC_SUPABASE_URL=${debug.hasSupabaseUrl ? 'set' : 'missing'}, NEXT_PUBLIC_SUPABASE_ANON_KEY=${debug.hasSupabaseAnonKey ? 'set' : 'missing'}`
  );
}

if (typeof window !== 'undefined' && process.env.NODE_ENV !== 'production') {
  const debug = getWebEnvDebug();
  console.info('[web-supabase-env]', debug);
}

export const webSupabase = createClient(
  webEnv.supabaseUrl,
  webEnv.supabaseAnonKey,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  }
);
