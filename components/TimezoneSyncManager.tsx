import { useEffect } from 'react';
import { AppState } from 'react-native';

import { useAuth } from '../contexts/AuthContext';
import { useNetworkStatus } from '../contexts/NetworkContext';
import { currentDeviceTimezone, syncProfileTimezone } from '../lib/deviceTimezone';

/** Follows the phone's timezone automatically: on sign-in, reconnect and each return to the app. */
export default function TimezoneSyncManager() {
  const { user } = useAuth();
  const { isOffline, isKnown } = useNetworkStatus();
  const userId = user?.id ?? null;

  useEffect(() => {
    if (!userId || !isKnown || isOffline) return;
    let active = true;
    let running = false;
    const sync = () => {
      if (!active || running) return;
      running = true;
      void syncProfileTimezone(userId, currentDeviceTimezone())
        .catch(() => 'failed')
        .finally(() => { running = false; });
    };
    sync();
    const subscription = AppState.addEventListener('change', (state) => { if (state === 'active') sync(); });
    return () => { active = false; subscription.remove(); };
  }, [isKnown, isOffline, userId]);

  return null;
}
