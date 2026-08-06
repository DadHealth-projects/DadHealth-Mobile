import { useCallback, useEffect, useState } from 'react';

import { supabase } from '../lib/supabase';

export type ProgressBadge = { icon: string; name: string };

export function useProgressBadges(userId?: string) {
  const [badges, setBadges] = useState<ProgressBadge[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!userId) { setBadges([]); setLoading(false); return; }
    setLoading(true);
    setError(null);
    const [catalogueResult, earnedResult] = await Promise.all([
      supabase.from('badges').select('icon,name'),
      supabase.from('earned_badges').select('badge_id,badges(icon,name)').eq('user_id', userId),
    ]);
    if (catalogueResult.error || earnedResult.error) {
      setError('We could not load your badges. Please try again.');
      setLoading(false);
      return;
    }
    const earned = (earnedResult.data ?? [])
      .map((row) => Array.isArray(row.badges) ? row.badges[0] : row.badges)
      .filter((badge): badge is ProgressBadge => Boolean(badge && typeof badge.icon === 'string' && typeof badge.name === 'string'));
    const catalogue = (catalogueResult.data ?? [])
      .filter((badge): badge is ProgressBadge => typeof badge.icon === 'string' && typeof badge.name === 'string');
    setBadges(earned.length > 0 ? earned : catalogue);
    setLoading(false);
  }, [userId]);

  useEffect(() => { void refresh(); }, [refresh]);
  return { badges, loading, error, refresh };
}
