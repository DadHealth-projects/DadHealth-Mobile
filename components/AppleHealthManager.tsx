import { useCallback, useEffect } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import { useAuth } from '../contexts/AuthContext';
import { syncAppleHealthIfConnected } from '../lib/appleHealth';

export default function AppleHealthManager() {
  const { user, onboardingComplete } = useAuth();
  const userId = user?.id;

  const sync = useCallback(() => {
    if (!userId || !onboardingComplete) return;
    void syncAppleHealthIfConnected(userId).catch((error) => {
      console.warn('[AppleHealth] Foreground sync failed.', error);
    });
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
