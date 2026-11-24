import { useCallback, useEffect, useState } from 'react';

import { useNetworkStatus } from '../contexts/NetworkContext';
import type { DashboardData } from './useDashboard';
import { readDashboardCache } from '../lib/offlineStorage';
import { supabase } from '../lib/supabase';

export type ProgressBadge = { icon: string; name: string };
/** Brief 07: every catalogue badge is listed; badges the account has not earned are shown locked. */
export type CatalogueBadge = ProgressBadge & { id: string; earned: boolean };

export function badgeCatalogue(
  catalogueRows: Array<{ id?: unknown; icon?: unknown; name?: unknown }>,
  earnedIds: ReadonlySet<string>,
): CatalogueBadge[] {
  return catalogueRows
    .filter((row): row is { id: string; icon: string; name: string } =>
      typeof row.id === 'string' && typeof row.icon === 'string' && typeof row.name === 'string')
    .map((row) => ({ id: row.id, icon: row.icon, name: row.name, earned: earnedIds.has(row.id) }));
}

export function useProgressBadges(userId?: string) {
  const { isOffline } = useNetworkStatus();
  const [badges, setBadges] = useState<ProgressBadge[]>([]);
  const [catalogue, setCatalogue] = useState<CatalogueBadge[]>([]);
  const [earnedCount, setEarnedCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!userId) { setBadges([]); setCatalogue([]); setEarnedCount(0); setLoading(false); return; }
    if (isOffline) {
      const cached = await readDashboardCache<DashboardData>(userId).catch(() => null);
      if (cached) {
        setBadges(cached.badges);
        setEarnedCount(cached.badges.length);
      }
      // The catalogue is not cached; offline shows only the earned badges already saved on the device.
      setCatalogue([]);
      setLoading(false);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    const [catalogueResult, earnedResult] = await Promise.all([
      supabase.from('badges').select('id,icon,name'),
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
    const catalogueRows = (catalogueResult.data ?? []) as Array<{ id?: unknown; icon?: unknown; name?: unknown }>;
    const catalogue = catalogueRows
      .filter((badge): badge is ProgressBadge => typeof badge.icon === 'string' && typeof badge.name === 'string');
    const earnedIds = new Set((earnedResult.data ?? [])
      .map((row) => row.badge_id)
      .filter((id): id is string => typeof id === 'string'));
    setEarnedCount(earned.length);
    setBadges(earned.length > 0 ? earned : catalogue);
    setCatalogue(badgeCatalogue(catalogueRows, earnedIds));
    setLoading(false);
  }, [isOffline, userId]);

  useEffect(() => { void refresh(); }, [refresh]);
  return { badges, catalogue, earnedCount, loading, error, refresh };
}
