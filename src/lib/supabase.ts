import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Only the publishable anon key reaches the browser. It is safe there because
 * every table is protected by Row Level Security and every write goes through
 * a SECURITY DEFINER function. The service-role key never appears in this
 * project — it stays in the Supabase dashboard.
 */
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const isConfigured = Boolean(
  url && anonKey && /^https?:\/\//.test(url) && anonKey.length > 20,
);

/**
 * When configuration is missing the app renders the setup screen instead of
 * any data screen, so this placeholder client is never used for a request.
 */
export const supabase: SupabaseClient = createClient(
  url ?? 'http://supabase-not-configured.local',
  anonKey ?? 'not-configured',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  },
);

export const RESTAURANT_SLUG =
  (import.meta.env.VITE_RESTAURANT_SLUG as string | undefined) ?? 'hun-cafe';
