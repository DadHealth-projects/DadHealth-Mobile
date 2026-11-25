import { useCallback, useEffect, useRef, useState } from 'react';

import {
  AppleHealthError,
  connectAppleHealth,
  disconnectAppleHealth,
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
  // Results that arrive after an account switch must never reach this account's screen.
  const owner = useRef(userId);
  owner.current = userId;

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
      if (owner.current !== userId) return;
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
      if (owner.current !== userId) return null;
      await refresh();
      return result;
    } catch (caughtError) {
      if (owner.current !== userId) return null;
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
      if (owner.current !== userId) return null;
      await refresh();
      return result;
    } catch (caughtError) {
      if (owner.current !== userId) return null;
      setError(
        caughtError instanceof AppleHealthError && caughtError.code === 'not_connected'
          ? 'Apple Health is no longer linked to this account. Connect again to resume syncing.'
          : caughtError instanceof AppleHealthError && caughtError.code === 'permission_denied'
            ? 'Apple Health access wasn’t enabled. You can change this anytime in iPhone Settings.'
            : 'We couldn’t sync with Apple Health. Please try again.',
      );
      // A server "not linked" answer means the link is gone: re-read it so the screen offers Connect.
      if (caughtError instanceof AppleHealthError && caughtError.code === 'not_connected') void refresh();
      return null;
    } finally {
      setSaving(false);
    }
  }, [refresh, userId]);

  /** App-level disconnect: stops imports and removes the link. It does not change system permissions. */
  const disconnect = useCallback(async () => {
    if (!userId) return false;
    setSaving(true);
    setError(null);
    try {
      await disconnectAppleHealth(userId);
      if (owner.current === userId) setIntegration(null);
      return true;
    } catch {
      if (owner.current === userId) setError('We couldn’t disconnect Apple Health. Please try again.');
      return false;
    } finally {
      if (owner.current === userId) setSaving(false);
    }
  }, [userId]);

  return { capability, authorization, integration, loading, saving, error, refresh, connect, sync, disconnect };
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
