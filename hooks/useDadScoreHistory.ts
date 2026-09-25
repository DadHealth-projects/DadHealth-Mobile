import { useEffect, useState } from 'react';

import { useNetworkStatus } from '../contexts/NetworkContext';
import { supabase } from '../lib/supabase';

export type DadScoreHistoryPoint = {
  week_start: string;
  total_score: number;
  mind_score: number;
  body_score: number;
  bond_score: number;
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
      .select('week_start,total_score,mind_score,body_score,bond_score')
      .eq('user_id', userId)
      .order('week_start', { ascending: true })
      .then(({ data }) => {
        if (!active) return;
        setPoints((data ?? []) as DadScoreHistoryPoint[]);
        setLoading(false);
      });

    return () => { active = false; };
  }, [isOffline, userId]);

  return { points, loading };
}
