import { useCallback, useEffect, useState } from 'react';

import { useNetworkStatus } from '../contexts/NetworkContext';
import { supabase } from '../lib/supabase';

export type Therapist = {
  id: string;
  name: string;
  spec: string | null;
  availability: string | null;
  price_per_hour: number | null;
};

/**
 * The therapist and counsellor directory is free for every logged-in dad, which
 * is also how the web app has always behaved. No Pro check is made here.
 */
export function useTherapists(userId?: string) {
  const { isOffline } = useNetworkStatus();
  const [therapists, setTherapists] = useState<Therapist[]>([]);
  const [loading, setLoading] = useState(Boolean(userId));
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!userId) {
      setTherapists([]);
      setLoading(false);
      setError(null);
      return;
    }
    if (isOffline) {
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);
    const therapistsResult = await supabase
      .from('therapists')
      .select('id,name,spec,availability,price_per_hour')
      .order('name', { ascending: true });

    if (therapistsResult.error) {
      setTherapists([]);
      setError('We could not load the therapist directory. Please try again.');
    } else {
      setTherapists((therapistsResult.data ?? []) as Therapist[]);
    }
    setLoading(false);
  }, [isOffline, userId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { therapists, loading, error, refresh };
}
