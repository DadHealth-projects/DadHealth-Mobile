import { useCallback, useEffect, useState } from 'react';

import { isProfilePro } from '../lib/proStatus';
import { supabase } from '../lib/supabase';

type Metric = { metric_type: string; value: number; recorded_at: string };
type Integration = { provider: string | null; last_sync_at: string | null };

export type ProgressScoreData = {
  score: number | null;
  breakdown: { mind: number | null; body: number | null; bond: number | null };
  isPro: boolean;
  latestSteps: number | null;
  latestActiveMins: number | null;
  integration: Integration | null;
};

const EMPTY: ProgressScoreData = {
  score: null,
  breakdown: { mind: null, body: null, bond: null },
  isPro: false,
  latestSteps: null,
  latestActiveMins: null,
  integration: null,
};

export function useProgressScore(userId?: string) {
  const [data, setData] = useState<ProgressScoreData>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!userId) { setData(EMPTY); setLoading(false); return; }
    setLoading(true);
    setError(null);
    const now = new Date();
    const weekAgo = new Date(now);
    weekAgo.setDate(weekAgo.getDate() - 7);
    const start = weekAgo.toISOString().slice(0, 10);
    const end = now.toISOString().slice(0, 10);
    const [moodRes, sleepRes, workoutRes, journalRes, metricsRes, integrationsRes, profileRes] = await Promise.all([
      supabase.from('mood_logs').select('mood_value').eq('user_id', userId).gte('date', start).lte('date', end),
      supabase.from('sleep_logs').select('hours').eq('user_id', userId).order('date', { ascending: false }).limit(14),
      supabase.from('workout_sessions').select('id', { count: 'exact', head: true }).eq('user_id', userId).gte('performed_at', start).lte('performed_at', `${end}T23:59:59`),
      supabase.from('journal_entries').select('id', { count: 'exact', head: true }).eq('user_id', userId).gte('created_at', start).lte('created_at', `${end}T23:59:59`),
      supabase.from('body_metrics').select('metric_type,value,recorded_at').eq('user_id', userId).gte('recorded_at', start).lte('recorded_at', `${end}T23:59:59`).order('recorded_at', { ascending: false }),
      supabase.from('user_integrations').select('provider,last_sync_at').eq('user_id', userId).order('last_sync_at', { ascending: false, nullsFirst: false }),
      supabase.from('user_profile').select('is_pro,subscription_status').eq('user_id', userId).maybeSingle(),
    ]);
    const requiredError = moodRes.error || sleepRes.error || workoutRes.error || journalRes.error || metricsRes.error || integrationsRes.error || profileRes.error;
    if (requiredError) {
      setError('We could not load your Dad Health score. Please try again.');
      setLoading(false);
      return;
    }
    const moodRows = moodRes.data ?? [];
    const sleepRows = sleepRes.data ?? [];
    const metrics = (metricsRes.data ?? []) as Metric[];
    const stepsRows = metrics.filter((metric) => metric.metric_type === 'steps');
    const activeRows = metrics.filter((metric) => metric.metric_type === 'active_mins');
    const moodAvg = moodRows.length ? moodRows.reduce((sum, row) => sum + Number(row.mood_value), 0) / moodRows.length : null;
    const sleepAvg = sleepRows.length ? sleepRows.reduce((sum, row) => sum + Number(row.hours), 0) / sleepRows.length : null;
    const stepsAvg = averageMetric(stepsRows);
    const activeMinsAvg = averageMetric(activeRows);
    const workoutCount = workoutRes.count ?? 0;
    const journalCount = journalRes.count ?? 0;
    const hasBodyActivity = sleepAvg != null || workoutCount > 0 || stepsAvg != null || activeMinsAvg != null;
    setData({
      score: calculateScore(moodAvg, sleepAvg, workoutCount, journalCount, stepsAvg, activeMinsAvg),
      breakdown: {
        mind: moodAvg == null ? null : Math.min(100, Math.round((moodAvg / 4) * 100)),
        body: hasBodyActivity ? Math.round(Math.min(100, Math.min(30, ((sleepAvg ?? 0) / 8) * 30) + Math.min(30, workoutCount * 8) + (stepsAvg == null ? 0 : Math.min(25, (stepsAvg / 10000) * 25)) + (activeMinsAvg == null ? 0 : Math.min(15, (activeMinsAvg / 30) * 15)))) : null,
        bond: journalCount > 0 ? Math.round(Math.min(100, journalCount * 20)) : null,
      },
      isPro: isProfilePro(profileRes.data),
      latestSteps: stepsRows.length ? Number(stepsRows[0].value) : null,
      latestActiveMins: activeRows.length ? Number(activeRows[0].value) : null,
      integration: ((integrationsRes.data ?? [])[0] as Integration | undefined) ?? null,
    });
    setLoading(false);
  }, [userId]);

  useEffect(() => { void refresh(); }, [refresh]);
  return { data, loading, error, refresh };
}

function averageMetric(rows: Metric[]) { return rows.length ? rows.reduce((sum, row) => sum + Number(row.value ?? 0), 0) / rows.length : null; }

function calculateScore(moodAvg: number | null, sleepAvg: number | null, workoutCount: number, journalCount: number, stepsAvg: number | null, activeMinsAvg: number | null) {
  if (moodAvg == null || sleepAvg == null) return null;
  const moodScore = Math.min(100, (moodAvg / 4) * 30);
  const sleepScore = Math.min(30, (sleepAvg / 8) * 30);
  const workoutScore = Math.min(15, workoutCount * 3);
  const stepsScore = stepsAvg == null ? 0 : Math.min(15, (stepsAvg / 10000) * 15);
  const activeMinsScore = activeMinsAvg == null ? 0 : Math.min(10, (activeMinsAvg / 30) * 10);
  const journalScore = Math.min(15, journalCount * 2);
  return Math.round(Math.min(100, moodScore + sleepScore + workoutScore + stepsScore + activeMinsScore + journalScore));
}
