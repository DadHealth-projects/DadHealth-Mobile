import { useEffect, useState } from 'react';

import { useNetworkStatus } from '../contexts/NetworkContext';
import { fetchProInsight } from '../lib/proInsights';
import type { WeeklyReport } from '../lib/weeklyReport';

export function useWeeklyReport(userId: string | undefined, isPro: boolean, enabled: boolean) {
  const { isOffline } = useNetworkStatus();
  const [report, setReport] = useState<WeeklyReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    if (!userId || !isPro || !enabled || isOffline) {
      setReport(null);
      setLoading(false);
      setError(false);
      return () => { active = false; };
    }
    setReport(null);
    setLoading(true);
    setError(false);
    void fetchProInsight<{ report: WeeklyReport | null }>('weekly-report')
      .then((result) => { if (active) setReport(result.report); })
      .catch(() => { if (active) { setReport(null); setError(true); } })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [enabled, isOffline, isPro, userId]);

  return { report, loading, error };
}
