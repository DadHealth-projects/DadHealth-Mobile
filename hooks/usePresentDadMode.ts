import { useCallback, useState } from 'react';

import { useNetworkStatus } from '../contexts/NetworkContext';
import { supabase } from '../lib/supabase';

export type PresentDadSession = {
  id: string;
  started_at: string;
  ends_at: string;
  status: 'active' | 'completed' | 'cancelled';
  completed_duration_seconds: number | null;
  completed_at: string | null;
  completion_acknowledged_at: string | null;
};

const SESSION_FIELDS = 'id,started_at,ends_at,status,completed_duration_seconds,completed_at,completion_acknowledged_at';

function sessionFrom(value: unknown): PresentDadSession | null {
  if (!value || typeof value !== 'object') return null;
  const item = value as Record<string, unknown>;
  if (typeof item.id !== 'string' || typeof item.started_at !== 'string' || typeof item.ends_at !== 'string') return null;
  if (item.status !== 'active' && item.status !== 'completed' && item.status !== 'cancelled') return null;
  return {
    id: item.id,
    started_at: item.started_at,
    ends_at: item.ends_at,
    status: item.status,
    completed_duration_seconds: typeof item.completed_duration_seconds === 'number' ? item.completed_duration_seconds : null,
    completed_at: typeof item.completed_at === 'string' ? item.completed_at : null,
    completion_acknowledged_at: typeof item.completion_acknowledged_at === 'string' ? item.completion_acknowledged_at : null,
  };
}

export function usePresentDadMode(userId?: string) {
  const { isOffline, showOfflineAction } = useNetworkStatus();
  const [session, setSession] = useState<PresentDadSession | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!userId) {
      setSession(null);
      return null;
    }
    if (isOffline) {
      const message = 'Connect to the internet to load your Present Dad session.';
      setError(message);
      throw new Error(message);
    }

    const active = await supabase.from('present_dad_sessions').select(SESSION_FIELDS)
      .eq('user_id', userId).eq('status', 'active').maybeSingle();
    if (active.error) {
      setError('We could not load your Present Dad session. Please try again.');
      throw active.error;
    }
    let current = sessionFrom(active.data);
    if (!current) {
      const pending = await supabase.from('present_dad_sessions').select(SESSION_FIELDS)
        .eq('user_id', userId).eq('status', 'completed').is('completion_acknowledged_at', null)
        .order('completed_at', { ascending: false }).limit(1).maybeSingle();
      if (pending.error) {
        setError('We could not load your completed Present Dad session. Please try again.');
        throw pending.error;
      }
      current = sessionFrom(pending.data);
    }
    setSession(current);
    setError(null);
    return current;
  }, [isOffline, userId]);

  const start = useCallback(async () => {
    if (!userId || busy) return null;
    if (isOffline) {
      showOfflineAction('present_dad');
      setError('Connect to the internet to start Present Dad Mode.');
      return null;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await supabase.from('present_dad_sessions').insert({ user_id: userId })
        .select(SESSION_FIELDS).single();
      if (result.error) throw result.error;
      const started = sessionFrom(result.data);
      if (!started) throw new Error('The session response was incomplete.');
      setSession(started);
      return started;
    } catch {
      setError('We could not start Present Dad Mode. Please try again.');
      return null;
    } finally {
      setBusy(false);
    }
  }, [busy, isOffline, showOfflineAction, userId]);

  const finish = useCallback(async (sessionId: string) => {
    if (!userId || busy) return null;
    if (isOffline) {
      showOfflineAction('present_dad');
      setError('Reconnect to save the time from this session.');
      return null;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await supabase.rpc('finish_present_dad_session', { p_session_id: sessionId });
      if (result.error) throw result.error;
      const completed = sessionFrom(result.data);
      if (!completed) throw new Error('The completion response was incomplete.');
      setSession(completed);
      return completed;
    } catch {
      setError('We could not save this session yet. Please retry; your active session is still saved.');
      return null;
    } finally {
      setBusy(false);
    }
  }, [busy, isOffline, showOfflineAction, userId]);

  const acknowledge = useCallback(async (sessionId: string) => {
    if (!userId || isOffline) return false;
    const result = await supabase.rpc('acknowledge_present_dad_completion', { p_session_id: sessionId });
    if (result.error) {
      setError('Your session is saved, but we could not dismiss its completion message yet.');
      return false;
    }
    setSession(null);
    setError(null);
    return true;
  }, [isOffline, userId]);

  return { session, busy, error, setError, refresh, start, finish, acknowledge };
}
