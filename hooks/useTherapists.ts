import { useCallback, useEffect, useState } from 'react';

import { isProfilePro } from '../lib/proStatus';
import { supabase } from '../lib/supabase';

export type Therapist = {
  id: string;
  name: string;
  spec: string | null;
  availability: string | null;
  price_per_hour: number | null;
};

export function useTherapists(userId?: string) {
  const [therapists, setTherapists] = useState<Therapist[]>([]);
  const [isPro, setIsPro] = useState(false);
  const [loading, setLoading] = useState(Boolean(userId));
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!userId) {
      setTherapists([]);
      setIsPro(false);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);
    const [therapistsResult, profileResult] = await Promise.all([
      supabase
        .from('therapists')
        .select('id,name,spec,availability,price_per_hour')
        .order('name', { ascending: true }),
      supabase
        .from('user_profile')
        .select('is_pro,subscription_status')
        .eq('user_id', userId)
        .maybeSingle(),
    ]);

    if (profileResult.error) {
      setTherapists([]);
      setIsPro(false);
      setError('We could not confirm your Dad Health Pro access. Please try again.');
    } else if (therapistsResult.error) {
      setTherapists([]);
      setIsPro(isProfilePro(profileResult.data));
      setError('We could not load the therapist directory. Please try again.');
    } else {
      setTherapists((therapistsResult.data ?? []) as Therapist[]);
      setIsPro(isProfilePro(profileResult.data));
    }
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { therapists, isPro, loading, error, refresh };
}
