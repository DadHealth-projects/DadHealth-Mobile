import { useCallback, useEffect, useState } from 'react';

import { useNetworkStatus } from '../contexts/NetworkContext';
import type { DashboardData } from './useDashboard';
import { readDashboardCache } from '../lib/offlineStorage';
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
  const { isOffline } = useNetworkStatus();
  const [report, setReport] = useState<ProgressReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!userId) { setReport(null); setLoading(false); return; }
    if (isOffline) {
      const cached = await readDashboardCache<DashboardData>(userId).catch(() => null);
      if (cached) {
        setReport({
          workouts: cached.reportStats.workouts,
          journal: cached.reportStats.journal,
          dadDates: cached.reportStats.dadDates,
          avgSleep: null,
          streak: cached.streak ?? 0,
          avgMood: null,
        });
      }
      setLoading(false);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
    const monthEnd = now.toISOString().slice(0, 10);
    const [workoutsRes, journalRes, dadDatesRes, sleepRes, streakRes, moodRes] = await Promise.all([
      supabase.from('workout_sessions').select('id', { count: 'exact', head: true }).eq('user_id', userId).gte('performed_at', monthStart).lte('performed_at', `${monthEnd}T23:59:59`),
      supabase.from('journal_entries').select('id', { count: 'exact', head: true }).eq('user_id', userId).gte('created_at', monthStart).lte('created_at', `${monthEnd}T23:59:59`),
      supabase.from('dad_dates').select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('source', 'ai_search'),
      supabase.from('sleep_logs').select('hours').eq('user_id', userId).gte('date', monthStart).lte('date', monthEnd),
      supabase.from('user_streaks').select('streak_count').eq('user_id', userId).maybeSingle(),
      supabase.from('mood_logs').select('mood_value,mood_scale_version').eq('user_id', userId).gte('date', monthStart).lte('date', monthEnd),
    ]);
    if (workoutsRes.error || journalRes.error || sleepRes.error || streakRes.error || moodRes.error) {
      setError('We could not load your monthly report. Please try again.');
      setLoading(false);
      return;
    }
    const sleepRows = sleepRes.data ?? [];
    const moodRows = moodRes.data ?? [];
    const sleepAverage = sleepRows.length ? sleepRows.reduce((sum, row) => sum + Number(row.hours), 0) / sleepRows.length : null;
    const moodAverage = moodRows.length
      ? moodRows.reduce((sum, row) => sum + Number(row.mood_value) + (row.mood_scale_version === 1 ? 0 : 1), 0) / moodRows.length
      : null;
    setReport({
      workouts: workoutsRes.count ?? 0,
      journal: journalRes.count ?? 0,
      dadDates: dadDatesRes.count ?? 0,
      avgSleep: sleepAverage == null ? null : Math.round(sleepAverage * 10) / 10,
      streak: streakRes.data?.streak_count ?? 0,
      avgMood: moodAverage == null ? null : moodAverage >= 4.5 ? 'Fired up' : moodAverage >= 3.5 ? 'Great' : moodAverage >= 2.5 ? 'Good' : moodAverage >= 1.5 ? 'Okay' : 'Stressed',
    });
    setLoading(false);
  }, [isOffline, userId]);

  useEffect(() => { void refresh(); }, [refresh]);
  return { report, loading, error, refresh };
}
