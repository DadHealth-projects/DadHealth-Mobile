import { useCallback, useEffect, useState } from 'react';

import {
  AppleHealthError,
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
      setError('We couldn’t load your Apple Health connection. Please try again.');
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
    } catch (caughtError) {
      setError(getAppleHealthConnectionError(caughtError));
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
    } catch (caughtError) {
      setError(
        caughtError instanceof AppleHealthError && caughtError.code === 'permission_denied'
          ? 'Apple Health access wasn’t enabled. You can change this anytime in iPhone Settings.'
          : 'We couldn’t sync with Apple Health. Please try again.',
      );
      return null;
    } finally {
      setSaving(false);
    }
  }, [refresh, userId]);

  return { capability, authorization, integration, loading, saving, error, refresh, connect, sync };
}

function getAppleHealthConnectionError(error: unknown) {
  if (error instanceof AppleHealthError) {
    if (error.code === 'unavailable') return 'Apple Health isn’t available on this device.';
    if (error.code === 'permission_denied') {
      return 'Apple Health access wasn’t enabled. You can change this anytime in iPhone Settings.';
    }
  }

  return 'We couldn’t connect to Apple Health. Please try again.';
}
