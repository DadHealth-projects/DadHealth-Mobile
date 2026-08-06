import { useCallback, useEffect, useState } from 'react';

import { supabase } from '../lib/supabase';

export type ProgressReport = {
  workouts: number;
  journal: number;
  dadDates: number;
  avgSleep: number | null;
  streak: number;
  avgMood: string | null;
};

export function useProgressReport(userId?: string) {
  const [report, setReport] = useState<ProgressReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!userId) { setReport(null); setLoading(false); return; }
    setLoading(true);
    setError(null);
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
    const monthEnd = now.toISOString().slice(0, 10);
    const [workoutsRes, journalRes, milestonesRes, sleepRes, streakRes, moodRes] = await Promise.all([
      supabase.from('workout_sessions').select('id', { count: 'exact', head: true }).eq('user_id', userId).gte('performed_at', monthStart).lte('performed_at', `${monthEnd}T23:59:59`),
      supabase.from('journal_entries').select('id', { count: 'exact', head: true }).eq('user_id', userId).gte('created_at', monthStart).lte('created_at', `${monthEnd}T23:59:59`),
      supabase.from('milestones').select('id', { count: 'exact', head: true }).eq('user_id', userId).gte('date', monthStart).lte('date', monthEnd),
      supabase.from('sleep_logs').select('hours').eq('user_id', userId).gte('date', monthStart).lte('date', monthEnd),
      supabase.from('user_streaks').select('streak_count').eq('user_id', userId).maybeSingle(),
      supabase.from('mood_logs').select('mood_value').eq('user_id', userId).gte('date', monthStart).lte('date', monthEnd),
    ]);
    if (workoutsRes.error || journalRes.error || milestonesRes.error || sleepRes.error || streakRes.error || moodRes.error) {
      setError('We could not load your monthly report. Please try again.');
      setLoading(false);
      return;
    }
    const sleepRows = sleepRes.data ?? [];
    const moodRows = moodRes.data ?? [];
    const sleepAverage = sleepRows.length ? sleepRows.reduce((sum, row) => sum + Number(row.hours), 0) / sleepRows.length : null;
    const moodAverage = moodRows.length ? moodRows.reduce((sum, row) => sum + Number(row.mood_value), 0) / moodRows.length : null;
    setReport({
      workouts: workoutsRes.count ?? 0,
      journal: journalRes.count ?? 0,
      dadDates: milestonesRes.count ?? 0,
      avgSleep: sleepAverage == null ? null : Math.round(sleepAverage * 10) / 10,
      streak: streakRes.data?.streak_count ?? 0,
      avgMood: moodAverage == null ? null : moodAverage >= 3.5 ? 'Good' : moodAverage >= 2.5 ? 'Okay' : 'Low',
    });
    setLoading(false);
  }, [userId]);

  useEffect(() => { void refresh(); }, [refresh]);
  return { report, loading, error, refresh };
}
