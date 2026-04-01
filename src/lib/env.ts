export const webEnv = {
  supabaseUrl:
    typeof process.env.NEXT_PUBLIC_SUPABASE_URL === 'string'
      ? process.env.NEXT_PUBLIC_SUPABASE_URL.trim()
      : '',
  supabaseAnonKey:
    typeof process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY === 'string'
      ? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY.trim()
      : '',
};

export const hasWebSupabaseEnv = Boolean(webEnv.supabaseUrl && webEnv.supabaseAnonKey);

export const getWebEnvDebug = () => ({
  hasSupabaseUrl: Boolean(webEnv.supabaseUrl),
  hasSupabaseAnonKey: Boolean(webEnv.supabaseAnonKey),
  supabaseUrl: webEnv.supabaseUrl,
  supabaseAnonKeyPrefix: webEnv.supabaseAnonKey
    ? `${webEnv.supabaseAnonKey.slice(0, 16)}...`
    : '',
});
