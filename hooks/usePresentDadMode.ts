import { useCallback, useEffect, useState } from 'react';

import { supabase } from '../lib/supabase';

type ActiveSession = { id: string; ends_at: string };

export function usePresentDadMode(userId?: string) {
  const [session, setSession] = useState<ActiveSession | null>(null);
  const [busy, setBusy] = useState(false);
  const [finishing, setFinishing] = useState(false);

  const refresh = useCallback(async () => {
    if (!userId) { setSession(null); setFinishing(false); return; }
    const result = await supabase.from('present_dad_sessions').select('id,ends_at').eq('user_id', userId).eq('status', 'active').maybeSingle();
    if (result.error) return;
    if (!result.data) { setSession(null); setFinishing(false); return; }
    const active = result.data as ActiveSession;
    setSession(active);
    setFinishing(new Date(active.ends_at).getTime() <= Date.now());
  }, [userId]);

  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => {
    if (!session) return;
    const remaining = new Date(session.ends_at).getTime() - Date.now();
    const delay = remaining > 0 ? remaining : 15_000;
    const timer = setTimeout(() => {
      if (remaining <= 0) setFinishing(true);
      void refresh();
    }, delay);
    return () => clearTimeout(timer);
  }, [refresh, session]);

  const toggle = useCallback(async () => {
    if (!userId || busy || finishing) return null;
    setBusy(true);
    try {
      if (session) {
        const result = await supabase.from('present_dad_sessions').update({ status: 'cancelled' }).eq('id', session.id).eq('status', 'active');
        if (!result.error) setSession(null);
        return result.error ? null : false;
      }

      const endsAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
      const result = await supabase.from('present_dad_sessions').insert({ user_id: userId, ends_at: endsAt }).select('id,ends_at').single();
      if (!result.error && result.data) setSession(result.data as ActiveSession);
      return result.error ? null : true;
    } finally {
      setBusy(false);
    }
  }, [busy, finishing, session, userId]);

  return { enabled: Boolean(session), busy: busy || finishing, toggle };
}
