import { useCallback, useEffect, useState } from 'react';

import {
  HealthConnectError,
  connectHealthConnect,
  getHealthConnectAuthorization,
  getHealthConnectCapability,
  getHealthConnectIntegration,
  openHealthConnectSettings,
  syncHealthConnect,
  type HealthConnectAuthorization,
  type HealthConnectCapability,
  type HealthConnectIntegration,
} from '../lib/healthConnect';

export function useHealthConnect(userId?: string) {
  const [capability, setCapability] = useState<HealthConnectCapability>('unsupported');
  const [authorization, setAuthorization] = useState<HealthConnectAuthorization>('unknown');
  const [integration, setIntegration] = useState<HealthConnectIntegration | null>(null);
  const [loading, setLoading] = useState(Boolean(userId));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(Boolean(userId));
    try {
      const nextCapability = await getHealthConnectCapability();
      setCapability(nextCapability);
      if (!userId || nextCapability === 'unsupported') {
        setIntegration(null);
        setAuthorization('unknown');
        setError(null);
        return;
      }

      const [nextIntegration, nextAuthorization] = await Promise.all([
        getHealthConnectIntegration(userId),
        nextCapability === 'available'
          ? getHealthConnectAuthorization()
          : Promise.resolve<HealthConnectAuthorization>('unknown'),
      ]);
      setIntegration(nextIntegration);
      setAuthorization(nextAuthorization);
      setError(null);
    } catch {
      setError('We couldn’t load your Health Connect connection. Please try again.');
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
      const result = await connectHealthConnect(userId);
      await refresh();
      return result;
    } catch (caughtError) {
      setError(getHealthConnectConnectionError(caughtError));
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
      const result = await syncHealthConnect(userId, 7);
      await refresh();
      return result;
    } catch (caughtError) {
      setError(
        caughtError instanceof HealthConnectError && caughtError.code === 'permission_denied'
          ? 'Health Connect access isn’t enabled. You can change this anytime in Health Connect settings.'
          : 'We couldn’t sync with Health Connect. Please try again.',
      );
      return null;
    } finally {
      setSaving(false);
    }
  }, [refresh, userId]);

  return {
    capability,
    authorization,
    integration,
    loading,
    saving,
    error,
    refresh,
    connect,
    sync,
    openSettings: openHealthConnectSettings,
  };
}

function getHealthConnectConnectionError(error: unknown) {
  if (error instanceof HealthConnectError) {
    if (error.code === 'provider_update_required') {
      return 'Health Connect needs to be updated before Dad Health can connect.';
    }
    if (error.code === 'unavailable') return 'Health Connect isn’t available on this device.';
    if (error.code === 'permission_denied') {
      return 'Health Connect access wasn’t enabled. You can change this anytime in Health Connect settings.';
    }
  }

  return 'We couldn’t connect to Health Connect. Please try again.';
}
