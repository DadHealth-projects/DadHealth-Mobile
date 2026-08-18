import { useCallback, useEffect, useState } from 'react';

import {
  connectAppleHealth,
  getAppleHealthAuthorization,
  getAppleHealthCapability,
  getAppleHealthIntegration,
  syncAppleHealth,
  type AppleHealthCapability,
  type AppleHealthAuthorization,
  type AppleHealthIntegration,
} from '../lib/appleHealth';

export function useAppleHealth(userId?: string) {
  const [capability, setCapability] = useState<AppleHealthCapability>(() => getAppleHealthCapability());
  const [authorization, setAuthorization] = useState<AppleHealthAuthorization>('unknown');
  const [integration, setIntegration] = useState<AppleHealthIntegration | null>(null);
  const [loading, setLoading] = useState(Boolean(userId));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setCapability(getAppleHealthCapability());
    if (!userId) {
      setIntegration(null);
      setAuthorization('unknown');
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const currentCapability = getAppleHealthCapability();
      const [nextIntegration, nextAuthorization] = await Promise.all([
        getAppleHealthIntegration(userId),
        currentCapability === 'available'
          ? getAppleHealthAuthorization()
          : Promise.resolve<AppleHealthAuthorization>('unknown'),
      ]);
      setIntegration(nextIntegration);
      setAuthorization(nextAuthorization);
      setError(null);
    } catch {
      setError('We could not load your Apple Health connection. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const connect = useCallback(async () => {
    if (!userId) return null;
    setSaving(true);
    setError(null);
    try {
      const result = await connectAppleHealth(userId);
      await refresh();
      return result;
    } catch {
      setError('Apple Health could not be connected. Check your permissions and try again.');
      return null;
    } finally {
      setSaving(false);
    }
  }, [refresh, userId]);

  const sync = useCallback(async () => {
    if (!userId) return null;
    setSaving(true);
    setError(null);
    try {
      const result = await syncAppleHealth(userId, 7);
      await refresh();
      return result;
    } catch {
      setError('Apple Health could not be synced. Check your permissions and try again.');
      return null;
    } finally {
      setSaving(false);
    }
  }, [refresh, userId]);

  return { capability, authorization, integration, loading, saving, error, refresh, connect, sync };
}
