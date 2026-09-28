import { useCallback, useEffect, useState } from 'react';

import {
  fetchManualActivityHistory,
  subscribeManualActivityChanges,
  type ManualActivityPillar,
  type ManualActivityRow,
} from '../lib/manualActivities';

export function useManualActivityHistory(userId: string | undefined, pillar: ManualActivityPillar) {
  const [activities, setActivities] = useState<ManualActivityRow[]>([]);
  const [loading, setLoading] = useState(Boolean(userId));
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!userId) {
      setActivities([]);
      setLoading(false);
      setError(null);
      return;
    }
    setLoading(true);
    try {
      setActivities(await fetchManualActivityHistory(userId, pillar));
      setError(null);
    } catch {
      setError('Manual activity history is unavailable. Pull to refresh and try again.');
    } finally {
      setLoading(false);
    }
  }, [pillar, userId]);

  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => subscribeManualActivityChanges(() => { void refresh(); }), [refresh]);

  return { activities, loading, error, refresh };
}
