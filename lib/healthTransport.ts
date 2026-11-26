import { createClient } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { createHealthSyncGuard, StaleHealthSyncError } from './healthSyncCore';

/** Pin authentication to the account that began this operation. The shared
 * client's token may change while native reads or network requests are pending. */
export async function healthTransport(owner: string) {
  const guard = createHealthSyncGuard(owner, async () => {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    return data.session?.user.id ?? null;
  });
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  if (!data.session?.access_token || data.session.user.id !== owner) throw new StaleHealthSyncError();
  await guard.assertCurrent();
  const token = data.session.access_token;
  const client = createClient(process.env.EXPO_PUBLIC_SUPABASE_URL!, process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: {
      headers: { Authorization: `Bearer ${token}` },
      fetch: async (input, init) => {
        await guard.assertCurrent();
        // Explicit header wins even if the shared session changes after the check.
        const headers = new Headers(init?.headers);
        headers.set('Authorization', `Bearer ${token}`);
        const controller = new AbortController();
        const cancel = () => controller.abort();
        const unsubscribe = guard.onInvalidate(cancel);
        init?.signal?.addEventListener('abort', cancel, { once: true });
        if (init?.signal?.aborted) cancel();
        try {
          await guard.assertCurrent();
          return await fetch(input, { ...init, headers, signal: controller.signal });
        } finally {
          unsubscribe();
          init?.signal?.removeEventListener('abort', cancel);
        }
      },
    },
  });
  return { client, guard };
}
