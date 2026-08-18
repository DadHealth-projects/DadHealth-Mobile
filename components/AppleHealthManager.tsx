import { useCallback, useEffect } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import { useAuth } from '../contexts/AuthContext';
import { syncAppleHealthIfConnected } from '../lib/appleHealth';

export default function AppleHealthManager() {
  const { user, onboardingComplete } = useAuth();
  const userId = user?.id;

  const sync = useCallback(() => {
    if (!userId || !onboardingComplete) return;
    void syncAppleHealthIfConnected(userId).catch(() => {
      // Foreground sync is opportunistic. The Health permissions screen gives
      // the user an explicit retry path and surfaces actionable errors.
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
