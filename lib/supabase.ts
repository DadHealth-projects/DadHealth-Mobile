import 'react-native-url-polyfill/auto';
import { AppState } from 'react-native';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { SecureStoreAdapter } from './secureStore';

const TAG = '[supabase]';

// Keys live only in .env (EXPO_PUBLIC_*). No hardcoded fallback — a missing
// config fails fast rather than silently shipping baked-in credentials.
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

// Safer init: report EXACTLY which vars are missing, structured, without ever
// logging the key value itself.
const missing: string[] = [];
if (!supabaseUrl) missing.push('EXPO_PUBLIC_SUPABASE_URL');
if (!supabaseAnonKey) missing.push('EXPO_PUBLIC_SUPABASE_ANON_KEY');

if (missing.length > 0) {
  console.error(TAG, JSON.stringify({ event: 'missing_env', missing }));
  throw new Error(
    `Dad Health configuration error: missing ${missing.join(', ')}.\n` +
      'Copy these from ../dadHealth/.env into dadhealth-mobile/.env (see README).'
  );
}

// Non-null assertions are safe here: we threw above if either was undefined.
export const supabase: SupabaseClient = createClient(supabaseUrl!, supabaseAnonKey!, {
  auth: {
    // Persist the session in the hardware keychain, not localStorage.
    storage: SecureStoreAdapter,
    autoRefreshToken: true,
    persistSession: true,
    // No URL-based session detection on native.
    detectSessionInUrl: false,
  },
});

// Supabase recommends driving token auto-refresh off app foreground state:
// refresh while active, pause in the background. Guarded so a transient toggle
// failure can never crash the app.
AppState.addEventListener('change', (state) => {
  try {
    if (state === 'active') {
      supabase.auth.startAutoRefresh();
    } else {
      supabase.auth.stopAutoRefresh();
    }
  } catch (error) {
    console.warn(
      TAG,
      JSON.stringify({
        event: 'autorefresh_toggle_failed',
        message: error instanceof Error ? error.message : String(error),
      })
    );
  }
});
