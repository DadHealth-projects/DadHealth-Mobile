import { useEffect, useState } from 'react';

import { useNetworkStatus } from '../contexts/NetworkContext';
import { fetchProInsight } from '../lib/proInsights';

export type DadScoreHistoryPoint = {
  week_start: string;
  total_score: number;
  mind_score: number;
  body_score: number;
  bond_score: number;
  mind_has_data: boolean;
  body_has_data: boolean;
  bond_has_data: boolean;
};

export function useDadScoreHistory(userId?: string) {
  const { isOffline } = useNetworkStatus();
  const [points, setPoints] = useState<DadScoreHistoryPoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    if (!userId || isOffline) {
      setPoints([]);
      setLoading(false);
      setError(false);
      return () => { active = false; };
    }
    setPoints([]);
    setLoading(true);
    setError(false);
    void fetchProInsight<{ points: DadScoreHistoryPoint[] }>('score-history')
      .then((result) => { if (active) setPoints(result.points); })
      .catch(() => { if (active) { setPoints([]); setError(true); } })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [isOffline, userId]);

  return { points, loading, error };
}
