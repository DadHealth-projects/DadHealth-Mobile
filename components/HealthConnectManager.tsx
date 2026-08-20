import { useCallback, useEffect } from 'react';
import { AppState, Platform, type AppStateStatus } from 'react-native';

import { useAuth } from '../contexts/AuthContext';
import { syncHealthConnectIfConnected } from '../lib/healthConnect';

export default function HealthConnectManager() {
  const { user, onboardingComplete } = useAuth();
  const userId = user?.id;

  const sync = useCallback(() => {
    if (Platform.OS !== 'android' || !userId || !onboardingComplete) return;
    void syncHealthConnectIfConnected(userId).catch(() => undefined);
  }, [onboardingComplete, userId]);

  useEffect(() => {
    sync();
    const subscription = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'active') sync();
    });
    return () => subscription.remove();
  }, [sync]);

  return null;
}
