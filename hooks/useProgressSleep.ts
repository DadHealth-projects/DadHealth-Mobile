import { useCallback, useEffect, useState } from 'react';

import { supabase } from '../lib/supabase';

export type ProgressSleepDay = { key: string; label: string; hours: number | null; mood: number | null };

export function useProgressSleep(userId?: string) {
  const [days, setDays] = useState<ProgressSleepDay[]>([]);
  const [pattern, setPattern] = useState('Log more mood and sleep check-ins to unlock pattern insights.');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!userId) { setDays([]); setLoading(false); return; }
    setLoading(true);
    setError(null);
    const today = new Date();
    const monday = new Date(today);
    monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));
    const dates = Array.from({ length: 7 }, (_, index) => {
      const date = new Date(monday);
      date.setDate(monday.getDate() + index);
      return { key: date.toISOString().slice(0, 10), label: date.toLocaleDateString('en-GB', { weekday: 'short' }) };
    });
    const [sleepResult, moodResult] = await Promise.all([
      supabase.from('sleep_logs').select('date,hours').eq('user_id', userId).gte('date', dates[0].key).lte('date', dates[6].key),
      supabase.from('mood_logs').select('date,mood_value').eq('user_id', userId).gte('date', dates[0].key).lte('date', dates[6].key),
    ]);
    if (sleepResult.error || moodResult.error) {
      setError('We could not load your sleep quality. Please try again.');
      setLoading(false);
      return;
    }
    const sleepMap = new Map((sleepResult.data ?? []).map((row) => [String(row.date), Number(row.hours)]));
    const moodMap = new Map((moodResult.data ?? []).map((row) => [String(row.date), Number(row.mood_value)]));
    const nextDays = dates.map((date) => ({ ...date, hours: sleepMap.get(date.key) ?? null, mood: moodMap.get(date.key) ?? null }));
    const pairs = nextDays.filter((day): day is ProgressSleepDay & { hours: number; mood: number } => day.hours != null && day.hours > 0 && day.mood != null && day.mood > 0);
    const highSleep = pairs.filter((day) => day.hours >= 7);
    const lowSleep = pairs.filter((day) => day.hours < 7);
    const highMood = averageMood(highSleep);
    const lowMood = averageMood(lowSleep);
    setPattern(highMood != null && lowMood != null && lowMood > 0
      ? `Your mood score is ${Math.round(((highMood - lowMood) / lowMood) * 100)}% higher on days after 7+ hours sleep.`
      : 'Log more mood and sleep check-ins to unlock pattern insights.');
    setDays(nextDays);
    setLoading(false);
  }, [userId]);

  useEffect(() => { void refresh(); }, [refresh]);
  return { days, pattern, loading, error, refresh };
}

function averageMood(days: Array<{ mood: number }>) { return days.length ? days.reduce((sum, day) => sum + day.mood, 0) / days.length : null; }
