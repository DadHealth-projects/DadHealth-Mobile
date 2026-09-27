import { useCallback, useEffect, useState } from 'react';

import { useNetworkStatus } from '../contexts/NetworkContext';
import { fetchProInsight } from '../lib/proInsights';
import type { DashboardData } from './useDashboard';
import { readDashboardCache } from '../lib/offlineStorage';

export type ProgressReport = {
  workouts: number;
  journal: number;
  dadDates: number;
  avgSleep: number | null;
  streak: number;
  avgMood: string | null;
};

export function useProgressReport(userId?: string, isPro = false) {
  const { isOffline } = useNetworkStatus();
  const [report, setReport] = useState<ProgressReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!userId || !isPro) {
      setReport(null);
      setLoading(false);
      setError(null);
      return;
    }
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
      } else setReport(null);
      setLoading(false);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await fetchProInsight<{ report: ProgressReport }>('monthly-report');
      setReport(result.report);
    } catch {
      setReport(null);
      setError('We could not load your monthly report. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [isOffline, isPro, userId]);

  useEffect(() => { void refresh(); }, [refresh]);
  return { report, loading, error, refresh };
}
