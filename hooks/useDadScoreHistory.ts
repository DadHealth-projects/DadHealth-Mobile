import { useEffect, useState } from 'react';

import { useNetworkStatus } from '../contexts/NetworkContext';
import { supabase } from '../lib/supabase';
import { hasScoreHistory } from '../lib/scoreTrends';

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

  useEffect(() => {
    let active = true;
    if (!userId || isOffline) {
      setPoints([]);
      setLoading(false);
      return () => { active = false; };
    }

    setLoading(true);
    void supabase
      .from('dad_score_history_view')
      .select('week_start,total_score,mind_score,body_score,bond_score,mind_has_data,body_has_data,bond_has_data')
      .eq('user_id', userId)
      .order('week_start', { ascending: true })
      .then(({ data }) => {
        if (!active) return;
        setPoints(((data ?? []) as DadScoreHistoryPoint[]).filter(hasScoreHistory));
        setLoading(false);
      });

    return () => { active = false; };
  }, [isOffline, userId]);

  return { points, loading };
}
