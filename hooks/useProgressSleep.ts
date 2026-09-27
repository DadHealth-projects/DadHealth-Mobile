import { useCallback, useEffect, useRef, useState } from 'react';

import { useNetworkStatus } from '../contexts/NetworkContext';
import { supabase } from '../lib/supabase';
import { getCurrentWeekDayKeys } from '../lib/dashboard.utils';
import { fetchProInsight } from '../lib/proInsights';

export type ProgressSleepDay = { key: string; label: string; hours: number | null; mood: number | null };

export function useProgressSleep(userId?: string, isPro = false) {
  const { isOffline } = useNetworkStatus();
  const [days, setDays] = useState<ProgressSleepDay[]>([]);
  const [pattern, setPattern] = useState('Log more mood and sleep check-ins to unlock pattern insights.');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const latestRequest = useRef(0);
  const loadedUserId = useRef<string | undefined>(undefined);

  const refresh = useCallback(async () => {
    const requestId = ++latestRequest.current;
    if (!userId) {
      loadedUserId.current = undefined;
      setDays([]);
      setPattern('Log more mood and sleep check-ins to unlock pattern insights.');
      setLoading(false);
      return;
    }
    if (loadedUserId.current !== userId) {
      loadedUserId.current = userId;
      setDays([]);
      setPattern('Log more mood and sleep check-ins to unlock pattern insights.');
    }
    if (isOffline) { setLoading(false); setError(null); return; }
    setLoading(true);
    setError(null);
    const dates = getCurrentWeekDayKeys().map((key) => ({
      key,
      label: new Date(`${key}T12:00:00`).toLocaleDateString('en-GB', { weekday: 'short' }),
    }));
    const [sleepResult, moodResult, proPattern] = await Promise.all([
      supabase.from('sleep_logs').select('date,hours').eq('user_id', userId).gte('date', dates[0].key).lte('date', dates[6].key),
      supabase.from('mood_logs').select('date,mood_value,mood_scale_version').eq('user_id', userId).gte('date', dates[0].key).lte('date', dates[6].key),
      isPro
        ? fetchProInsight<{ pattern: string; weekStart: string; weekEnd: string }>('mood-correlation').catch(() => null)
        : Promise.resolve(null),
    ]);
    if (requestId !== latestRequest.current) return;
    if (sleepResult.error || moodResult.error) {
      setError('We could not load your sleep quality. Please try again.');
      setLoading(false);
      return;
    }
    const sleepMap = new Map((sleepResult.data ?? []).map((row) => [String(row.date), Number(row.hours)]));
    const moodMap = new Map((moodResult.data ?? []).map((row) => [
      String(row.date),
      Number(row.mood_value) + (row.mood_scale_version === 1 ? 0 : 1),
    ]));
    const nextDays = dates.map((date) => ({ ...date, hours: sleepMap.get(date.key) ?? null, mood: moodMap.get(date.key) ?? null }));
    setPattern(isPro
      ? proPattern?.pattern ?? 'Pattern insights are unavailable right now. Please try again.'
      : 'Log more mood and sleep check-ins to unlock pattern insights.');
    setDays(nextDays);
    setLoading(false);
  }, [isOffline, isPro, userId]);

  useEffect(() => { void refresh(); }, [refresh]);
  return { days, pattern, loading, error, refresh };
}
