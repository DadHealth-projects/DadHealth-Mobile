import { useCallback, useEffect, useState } from 'react';

import { supabase } from '../lib/supabase';

type ActiveSession = { id: string; ends_at: string };

export function usePresentDadMode(userId?: string) {
  const [session, setSession] = useState<ActiveSession | null>(null);
  const [busy, setBusy] = useState(false);

  const expireLocally = useCallback((active: ActiveSession) => {
    setSession((current) => current?.id === active.id ? null : current);
  }, []);

  const refresh = useCallback(async () => {
    if (!userId) { setSession(null); return; }
    const result = await supabase.from('present_dad_sessions').select('id,ends_at').eq('user_id', userId).eq('status', 'active').maybeSingle();
    if (result.error || !result.data) { setSession(null); return; }
    const active = result.data as ActiveSession;
    if (new Date(active.ends_at).getTime() <= Date.now()) expireLocally(active);
    else setSession(active);
  }, [expireLocally, userId]);

  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => {
    if (!session) return;
    const remaining = new Date(session.ends_at).getTime() - Date.now();
    if (remaining <= 0) { expireLocally(session); return; }
    const timer = setTimeout(() => expireLocally(session), remaining);
    return () => clearTimeout(timer);
  }, [expireLocally, session]);

  const toggle = useCallback(async () => {
    if (!userId || busy) return null;
    setBusy(true);
    if (session) {
      const result = await supabase.from('present_dad_sessions').update({ status: 'cancelled' }).eq('id', session.id).eq('status', 'active');
      if (!result.error) setSession(null);
      setBusy(false);
      return result.error ? null : false;
    }

    const endsAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const result = await supabase.from('present_dad_sessions').insert({ user_id: userId, ends_at: endsAt }).select('id,ends_at').single();
    if (!result.error && result.data) setSession(result.data as ActiveSession);
    setBusy(false);
    return result.error ? null : true;
  }, [busy, session, userId]);

  return { enabled: Boolean(session), busy, toggle };
}
