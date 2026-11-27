import { useCallback, useEffect, useRef, useState } from 'react';

import {
  HealthConnectError,
  connectHealthConnect,
  disconnectHealthConnect,
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
  // Results that arrive after an account switch must never reach this account's screen.
  const owner = useRef(userId);
  owner.current = userId;

  const refresh = useCallback(async () => {
    setLoading(Boolean(userId));
    try {
      const nextCapability = await getHealthConnectCapability();
      if (owner.current !== userId) return;
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
      if (owner.current !== userId) return;
      setIntegration(nextIntegration);
      setAuthorization(nextAuthorization);
      setError(null);
    } catch {
      if (owner.current !== userId) return;
      setError('We couldn’t load your Health Connect connection. Please try again.');
    } finally {
      if (owner.current === userId) setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    setIntegration(null);
    setError(null);
    setSaving(false);
    void refresh();
  }, [refresh]);

  const connect = useCallback(async () => {
    if (!userId) return null;
    setSaving(true);
    setError(null);
    try {
      const result = await connectHealthConnect(userId);
      if (owner.current !== userId) return null;
      await refresh();
      return result;
    } catch (caughtError) {
      if (owner.current !== userId) return null;
      setError(getHealthConnectConnectionError(caughtError));
      return null;
    } finally {
      if (owner.current === userId) setSaving(false);
    }
  }, [refresh, userId]);

  const sync = useCallback(async () => {
    if (!userId) return null;
    setSaving(true);
    setError(null);
    try {
      const result = await syncHealthConnect(userId, 7);
      if (owner.current !== userId) return null;
      await refresh();
      return result;
    } catch (caughtError) {
      if (owner.current !== userId) return null;
      setError(
        caughtError instanceof HealthConnectError && caughtError.code === 'not_connected'
          ? 'Health Connect is no longer linked to this account. Connect again to resume syncing.'
          : caughtError instanceof HealthConnectError && caughtError.code === 'permission_denied'
            ? 'Health Connect access isn’t enabled. You can change this anytime in Health Connect settings.'
            : 'We couldn’t sync with Health Connect. Please try again.',
      );
      // A server "not linked" answer means the link is gone: re-read it so the screen offers Connect.
      if (caughtError instanceof HealthConnectError && caughtError.code === 'not_connected') void refresh();
      return null;
    } finally {
      if (owner.current === userId) setSaving(false);
    }
  }, [refresh, userId]);

  /** App-level disconnect: stops imports and removes the link. It does not change Health Connect permissions. */
  const disconnect = useCallback(async () => {
    if (!userId) return false;
    setSaving(true);
    setError(null);
    try {
      await disconnectHealthConnect(userId);
      if (owner.current === userId) setIntegration(null);
      return true;
    } catch {
      if (owner.current === userId) setError('We couldn’t disconnect Health Connect. Please try again.');
      return false;
    } finally {
      if (owner.current === userId) setSaving(false);
    }
  }, [userId]);

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
    disconnect,
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
